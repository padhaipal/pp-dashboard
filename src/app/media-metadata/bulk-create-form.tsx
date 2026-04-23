"use client";

import { useMemo, useState } from "react";
import { NATASHA_VOICE_ID } from "./types";

type Variable = "letter" | "word";

interface Props {
  letters: string[];
  words: string[];
  onCreated: (count: number) => void;
}

export function BulkCreateForm({ letters, words, onCreated }: Props) {
  const [variable, setVariable] = useState<Variable>("letter");
  const [stidTemplate, setStidTemplate] = useState("{letter}-");
  const [voiceId, setVoiceId] = useState(NATASHA_VOICE_ID);
  const [transcripts, setTranscripts] = useState<string[]>([""]);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const placeholder = `{${variable}}`;
  const source = variable === "letter" ? letters : words;

  const nonEmptyTranscripts = useMemo(
    () => transcripts.map((s) => s.trim()).filter((s) => s.length > 0),
    [transcripts],
  );
  const rowCount = source.length * nonEmptyTranscripts.length;
  const stidUsesVar = stidTemplate.includes(placeholder);
  const anyTranscriptUsesVar = nonEmptyTranscripts.some((t) =>
    t.includes(placeholder),
  );

  const switchVariable = (next: Variable) => {
    const prevPlaceholder = `{${variable}}`;
    const nextPlaceholder = `{${next}}`;
    setVariable(next);
    setStidTemplate((t) => t.split(prevPlaceholder).join(nextPlaceholder));
    setTranscripts((prev) =>
      prev.map((t) => t.split(prevPlaceholder).join(nextPlaceholder)),
    );
  };

  const updateTranscript = (i: number, value: string) =>
    setTranscripts((prev) => prev.map((s, j) => (j === i ? value : s)));
  const addTranscript = () => setTranscripts((prev) => [...prev, ""]);
  const removeTranscript = (i: number) =>
    setTranscripts((prev) => prev.filter((_, j) => j !== i));

  const validate = (): string | null => {
    if (!stidUsesVar) {
      return `state_transition_id template must contain ${placeholder}`;
    }
    if (nonEmptyTranscripts.length === 0) {
      return "at least one non-empty transcript is required";
    }
    if (rowCount === 0) {
      return `no ${variable}s available`;
    }
    return null;
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    const msg = validate();
    if (msg) {
      setError(msg);
      setConfirming(false);
      return;
    }
    setSubmitting(true);
    const items: Array<{
      state_transition_id: string;
      script_text: string;
      voice_id?: string;
    }> = [];
    for (const value of source) {
      for (const t of nonEmptyTranscripts) {
        items.push({
          state_transition_id: stidTemplate.split(placeholder).join(value),
          script_text: t.split(placeholder).join(value),
          ...(voiceId.trim() ? { voice_id: voiceId.trim() } : {}),
        });
      }
    }
    try {
      const res = await fetch(
        `/api/proxy/media-meta-data/elevenlabs-generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );
      if (!res.ok) {
        setError(`Create failed (${res.status}): ${await res.text()}`);
        return;
      }
      setNotice(`Queued ${items.length} audio rows.`);
      setConfirming(false);
      onCreated(items.length);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const firstExpanded = source[0]
    ? {
        stid: stidTemplate.split(placeholder).join(source[0]),
        scripts: nonEmptyTranscripts.map((t) =>
          t.split(placeholder).join(source[0]),
        ),
      }
    : null;

  return (
    <details className="mb-6 bg-white border border-zinc-200 rounded-lg">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 select-none">
        Bulk create audio across all {variable === "letter" ? "letters" : "words"}
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-zinc-200">
        <div className="flex items-center gap-4 mb-3 mt-3">
          <label className="text-xs font-medium text-zinc-600">Variable:</label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="variable"
              checked={variable === "letter"}
              onChange={() => switchVariable("letter")}
              disabled={submitting}
            />
            <code className="font-mono">{"{letter}"}</code>
            <span className="text-zinc-400">({letters.length})</span>
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="variable"
              checked={variable === "word"}
              onChange={() => switchVariable("word")}
              disabled={submitting}
            />
            <code className="font-mono">{"{word}"}</code>
            <span className="text-zinc-400">({words.length})</span>
          </label>
        </div>

        <label className="block text-xs font-medium text-zinc-600 mb-1">
          state_transition_id template{" "}
          <span className="text-zinc-400 font-normal">
            (must contain{" "}
            <code className="font-mono">{placeholder}</code>)
          </span>
        </label>
        <input
          type="text"
          value={stidTemplate}
          onChange={(e) => setStidTemplate(e.target.value)}
          disabled={submitting}
          placeholder={`${placeholder}-letterImage-word-maxErrors-last`}
          className={`w-full border rounded px-2 py-1 text-sm font-mono mb-3 focus:outline-none ${
            stidTemplate && !stidUsesVar
              ? "border-red-300 focus:border-red-500"
              : "border-zinc-300 focus:border-emerald-500"
          }`}
        />

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
          className="w-full border border-zinc-300 rounded px-2 py-1 text-sm font-mono mb-3 focus:outline-none focus:border-emerald-500"
        />

        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Transcripts{" "}
          <span className="text-zinc-400 font-normal">
            (one audio per transcript per {variable};{" "}
            <code className="font-mono">{placeholder}</code> substituted inline)
          </span>
        </label>
        <div className="flex flex-col gap-2 mb-2">
          {transcripts.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                value={s}
                onChange={(e) => updateTranscript(i, e.target.value)}
                disabled={submitting}
                rows={2}
                className="flex-1 border border-zinc-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                placeholder={`e.g. अच्छी कोशिश, पर वह "${placeholder}" था।`}
              />
              {transcripts.length > 1 && (
                <button
                  onClick={() => removeTranscript(i)}
                  disabled={submitting}
                  className="text-xs text-red-500 hover:text-red-700 mt-1 disabled:opacity-40"
                  aria-label="Remove transcript"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addTranscript}
          disabled={submitting}
          className="text-xs text-emerald-700 hover:text-emerald-900 mb-3 disabled:opacity-40"
        >
          + Add another
        </button>

        {firstExpanded && nonEmptyTranscripts.length > 0 && (
          <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded px-3 py-2 mb-3">
            <div className="font-medium text-zinc-500 mb-1">
              Preview (first {variable}: &ldquo;{source[0]}&rdquo;)
            </div>
            <div className="font-mono text-zinc-700 truncate">
              {firstExpanded.stid}
            </div>
            {firstExpanded.scripts.map((s, i) => (
              <div key={i} className="text-zinc-700 truncate">
                {s}
              </div>
            ))}
          </div>
        )}

        {!anyTranscriptUsesVar && nonEmptyTranscripts.length > 0 && (
          <div className="text-xs text-amber-700 mb-2">
            Warning: none of the transcripts reference{" "}
            <code className="font-mono">{placeholder}</code> — all{" "}
            {source.length} {variable}s will share identical script text.
          </div>
        )}
        {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
        {notice && <div className="text-xs text-emerald-700 mb-2">{notice}</div>}

        <div className="flex items-center gap-3">
          {!confirming ? (
            <button
              onClick={() => {
                setError(null);
                setNotice(null);
                const msg = validate();
                if (msg) {
                  setError(msg);
                  return;
                }
                setConfirming(true);
              }}
              disabled={submitting}
              className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded disabled:opacity-40"
            >
              Create{" "}
              {rowCount > 0 && (
                <span className="opacity-80">
                  ({source.length} × {nonEmptyTranscripts.length} ={" "}
                  {rowCount} rows)
                </span>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-40"
              >
                {submitting ? "Creating..." : `Confirm ${rowCount} rows`}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-40"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </details>
  );
}