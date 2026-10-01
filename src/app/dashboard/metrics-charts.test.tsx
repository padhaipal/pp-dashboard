// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MetricsCharts } from "./metrics-charts";

const day = (i: number) => `2026-09-${String(i + 1).padStart(2, "0")}`;
// 10 days; the last one is "today" (partial)
const DAILY = Array.from({ length: 10 }, (_, i) => ({ date: day(i), users_over_5min: [4, 8, 6, 10, 2, 12, 9, 7, 14, 3][i], active_ms: 60000 * (i + 1), letters_learnt: 20 + i }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MetricsCharts — daily active users", () => {
  it("shows yesterday's raw count as the headline, raw daily bars, and the 7-day average faintly behind them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ daily: DAILY }) })));
    const { container } = render(<MetricsCharts />);
    const title = await screen.findByText("Daily active users (>5 min)");
    const card = title.parentElement as HTMLElement;
    // raw count for the last complete day (14), not a 7-day average (≈8.1)
    expect(card.textContent).toContain("14");
    expect(card.textContent).toContain("yesterday");
    expect(card.textContent).not.toContain("7-day avg,");
    const svg = card.querySelector("svg")!;
    // one bar per day (hit targets are separate transparent rects over the plot)
    const bars = Array.from(svg.querySelectorAll("rect")).filter((r) => r.getAttribute("fill") === "#10b981");
    expect(bars).toHaveLength(10);
    // today's bar is faded
    expect(bars[9].getAttribute("opacity")).toBe("0.45");
    // the rolling average sits behind the bars as a faint line
    const bg = svg.querySelector('[data-testid="chart-background"]')!;
    expect(bg).not.toBeNull();
    expect(bg.getAttribute("opacity")).toBe("0.3");
    expect(bg.compareDocumentPosition(bars[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // the two accumulated charts have no background line
    expect(container.querySelectorAll('[data-testid="chart-background"]')).toHaveLength(1);
    await waitFor(() => expect(screen.getByText("Minutes spent — accumulated")).toBeDefined());
  });
});
