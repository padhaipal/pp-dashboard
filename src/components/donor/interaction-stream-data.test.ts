import { describe, expect, it } from "vitest";
import { initialRows, isDevanagari, QUESTION_TYPE, reveal, revealGapMs, STREAM_SIZE, shownWpm, timeAgo, unseen, type StreamRow } from "./interaction-stream-data";

const row = (n: number): StreamRow => ({
  key: `k${n}`,
  at: new Date(Date.UTC(2026, 9, 22, 12, n)).toISOString(),
  student: "R...i",
  kind: "voice",
  answer: "क...ल",
  correct_answer: "कमल",
  answer_correct: true,
  wpm: null,
});

describe("interaction stream", () => {
  it("opens on the newest ten, newest first", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(i));
    const shown = initialRows(rows);
    expect(shown).toHaveLength(STREAM_SIZE);
    expect(shown[0].key).toBe("k19");
    expect(shown[9].key).toBe("k10");
  });

  it("keeps whatever there is when fewer than ten", () => {
    expect(initialRows([row(1), row(2)]).map((r) => r.key)).toEqual(["k2", "k1"]);
  });

  it("finds unseen turns, oldest first", () => {
    expect(unseen(new Set(["k1"]), [row(3), row(1), row(2)]).map((r) => r.key)).toEqual(["k2", "k3"]);
  });

  it("a revealed turn rotates the oldest out; a known one is ignored", () => {
    const shown = initialRows(Array.from({ length: 10 }, (_, i) => row(i)));
    const next = reveal(shown, row(30));
    expect(next).toHaveLength(10);
    expect(next[0].key).toBe("k30");
    expect(next.some((r) => r.key === "k0")).toBe(false);
    expect(reveal(next, row(30))).toBe(next);
  });

  it("spreads a minute's turns over the minute", () => {
    expect(revealGapMs(1)).toBe(30_000);
    expect(revealGapMs(5)).toBe(10_000);
    expect(revealGapMs(100)).toBe(1500);
  });

  it("says how long ago", () => {
    const now = Date.parse("2026-10-22T12:00:00Z");
    expect(timeAgo("2026-10-22T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-22T11:57:00Z", now)).toBe("3 min ago");
    expect(timeAgo("2026-10-22T09:30:00Z", now)).toBe("2 h ago");
    expect(timeAgo("2026-10-21T11:00:00Z", now)).toBe("1 day ago");
    expect(timeAgo("2026-10-18T12:00:00Z", now)).toBe("4 days ago");
  });

  it("names the question types", () => {
    expect(QUESTION_TYPE).toEqual({ voice: "Reading Question", tap: "Comprehension Multi-choice" });
  });

  it("shownWpm: over 200 is noise, shown as no speed", () => {
    expect(shownWpm(null)).toBeNull();
    expect(shownWpm(42)).toBe(42);
    expect(shownWpm(200)).toBe(200);
    expect(shownWpm(201)).toBeNull();
  });

  it("isDevanagari", () => {
    expect(isDevanagari("क...ल")).toBe(true);
    expect(isDevanagari("A...l")).toBe(false);
  });
});
