"use client";

import { useState } from "react";
import {
  NATASHA_VOICE_ID,
  STATIC_MEDIA_RULES,
  STICKER_DIMENSION,
  TEXT_MAX_CHARS,
  type UploadKind,
} from "./types";

type Kind = "audio" | "text" | UploadKind;

const KINDS: { value: Kind; label: string }[] = [
  { value: "audio", label: "Audio (ElevenLabs)" },
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "sticker", label: "Sticker" },
  { value: "video", label: "Video" },
];

function isUploadKind(k: Kind): k is UploadKind {
  return k === "image" || k === "sticker" || k === "video";
}

function fmtBytes(n: number): string {
  return n >= 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(n / 1024)} KB`;
}

// Decode an image file to read its natural pixel dimensions (for sticker checks).
function readImageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not decode image"));
    };
    img.src = url;
  });
}

// Client-side pre-validation mirroring the server guards. Returns an error
// message, or null if the file passes the checks we can run in the browser.
async function validateFile(k: UploadKind, f: File): Promise<string | null> {
  const rule = STATIC_MEDIA_RULES[k];
  if (!rule.mimes.includes(f.type)) {
    if (k === "image" && f.type === "image/webp") {
      return 'WebP files are stickers, not images — switch the type to "Sticker".';
    }
    return `Unsupported file type "${f.type || "unknown"}". Allowed: ${rule.hint}`;
  }
  if (f.size > rule.maxBytes) {
    return `File is ${fmtBytes(f.size)}, over the ${fmtBytes(rule.maxBytes)} limit for ${k}.`;
  }
  if (k === "sticker") {
    try {
      const { w, h } = await readImageSize(f);
      if (w !== STICKER_DIMENSION || h !== STICKER_DIMENSION) {
        return `Sticker must be exactly ${STICKER_DIMENSION}×${STICKER_DIMENSION}, but this file is ${w}×${h}.`;
      }
    } catch {
      // Can't decode in-browser — let the server make the final call.
    }
  }
  return null;
}

export function CreateMediaForm({
  initialStid,
  onCreated,
  onCancel,
}: {
  initialStid: string;
  onCreated: (count: number) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<Kind>("audio");
  const [stid, setStid] = useState(initialStid);
  const [voiceId, setVoiceId] = useState(NATASHA_VOICE_ID);
  const [script, setScript] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchKind = (next: Kind) => {
    setKind(next);
    setFile(null);
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    const trimmedStid = stid.trim();
    if (!trimmedStid) {
      setError("state_transition_id is required");
      return;
    }

    setSubmitting(true);
    try {
      // Audio is generated (not uploaded) via the existing ElevenLabs endpoint.
      if (kind === "audio") {
        const scriptText = script.trim();
        if (!scriptText) {
          setError("Script text is required");
          return;
        }
        const res = await fetch(
          `/api/proxy/media-meta-data/elevenlabs-generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: [
                {
                  state_transition_id: trimmedStid,
                  script_text: scriptText,
                  ...(voiceId.trim() ? { voice_id: voiceId.trim() } : {}),
                },
              ],
            }),
          },
        );
        if (!res.ok) {
          setError(`Create failed (${res.status}): ${await res.text()}`);
          return;
        }
        onCreated(1);
        return;
      }

      // Text / image / sticker / video go through the multipart upload-static endpoint.
      const form = new FormData();
      if (kind === "text") {
        const t = text.trim();
        if (!t) {
          setError("Text is required");
          return;
        }
        if (t.length > TEXT_MAX_CHARS) {
          setError(
            `Text is ${t.length} characters, over the ${TEXT_MAX_CHARS} limit.`,
          );
          return;
        }
        form.append(
          "items",
          JSON.stringify([
            { state_transition_id: trimmedStid, media_type: "text", text: t },
          ]),
        );
      } else if (isUploadKind(kind)) {
        if (!file) {
          setError("Please choose a file");
          return;
        }
        const msg = await validateFile(kind, file);
        if (msg) {
          setError(msg);
          return;
        }
        form.append(
          "items",
          JSON.stringify([
            { state_transition_id: trimmedStid, media_type: kind },
          ]),
        );
        form.append("files", file, file.name);
      }

      // No Content-Type header: the browser sets the multipart boundary.
      const res = await fetch(`/api/proxy/media-meta-data/upload-static`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        setError(`Upload failed (${res.status}): ${await res.text()}`);
        return;
      }
      // A 201 does NOT guarantee success — inspect the per-item result status.
      const data = (await res.json()) as {
        results?: { status: string; error?: string }[];
      };
      const r = data.results?.[0];
      if (!r) {
        setError("Upload returned no result.");
        return;
      }
      if (r.status === "created") {
        onCreated(1);
      } else if (r.status === "duplicate_skipped") {
        setNotice(
          "Identical media already exists for this state_transition_id — nothing was uploaded.",
        );
      } else {
        setError(`Upload failed: ${r.error ?? r.status}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const rule = isUploadKind(kind) ? STATIC_MEDIA_RULES[kind] : null;

  return (
    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-emerald-900">Add media</h3>
        <button
          onClick={onCancel}
          disabled={submitting}
          className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>

      <label className="block text-xs font-medium text-zinc-600 mb-1">Type</label>
      <div className="flex flex-wrap gap-3 mb-3">
        {KINDS.map((k) => (
          <label key={k.value} className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="media-kind"
              checked={kind === k.value}
              onChange={() => switchKind(k.value)}
              disabled={submitting}
            />
            {k.label}
          </label>
        ))}
      </div>

      <label className="block text-xs font-medium text-zinc-600 mb-1">
        state_transition_id
      </label>
      <input
        type="text"
        value={stid}
        onChange={(e) => setStid(e.target.value)}
        disabled={submitting}
        className="w-full border border-zinc-300 rounded px-2 py-1 text-sm font-mono mb-3 focus:outline-none focus:border-emerald-500"
      />

      {kind === "audio" && (
        <>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            voice_id{" "}
            <span className="text-zinc-400 font-normal">
              (Natasha prefilled — Hindi conversational)
            </span>
          </label>
          <input
            type="text"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={submitting}
            placeholder="ElevenLabs voice id"
            className="w-full border border-zinc-300 rounded px-2 py-1 text-sm font-mono mb-3 focus:outline-none focus:border-emerald-500"
          />
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Script
          </label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            disabled={submitting}
            rows={2}
            placeholder="Script text..."
            className="w-full border border-zinc-300 rounded px-2 py-1 text-sm mb-3 focus:outline-none focus:border-emerald-500"
          />
        </>
      )}

      {kind === "text" && (
        <>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Text{" "}
            <span className="text-zinc-400 font-normal">
              ({text.trim().length}/{TEXT_MAX_CHARS})
            </span>
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder="Message text..."
            className="w-full border border-zinc-300 rounded px-2 py-1 text-sm mb-3 focus:outline-none focus:border-emerald-500"
          />
        </>
      )}

      {isUploadKind(kind) && rule && (
        <>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            File{" "}
            <span className="text-zinc-400 font-normal">({rule.hint})</span>
          </label>
          <input
            // key on kind so switching type clears the previously chosen file
            key={kind}
            type="file"
            accept={rule.accept}
            onChange={(e) => {
              setError(null);
              setNotice(null);
              setFile(e.target.files?.[0] ?? null);
            }}
            disabled={submitting}
            className="w-full text-sm mb-1 file:mr-3 file:rounded file:border-0 file:bg-emerald-100 file:px-3 file:py-1 file:text-emerald-800 hover:file:bg-emerald-200"
          />
          {file && (
            <div className="text-xs text-zinc-500 mb-3">
              {file.name} — {fmtBytes(file.size)}
            </div>
          )}
          {!file && <div className="mb-3" />}
        </>
      )}

      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {notice && <div className="text-xs text-amber-700 mb-2">{notice}</div>}

      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded disabled:opacity-40"
        >
          {submitting
            ? kind === "audio"
              ? "Generating..."
              : "Uploading..."
            : kind === "audio"
              ? "Generate"
              : "Upload"}
        </button>
      </div>
    </div>
  );
}
