// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { levelDirection, MediaTable } from "./media-table";

const base = { has_audio: false, transcripts: [], word: null, starting_state: null, answer: null, answer_correct: null, score_changes: [], final_state: null, level: null, wpm: null, tap: null, onboarding: null };

const MEDIA = [
  // comprehension flow tap, wrong option
  {
    ...base,
    id: "tap-1",
    kind: "tap",
    created_at: "2026-09-30T10:02:00Z",
    word: "अब कमल इधर आ",
    starting_state: "comprehension",
    final_state: "complete",
    answer: "घर",
    answer_correct: false,
    level: 9,
    tap: { question: "कमल कहाँ गया?", chosen: "बाज़ार", correct: "घर" },
  },
  // a tap the lesson was not waiting for
  { ...base, id: "tap-2", kind: "tap", created_at: "2026-09-30T10:01:30Z", tap: { question: null, chosen: null, correct: null } },
  // the passage read before it
  {
    ...base,
    id: "v-1",
    kind: "voice",
    created_at: "2026-09-30T10:00:00Z",
    has_audio: true,
    transcripts: [{ text: "अब कमल इधर आ", source: "sarvam" }],
    word: "अब कमल इधर आ",
    starting_state: "sentence",
    final_state: "comprehension",
    answer: "अब कमल इधर आ",
    answer_correct: true,
    level: 9,
    wpm: 20,
  },
  // onboarding: the completing turn (birth month) — lesson one starts on it
  {
    ...base,
    id: "ob-3",
    kind: "onboarding",
    created_at: "2026-09-20T08:03:00Z",
    has_audio: true,
    transcripts: [{ text: "मार्च", source: "sarvam" }],
    word: "नल",
    starting_state: "start",
    final_state: "word",
    answer: "नल",
    level: 2,
    onboarding: { question: "askMonth", next: "done", understood: "3", saved: [{ field: "birth_month", value: "3" }], completed: true },
  },
  // onboarding: age
  {
    ...base,
    id: "ob-2",
    kind: "onboarding",
    created_at: "2026-09-20T08:02:00Z",
    has_audio: true,
    onboarding: { question: "askAge", next: "askMonth", understood: "8", saved: [{ field: "birth_year", value: "2018" }], completed: false },
  },
  // onboarding: the first message
  { ...base, id: "ob-1", kind: "onboarding", created_at: "2026-09-20T08:00:00Z", has_audio: true, onboarding: { question: null, next: "askGuardian", understood: null, saved: [], completed: false } },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MediaTable", () => {
  it("levelDirection", () => {
    expect(levelDirection(3, 2)).toBe("up");
    expect(levelDirection(2, 3)).toBe("down");
    expect(levelDirection(2, 2)).toBe("same");
    expect(levelDirection(null, 2)).toBe("none");
    expect(levelDirection(2, null)).toBe("none");
  });

  it("asks for onboarding turns and renders voice, tap and onboarding rows", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, json: async () => ({ user: { name: "Rani", phone: "919999990001" }, media: MEDIA }) };
      }),
    );
    const onUserLoaded = vi.fn();
    const { container } = render(<MediaTable userId="u1" onUserLoaded={onUserLoaded} />);
    await waitFor(() => expect(container.querySelectorAll("tbody tr[data-kind]").length).toBe(6));

    // staff flag on the request (the proxy drops it for sessionless callers)
    expect(calls[0]).toBe("/api/proxy/users/u1/media?offset=0&onboarding=1");
    expect(onUserLoaded).toHaveBeenCalledWith({ name: "Rani", phone: "919999990001" });

    const rowOf = (i: number) => container.querySelectorAll("tbody tr[data-kind]")[i] as HTMLElement;
    const text = (i: number) => rowOf(i).textContent ?? "";

    // tap row: badge instead of a player, question + chosen option, the correct option, Incorrect
    expect(rowOf(0).getAttribute("data-kind")).toBe("tap");
    expect(rowOf(0).className).toContain("bg-sky-50");
    expect(rowOf(0).querySelector("audio")).toBeNull();
    expect(text(0)).toContain("Flow tap");
    expect(text(0)).toContain("question:कमल कहाँ गया?");
    expect(text(0)).toContain("chose:बाज़ार");
    expect(text(0)).toContain("घर");
    expect(text(0)).toContain("Incorrect");
    expect(text(0)).toContain("comprehension");
    expect(text(0)).toContain("complete");
    // no dashboard-transcript control on a tap
    expect(text(0)).not.toContain("+ add");

    // a tap that was not awaited
    expect(text(1)).toContain("Not counted");
    expect(text(1)).toContain("unknown");

    // voice row unchanged: player, transcript, Correct, wpm
    expect(rowOf(2).getAttribute("data-kind")).toBe("voice");
    expect(rowOf(2).className).not.toContain("bg-sky-50");
    expect(rowOf(2).querySelector("audio")?.getAttribute("src")).toBe("/api/proxy/media-meta-data/v-1/audio");
    expect(text(2)).toContain("sarvam:");
    expect(text(2)).toContain("Correct");
    expect(text(2)).toContain("20");

    // onboarding rows: the question asked → the next one, what was understood, what was saved
    expect(rowOf(3).getAttribute("data-kind")).toBe("onboarding");
    expect(rowOf(3).className).toContain("bg-amber-50");
    expect(rowOf(3).querySelector("audio")).not.toBeNull();
    expect(text(3)).toContain("Onboarding");
    expect(text(3)).toContain("Birth month?");
    expect(text(3)).toContain("understood:March");
    expect(text(3)).toContain("saved:birth month: March · written to the student's record, with recording permission");
    expect(text(3)).toContain("lesson 1 started:नल");
    expect(text(3)).toContain("Onboarding complete");

    expect(text(4)).toContain("Child's age?");
    expect(text(4)).toContain("understood:8 years old");
    expect(text(4)).toContain("saved:birth year: 2018");
    expect(text(4)).toContain("Birth month?");
    expect(text(4)).not.toContain("lesson 1 started");

    expect(text(5)).toContain("Onboarding started");
    expect(text(5)).toContain("understood:not interpreted");
    expect(text(5)).toContain("saved:nothing");
    expect(text(5)).toContain("Are you the guardian?");

    expect(screen.getByText("All media loaded")).toBeDefined();
  });
});
