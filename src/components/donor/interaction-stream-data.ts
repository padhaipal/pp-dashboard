// The donor page's interaction stream: what pp-sketch serves (GET
// users/dashboard/interactions, via the public proxy — names and
// transcripts masked to first and last character, no audio, no ids) and the
// pure helpers the table runs on. No React, no DOM.

export interface StreamRow {
  key: string; // opaque, stable per turn
  at: string; // ISO time of the student's message
  student: string; // masked name
  kind: "voice" | "tap";
  answer: string | null;
  correct_answer: string | null;
  answer_correct: boolean | null;
  wpm: number | null;
}

export interface StreamResponse {
  computed_at: string;
  delay_s: number;
  rows: StreamRow[];
}

export const STREAM_URL = "/api/proxy/users/dashboard/interactions";
// rows on screen (when pp-sketch has that many)
export const STREAM_SIZE = 10;
export const POLL_MS = 60_000;

const newestFirst = (a: StreamRow, b: StreamRow) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

// The first answer: the newest STREAM_SIZE turns, newest first.
export const initialRows = (rows: StreamRow[]): StreamRow[] => [...rows].sort(newestFirst).slice(0, STREAM_SIZE);

// Turns not seen before, oldest first — the order they are revealed in.
export const unseen = (known: ReadonlySet<string>, rows: StreamRow[]): StreamRow[] =>
  rows.filter((r) => !known.has(r.key)).sort((a, b) => -newestFirst(a, b));

// Reveal one turn: it joins at its place in time and the oldest rotates out.
export function reveal(shown: StreamRow[], row: StreamRow): StreamRow[] {
  if (shown.some((r) => r.key === row.key)) return shown;
  return [row, ...shown].sort(newestFirst).slice(0, STREAM_SIZE);
}

// New turns are spread over the next poll so they arrive one by one, as
// they happened, instead of in a burst once a minute.
export const revealGapMs = (queued: number): number => Math.max(1500, Math.floor(POLL_MS / Math.max(1, queued + 1)));

// "22 Oct, 6:42 pm" in India time
export function formatIst(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
