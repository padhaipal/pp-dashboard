"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { CreateMediaForm } from "./create-media-form";

interface MediaItem {
  id: string;
  media_type: "audio" | "text" | "video" | "image" | "sticker" | "flow";
  source: string;
  status: string;
  created_at: string;
  state_transition_id: string | null;
  text: string | null;
  has_content: boolean;
  content_mime: string | null;
  generation_script: string | null;
  wa_media_url: string | null;
}

function formatIST(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

// Mirrors pp-sketch's FlowMediaPayload (llm-generate.dto.ts) — the JSON a
// flow row stores in its text column. Options are in their stored (original
// generation) order; runtime sends shuffle per send.
interface FlowPayload {
  question_text: string;
  options: Array<{ id: string; text: string; correct: boolean }>;
}

function parseFlowPayload(text: string): FlowPayload | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.question_text !== "string" || !Array.isArray(p.options)) {
      return null;
    }
    return p as unknown as FlowPayload;
  } catch {
    return null;
  }
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

function FlowPreview({ text }: { text: string }) {
  const payload = parseFlowPayload(text);
  if (!payload) {
    // Unrecognized shape — show the raw JSON rather than nothing.
    return (
      <pre className="text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-3 py-2 whitespace-pre-wrap break-all">
        {text}
      </pre>
    );
  }
  return (
    <div className="text-sm bg-zinc-50 border border-zinc-200 rounded px-3 py-2">
      <div className="text-zinc-900 font-medium mb-2">
        {payload.question_text}
      </div>
      <ol className="flex flex-col gap-1">
        {payload.options.map((option, i) => (
          <li
            key={option.id}
            className={`flex items-baseline gap-2 rounded px-2 py-1 ${
              option.correct
                ? "bg-emerald-50 text-emerald-900"
                : "text-zinc-700"
            }`}
          >
            <span className="font-mono text-xs text-zinc-400 shrink-0">
              {OPTION_LETTERS[i] ?? i + 1}.
            </span>
            <span>{option.text}</span>
            {option.correct && (
              <span className="text-xs text-emerald-600 shrink-0">
                ✓ correct
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AudioPlayer({ mediaId }: { mediaId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        className="h-8 w-64"
        src={`/api/proxy/media-meta-data/${mediaId}/audio`}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && isFinite(d)) setDuration(d);
        }}
      />
      {duration !== null && (
        <span className="text-xs text-zinc-400 whitespace-nowrap">
          {duration.toFixed(1)}s
        </span>
      )}
    </div>
  );
}

function MediaPreview({ item }: { item: MediaItem }) {
  if (item.media_type === "audio" && item.has_content) {
    return <AudioPlayer mediaId={item.id} />;
  }
  if (item.media_type === "video" && item.has_content) {
    return (
      <video
        controls
        preload="metadata"
        className="max-w-md max-h-64 rounded border border-zinc-200"
        src={`/api/proxy/media-meta-data/${item.id}/audio`}
      />
    );
  }
  if (
    (item.media_type === "image" || item.media_type === "sticker") &&
    item.has_content
  ) {
    return (
      <div className="relative w-80 h-48 rounded border border-zinc-200 bg-zinc-50 overflow-hidden">
        <Image
          alt={`${item.media_type} preview`}
          src={`/api/proxy/media-meta-data/${item.id}/audio`}
          fill
          unoptimized
          className="object-contain"
        />
      </div>
    );
  }
  if (item.media_type === "text" && item.text) {
    return (
      <div className="text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded px-3 py-2 whitespace-pre-wrap">
        {item.text}
      </div>
    );
  }
  if (item.media_type === "flow" && item.text) {
    return <FlowPreview text={item.text} />;
  }
  return <div className="text-xs text-zinc-400 italic">No content</div>;
}

// onDelete absent = view-only card: no delete affordance is rendered.
function MediaCard({
  item,
  onDelete,
}: {
  item: MediaItem;
  onDelete?: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/media-meta-data/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      onDelete?.(item.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-zinc-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium uppercase tracking-wide bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">
            {item.media_type}
          </span>
          <span className="text-xs text-zinc-500">{item.source}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              item.status === "ready"
                ? "bg-emerald-50 text-emerald-700"
                : item.status === "failed"
                  ? "bg-red-50 text-red-700"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {item.status}
          </span>
          <span className="text-xs text-zinc-400">
            {formatIST(item.created_at)}
          </span>
        </div>
        {onDelete && (
          <div className="flex items-center gap-2">
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={deleting}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
              >
                Delete
              </button>
            ) : (
              <>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded disabled:opacity-40"
                >
                  {deleting ? "..." : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mb-3">
        <MediaPreview item={item} />
      </div>

      {item.generation_script && (
        <div className="text-xs mb-2">
          <span className="font-medium text-zinc-500 mr-1">script:</span>
          <span className="text-zinc-700">{item.generation_script}</span>
        </div>
      )}
      {item.wa_media_url && (
        <div className="text-xs text-zinc-500 truncate">
          <span className="font-medium mr-1">wa_media_url:</span>
          <span className="font-mono">{item.wa_media_url}</span>
        </div>
      )}
      <div className="text-[10px] font-mono text-zinc-300 mt-1">{item.id}</div>
      {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
    </div>
  );
}

// readOnly hides every modify affordance (+ Add media, per-item delete,
// Delete all) — used by the comprehension table, which is view-only:
// creation happens on /llm and deletion stays in the table itself.
export function CoverageModal({
  stid,
  onClose,
  readOnly = false,
}: {
  stid: string;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passageText, setPassageText] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/media-meta-data/by-state-transition-id?state_transition_id=${encodeURIComponent(stid)}`,
      );
      if (!res.ok) {
        setError(`Failed to load (${res.status})`);
        return;
      }
      setItems(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [stid]);

  useEffect(() => {
    load();
  }, [load]);

  // `${passageId}-sentence-comprehension` stids: the reading passage row
  // carries no stid (it IS the uuid prefix), so fetch it by id to show the
  // passage next to its flow question. Best-effort — absence just hides the
  // block.
  useEffect(() => {
    const match = /^([0-9a-f-]{36})-sentence-comprehension$/i.exec(stid);
    if (!match) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/proxy/media-meta-data/${match[1]}`);
        if (!res.ok) return;
        const row = (await res.json()) as MediaItem;
        if (!cancelled && row.media_type === "text" && row.text) {
          setPassageText(row.text);
        }
      } catch {
        // best-effort only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDeleted = (id: string) => {
    setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
  };

  const handleCreated = (count: number) => {
    setCreating(false);
    setNotice(
      `Added ${count} media ${count === 1 ? "row" : "rows"} — may take a moment to finish processing.`,
    );
    load();
  };

  const allItems = items ?? [];

  const runBulkDeleteMedia = async () => {
    setBulkDeleting(true);
    setError(null);
    const ids = allItems.map((i) => i.id);
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/proxy/media-meta-data/${id}`, {
            method: "DELETE",
          });
          return { id, ok: res.ok };
        } catch {
          return { id, ok: false };
        }
      }),
    );
    const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
    const failCount = results.length - okIds.size;
    setItems((prev) => (prev ? prev.filter((x) => !okIds.has(x.id)) : prev));
    setNotice(
      `Deleted ${okIds.size} media ${okIds.size === 1 ? "row" : "rows"}${
        failCount > 0 ? `; ${failCount} failed` : ""
      }.`,
    );
    setBulkDeleting(false);
    setConfirmBulkDelete(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-zinc-50 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 py-3 border-b border-zinc-200">
          <h2 className="text-sm font-mono text-zinc-800 text-center truncate pr-6">
            {stid}
          </h2>
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-auto flex-1">
          {!creating && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {!readOnly && (
                  <>
                    <button
                      onClick={() => {
                        setNotice(null);
                        setCreating(true);
                      }}
                      className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded"
                    >
                      + Add media
                    </button>
                    <button
                      onClick={() => {
                        setNotice(null);
                        setConfirmBulkDelete(true);
                      }}
                      disabled={allItems.length === 0}
                      className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Delete all media ({allItems.length})
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-40"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          )}

          {creating && (
            <CreateMediaForm
              initialStid={stid}
              onCreated={handleCreated}
              onCancel={() => setCreating(false)}
            />
          )}

          {notice && (
            <div className="mb-4 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
              {notice}
            </div>
          )}

          {passageText && (
            <div className="mb-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">
                Passage
              </div>
              <div className="text-sm text-zinc-800 bg-white border border-zinc-200 rounded px-3 py-2 whitespace-pre-wrap">
                {passageText}
              </div>
            </div>
          )}

          {loading && !items && (
            <div className="text-sm text-zinc-400">Loading...</div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {items && items.length === 0 && (
            <div className="text-sm text-zinc-400 italic">
              No media for this state transition id.
            </div>
          )}
          {items && items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onDelete={readOnly ? undefined : handleDeleted}
                />
              ))}
            </div>
          )}
        </div>

        {confirmBulkDelete && (
          <div
            className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center p-6"
            onClick={() => !bulkDeleting && setConfirmBulkDelete(false)}
          >
            <div
              className="bg-white rounded-lg shadow-2xl max-w-md w-full p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-zinc-900 mb-2">
                Delete all media?
              </h3>
              <p className="text-sm text-zinc-600 mb-1">
                This will soft-delete {allItems.length} media{" "}
                {allItems.length === 1 ? "row" : "rows"} of every type (audio,
                text, image, video, sticker) for:
              </p>
              <p className="text-xs font-mono text-zinc-800 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 mb-3 break-all">
                {stid}
              </p>
              <p className="text-xs text-zinc-500 mb-4">
                S3 objects will be removed and rows flagged as{" "}
                <code className="font-mono">rolled_back</code>.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  disabled={bulkDeleting}
                  className="px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={runBulkDeleteMedia}
                  disabled={bulkDeleting}
                  className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-40"
                >
                  {bulkDeleting
                    ? "Deleting..."
                    : `Delete ${allItems.length} ${allItems.length === 1 ? "row" : "rows"}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}