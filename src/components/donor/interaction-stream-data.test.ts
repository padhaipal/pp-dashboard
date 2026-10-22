import { describe, expect, it } from "vitest";
import { initialRows, reveal, revealGapMs, STREAM_SIZE, unseen, type StreamRow } from "./interaction-stream-data";

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
});
