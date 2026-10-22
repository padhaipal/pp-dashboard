"use client";

// The donor page's live stream of student interactions, under the Traction
// chart: the /user/[id] table's columns for the public — masked student
// name, time, voice note or tap, the answer (a voice note's transcript
// masked to its first and last character), the expected answer, the mark
// and reading speed. No audio. Polls pp-sketch once a minute (paused while
// the tab is hidden); turns are at least two minutes old, and new ones are
// revealed one by one over the minute, the oldest rotating out, so the
// table always shows the latest STREAM_SIZE.

import { useCallback, useEffect, useRef, useState } from "react";
import { formatIst, initialRows, POLL_MS, reveal, revealGapMs, STREAM_URL, unseen, type StreamResponse, type StreamRow } from "./interaction-stream-data";

export function InteractionStream() {
  const [rows, setRows] = useState<StreamRow[] | null>(null);
  const [error, setError] = useState(false);
  const known = useRef<Set<string>>(new Set());
  const queue = useRef<StreamRow[]>([]);
  const [queued, setQueued] = useState(0);
  const [fresh, setFresh] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(STREAM_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as StreamResponse;
      if (known.current.size === 0) {
        data.rows.forEach((row) => known.current.add(row.key));
        setRows(initialRows(data.rows));
      } else {
        const add = unseen(known.current, data.rows);
        add.forEach((row) => known.current.add(row.key));
        queue.current.push(...add);
        setQueued(queue.current.length);
      }
      setError(false);
    } catch {
      setError((was) => was || known.current.size === 0);
    }
  }, []);

  // poll every minute while the tab is visible; catch up on return
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      void poll();
      timer = setInterval(() => void poll(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  // reveal queued turns one at a time
  useEffect(() => {
    if (queued === 0) return;
    const id = setTimeout(() => {
      const next = queue.current.shift();
      setQueued(queue.current.length);
      if (!next) return;
      setRows((prev) => reveal(prev ?? [], next));
      setFresh(next.key);
    }, revealGapMs(queued));
    return () => clearTimeout(id);
  }, [queued]);

  return (
    <div className="mt-8" data-testid="interaction-stream">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <h3 className="text-lg font-bold text-zinc-800">Student interactions, live</h3>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
          Delayed by two minutes · names and answers masked
        </span>
      </div>
      {error && <p className="py-10 text-center text-sm text-zinc-400">Interactions are unavailable right now.</p>}
      {!error && rows === null && <p className="py-10 text-center text-sm text-zinc-400">Loading…</p>}
      {rows !== null && rows.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">No interactions yet.</p>}
      {rows !== null && rows.length > 0 && (
        <div className="w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <style>{"@keyframes ppFresh{from{background-color:#dcfce7}to{background-color:transparent}}"}</style>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Response</th>
                <th className="px-4 py-3 font-medium">Answer</th>
                <th className="px-4 py-3 font-medium">Correct Answer</th>
                <th className="px-4 py-3 font-medium">Answer Status</th>
                <th className="px-4 py-3 font-medium">WPM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  data-testid="stream-row"
                  data-kind={row.kind}
                  className={"border-b border-zinc-100 align-top " + (row.kind === "tap" ? "bg-sky-50/60" : "")}
                  style={row.key === fresh ? { animation: "ppFresh 2.5s ease-out" } : undefined}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600">{formatIst(row.at)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-zinc-700">{row.student}</td>
                  <td className="px-4 py-2.5">
                    {row.kind === "tap" ? (
                      <span className="inline-block whitespace-nowrap rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Flow tap</span>
                    ) : (
                      <span className="inline-block whitespace-nowrap rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Voice note</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{row.answer ? <span className="text-zinc-700">{row.answer}</span> : <span className="italic text-zinc-400">--</span>}</td>
                  <td className="px-4 py-2.5">{row.correct_answer ? <span className="text-zinc-700">{row.correct_answer}</span> : <span className="italic text-zinc-400">--</span>}</td>
                  <td className="px-4 py-2.5">
                    {row.answer_correct === true && <span className="font-medium text-emerald-600">Correct</span>}
                    {row.answer_correct === false && <span className="font-medium text-red-500">Incorrect</span>}
                    {row.answer_correct === null && <span className="italic text-zinc-400">--</span>}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-700">{row.wpm ?? <span className="italic text-zinc-400">--</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
