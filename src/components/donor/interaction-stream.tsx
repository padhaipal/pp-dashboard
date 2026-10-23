"use client";

// The donor page's live stream of student interactions, under the Traction
// chart: the /user/[id] table's columns for the public — masked student
// name, time, voice note or tap, the answer (a voice note's transcript
// masked to its first and last character), the expected answer, the mark
// and reading speed. No audio. Polls pp-sketch once a minute (paused while
// the tab is hidden); turns are at least two minutes old (shown as "N min
// ago", refreshed every 30 s), and new ones are
// revealed one by one over the minute, the oldest rotating out, so the
// table always shows the latest STREAM_SIZE. Phones get the same rows as a
// compact feed instead of the seven-column table. Speeds over MAX_WPM show
// as "--".

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { initialRows, isDevanagari, POLL_MS, QUESTION_TYPE, reveal, revealGapMs, shownWpm, STREAM_SIZE, STREAM_URL, timeAgo, unseen, type StreamResponse, type StreamRow } from "./interaction-stream-data";

const Dash = () => <span className="italic text-zinc-500">--</span>;

// a transcript / expected answer: Hindi in the Devanagari face, slightly larger
function Text({ s }: { s: string | null }): ReactNode {
  if (!s) return <Dash />;
  return isDevanagari(s) ? <span className="font-devanagari text-[1.1em] leading-snug text-zinc-800">{s}</span> : <span className="text-zinc-800">{s}</span>;
}

function Mark({ ok }: { ok: boolean | null }) {
  if (ok === true) return <span className="font-medium text-emerald-700">Correct</span>;
  if (ok === false) return <span className="font-medium text-red-600">Incorrect</span>;
  return <Dash />;
}

export function InteractionStream() {
  const [rows, setRows] = useState<StreamRow[] | null>(null);
  const [error, setError] = useState(false);
  const known = useRef<Set<string>>(new Set());
  const queue = useRef<StreamRow[]>([]);
  const [queued, setQueued] = useState(0);
  const [fresh, setFresh] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

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
        <h3 className="text-lg font-bold text-zinc-900">Student interactions, live</h3>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
          Names and student transcripts masked for child privacy reasons.
        </span>
      </div>
      {error && <p className="py-10 text-center text-sm text-zinc-500">Interactions are unavailable right now.</p>}
      {!error && rows === null && (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3" aria-label="Loading" data-testid="stream-skeleton">
          {Array.from({ length: STREAM_SIZE }, (_, k) => (
            <div key={k} className="h-9 animate-pulse rounded bg-zinc-100" />
          ))}
        </div>
      )}
      {rows !== null && rows.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">No interactions yet.</p>}
      {rows !== null && rows.length > 0 && (
        <>
          <style>{"@keyframes ppFresh{from{background-color:#dcfce7}to{background-color:transparent}}"}</style>
          {/* phones: one compact line per turn */}
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white sm:hidden" data-testid="stream-feed">
            {rows.map((row) => {
              const wpm = shownWpm(row.wpm);
              return (
                <li key={row.key} data-testid="stream-item" className="px-3 py-2.5 text-sm" style={row.key === fresh ? { animation: "ppFresh 2.5s ease-out" } : undefined}>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span>{timeAgo(row.at, now)}</span>·<span className="text-zinc-700">{row.student}</span>·<span>{row.kind === "tap" ? "Multi-choice" : "Reading"}</span>
                    {wpm !== null && (
                      <>
                        ·<span>{wpm} wpm</span>
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    {row.answer_correct === null ? (
                      <Dash />
                    ) : (
                      <span className={row.answer_correct ? "font-bold text-emerald-700" : "font-bold text-red-600"} aria-label={row.answer_correct ? "Correct" : "Incorrect"}>
                        {row.answer_correct ? "✓" : "✗"}
                      </span>
                    )}
                    <Text s={row.answer} />
                    {row.correct_answer && row.answer_correct === false && (
                      <span className="text-xs text-zinc-500">
                        expected <Text s={row.correct_answer} />
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden w-full overflow-x-auto rounded-lg border border-zinc-200 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Question Type</th>
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
                    className={"border-b border-zinc-100 align-top " + (row.kind === "tap" ? "bg-brand-soft/40" : "")}
                    style={row.key === fresh ? { animation: "ppFresh 2.5s ease-out" } : undefined}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-zinc-600" title={new Date(row.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}>
                      {timeAgo(row.at, now)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-zinc-700">{row.student}</td>
                    <td className="px-4 py-2.5">
                      {row.kind === "tap" ? (
                        <span className="inline-block whitespace-nowrap rounded bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">{QUESTION_TYPE.tap}</span>
                      ) : (
                        <span className="inline-block whitespace-nowrap rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{QUESTION_TYPE.voice}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Text s={row.answer} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Text s={row.correct_answer} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Mark ok={row.answer_correct} />
                    </td>
                    <td className="px-4 py-2.5 text-zinc-700" data-testid="stream-wpm">
                      {shownWpm(row.wpm) ?? <Dash />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
