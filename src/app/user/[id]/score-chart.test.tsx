// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { greyscale, ScoreChart } from "./score-chart";

const json = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
const row = (letter_id: string, grapheme: string, score: number, user_message_id: string | null) => ({
  score,
  created_at: "2026-09-01T00:00:00Z",
  letter_id,
  grapheme,
  is_seed: user_message_id === null,
  user_message_id,
});

describe("ScoreChart", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("greyscale keeps the luminance within a mid-light grey band", () => {
    expect(greyscale("#ffffff")).toBe("#c8c8c8"); // clamped high
    expect(greyscale("#000000")).toBe("#8c8c8c"); // clamped low
    expect(greyscale("#10b981")).toBe("#919191"); // emerald, lum ≈ 145
    expect(greyscale("#f59e0b")).toBe("#a6a6a6"); // amber, lum ≈ 166
    // pure grey, no hue
    for (const c of ["#ef4444", "#3b82f6", "#84cc16"]) expect(greyscale(c)).toMatch(/^#(..)\1\1$/);
  });

  it("learnt letters keep their colour and draw on top; the others are greyscale, thin and translucent; the legend sits under the chart and a tap pins a letter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.includes("letter-bins")
          ? json([{ userId: "u", userPhone: "", bins: { untouched: [], regressed: [], learnt: ["क"], improved: [] } }])
          : json([row("l2", "ख", 1, "m1"), row("l2", "ख", 0, "m2"), row("l1", "क", 1, "m1"), row("l1", "क", 3, "m2")]),
      ),
    );
    render(<ScoreChart userId="u" />);
    const svg = await screen.findByTestId("letter-chart");
    const legend = screen.getByTestId("letter-legend");

    // legend after (under) the chart, in a block container — not beside it
    expect(svg.nextElementSibling).toBe(legend);
    expect(svg.parentElement!.className).not.toContain("flex");

    // data order is ख (unlearnt, colour 0) then क (learnt, colour 1), but the
    // learnt line is drawn LAST (on top): grey + thin + translucent first
    const lines = Array.from(svg.querySelectorAll("path")).filter((p) => p.getAttribute("stroke") !== "transparent");
    expect(lines.map((p) => p.getAttribute("stroke"))).toEqual([greyscale("#10b981"), "#3b82f6"]);
    expect(lines.map((p) => p.getAttribute("stroke-width"))).toEqual(["1.1", "2.5"]);
    expect(lines.map((p) => p.getAttribute("opacity"))).toEqual(["0.55", "1"]);
    // the legend keeps the data order
    expect(legend.textContent).toContain("ख");
    expect(legend.textContent).toContain("क★");
    expect(legend.textContent).not.toContain("ख★");

    // tap a legend entry → pinned: the other letter fades; tap again → released
    const [first, second] = Array.from(legend.children) as HTMLElement[];
    expect(first.style.opacity).toBe("0.6");
    fireEvent.click(first);
    expect(second.style.opacity).toBe("0.3");
    expect(lines[1].getAttribute("opacity")).toBe("0.1");
    expect(lines[0].getAttribute("opacity")).toBe("1");
    fireEvent.click(first);
    expect(second.style.opacity).toBe("1");
  });
});
