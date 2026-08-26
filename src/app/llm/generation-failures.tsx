"use client";

import { useEffect, useState } from "react";

// Read-only list of recent gate-failed generations (soft-deleted question
// rows carrying media_details.gate_failure), for troubleshooting what the
// verification/solvability gates reject and why. Rendered at the bottom of
// /llm; refreshes on demand.

const FAILURES_LIMIT = 10;

type FailureItem = {
  question_id: string;
  question_text: string | null;
  question_type: string | null;
  gate_failure: {
    gate?: string;
    reason?: string;
    judge_picks?: number[];
    // Gate observability counters (pp-sketch gate-shared.ts): valid runs are
    // scored up to the gate's target; the split counters partition invalid
    // runs by cause.
    correct?: number;
    valid_runs?: number;
    total_calls?: number;
    call_failures?: number;
    unparseable?: number;
    /** Pre-2026-08 rows only. */
    rate?: number;
  };
  solvability: {
    correct?: number;
    valid_runs?: number;
    total_calls?: number;
    call_failures?: number;
    unparseable?: number;
    /** Pre-2026-08 rows only. */
    rate?: number;
  } | null;
  // Answer options in creation order, correct one flagged. Absent on
  // responses from a pp-sketch older than 2026-08-20.
  options?: { text: string | null; correct: boolean }[];
  passage_id: string | null;
  passage_preview: string | null;
  level: number | null;
  created_at: string;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; items: FailureItem[] };

export function GenerationFailures() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/proxy/media-meta-data/generation-failures?limit=${FAILURES_LIMIT}`,
        );
        if (!res.ok) {
          if (!cancelled)
            setState({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const json = (await res.json()) as { items: FailureItem[] };
        if (!cancelled) setState({ status: "done", items: json.items ?? [] });
      } catch (err) {
        if (!cancelled)
          setState({ status: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function load() {
    setState({ status: "loading" });
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-900">Filter failures</h3>
        <button
          onClick={load}
          className="text-xs text-blue-600 hover:underline"
        >
          refresh
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        Last {FAILURES_LIMIT} generations rejected by the passage-judge or
        solvability gate — kept soft-deleted for troubleshooting, never
        delivered, no audio. A judge repeatedly picking the same wrong option
        index usually means the answer key is wrong.
      </p>
      {state.status === "loading" && (
        <p className="text-xs text-zinc-400">loading…</p>
      )}
      {state.status === "error" && (
        <p className="text-xs text-red-600">failed to load: {state.message}</p>
      )}
      {state.status === "done" && state.items.length === 0 && (
        <p className="text-xs text-zinc-400">No gate failures recorded yet.</p>
      )}
      {state.status === "done" && state.items.length > 0 && (
        <div className="space-y-3">
          {state.items.map((item) => (
            <div
              key={item.question_id}
              className="rounded border border-zinc-100 bg-zinc-50 p-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-800">
                  {item.gate_failure.gate ?? "?"} gate
                </span>
                {item.question_type && (
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-zinc-700">
                    {item.question_type}
                  </span>
                )}
                {item.level !== null && (
                  <span className="text-zinc-500">level {item.level}</span>
                )}
                <span className="text-zinc-400">
                  {new Date(item.created_at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </span>
              </div>
              {item.question_text && (
                <p className="text-zinc-800 mb-1">{item.question_text}</p>
              )}
              {item.passage_preview && (
                <p className="text-zinc-500 mb-1 whitespace-pre-wrap">
                  {item.passage_preview}
                </p>
              )}
              {/* Correct answer beside its distractors, always visible —
                  "why was this guessable without the passage?" is answered
                  by comparing them. */}
              {item.options && item.options.length > 0 && (
                <ul className="mb-1">
                  {item.options.map((option, i) => (
                    <li
                      key={i}
                      className={
                        option.correct
                          ? "font-medium text-emerald-700"
                          : "text-zinc-600"
                      }
                    >
                      {option.correct ? "✓" : "·"} {option.text}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-amber-700">{item.gate_failure.reason}</p>
              {item.gate_failure.judge_picks &&
                item.gate_failure.judge_picks.length > 0 && (
                  <p className="text-zinc-600 mt-0.5">
                    judge picked option index
                    {item.gate_failure.judge_picks.length > 1 ? "es" : ""}:{" "}
                    <span className="font-mono">
                      {item.gate_failure.judge_picks.join(", ")}
                    </span>
                  </p>
                )}
              {item.gate_failure.total_calls !== undefined && (
                <p className="text-zinc-600 mt-0.5">
                  {item.gate_failure.correct !== undefined &&
                    `correct ${item.gate_failure.correct}/`}
                  {item.gate_failure.valid_runs} valid ·{" "}
                  {item.gate_failure.total_calls} calls (
                  {item.gate_failure.call_failures} call failures,{" "}
                  {item.gate_failure.unparseable} unparseable)
                </p>
              )}
              {/* Pre-2026-08 rows carried a rate instead of counters. */}
              {item.gate_failure.total_calls === undefined &&
                item.solvability?.rate !== undefined && (
                  <p className="text-zinc-600 mt-0.5">
                    zero-context rate:{" "}
                    {Math.round(item.solvability.rate * 100)}% of{" "}
                    {item.solvability.valid_runs} runs
                  </p>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
