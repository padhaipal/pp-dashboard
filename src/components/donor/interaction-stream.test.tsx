import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionStream } from "./interaction-stream";
import type { StreamRow } from "./interaction-stream-data";

const row = (n: number, o: Partial<StreamRow> = {}): StreamRow => ({
  key: `k${n}`,
  at: new Date(Date.UTC(2026, 9, 22, 12, n)).toISOString(),
  student: "R...i",
  kind: "voice",
  answer: "क...ल",
  correct_answer: "कमल",
  answer_correct: true,
  wpm: null,
  ...o,
});

const respond = (rows: StreamRow[]) => ({ ok: true, json: async () => ({ computed_at: "", delay_s: 120, rows }) });

describe("InteractionStream", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the latest ten, then rotates a new turn in after the next poll", async () => {
    const first = Array.from({ length: 12 }, (_, i) => row(i));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(first))
      .mockResolvedValueOnce(respond([row(40, { kind: "tap", answer: "नदी में", correct_answer: "पेड़ पर", answer_correct: false }), ...first.slice(0, 11)]));
    vi.stubGlobal("fetch", fetchMock);
    render(<InteractionStream />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/proxy/users/dashboard/interactions", { cache: "no-store" });
    let rows = screen.getAllByTestId("stream-row");
    expect(rows).toHaveLength(10);
    expect(rows[0].textContent).toContain("R...i");
    expect(rows[0].textContent).toContain("क...ल");

    // next poll a minute later; the new turn is revealed half a minute after
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    rows = screen.getAllByTestId("stream-row");
    expect(rows).toHaveLength(10);
    expect(rows[0].getAttribute("data-kind")).toBe("tap");
    expect(rows[0].textContent).toContain("पेड़ पर");
    expect(rows[0].textContent).toContain("Incorrect");
  });

  it("shows a speed over 200 wpm as --, like no speed; phones get a compact feed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond([row(1, { wpm: 250 }), row(2, { wpm: 42 })])));
    render(<InteractionStream />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const wpm = screen.getAllByTestId("stream-wpm").map((c) => c.textContent);
    expect(wpm).toEqual(["42", "--"]);
    const items = screen.getAllByTestId("stream-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("42 wpm");
    expect(items[1].textContent).not.toContain("wpm");
    expect(items[0].textContent).toContain("✓");
  });

  it("never asks for audio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond([row(1)]));
    vi.stubGlobal("fetch", fetchMock);
    render(<InteractionStream />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock.mock.calls.every(([u]) => !String(u).includes("audio"))).toBe(true);
    expect(document.querySelector("audio")).toBeNull();
  });
});
