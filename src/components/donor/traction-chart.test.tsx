import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TractionChart } from "./traction-chart";
import type { TractionResponse } from "./traction-data";

const day = (date: string, minutes: number) => ({
  date,
  users_over_5min: 1,
  minutes,
  students_onboarded: 1,
  mpl_b_passed: 0,
  teachers_onboarded: 0,
  schools: 0,
  blocks: 0,
  districts: 0,
  states: 0,
});

const DATA: TractionResponse = {
  from: "2026-04-01",
  to: "2026-05-10",
  computed_at: "2026-05-11T00:00:00Z",
  daily: [day("2026-05-09", 30), day("2026-05-10", 45)],
  totals: { hours: 12345, students: 678 },
  monthly: [
    { month: "2026-04", joined_earlier: 0, joined_this_month: 11, projected_joined_earlier: null, projected_joined_this_month: null, mau: 40, dau_avg: 9.2, dau_mau: 23 },
    { month: "2026-05", joined_earlier: 4, joined_this_month: 6, projected_joined_earlier: 12, projected_joined_this_month: 19, mau: 20, dau_avg: 7.5, dau_mau: 37.5 },
  ],
};

async function mount(data: TractionResponse) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  render(<TractionChart />);
  await act(async () => {});
}

describe("TractionChart", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("headline: all-time hours and students; none from an older pp-sketch", async () => {
    await mount(DATA);
    expect(screen.getByTestId("traction-hours").textContent).toBe("12,345");
    expect(screen.getByTestId("traction-students").textContent).toBe("678");
    cleanup();
    await mount({ ...DATA, totals: undefined });
    expect(screen.queryByTestId("traction-headline")).toBeNull();
  });

  it("opens on minutes spent as a daily line", async () => {
    await mount(DATA);
    expect(screen.getByRole("button", { name: "Minutes spent" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("traction-line")).toBeTruthy();
  });

  it("monthly: stacked bars with totals, the month in progress with a dashed projection", async () => {
    await mount(DATA);
    fireEvent.click(screen.getByRole("button", { name: "Monthly active students" }));
    expect(screen.getAllByTestId("traction-bar")).toHaveLength(2);
    expect(screen.getAllByTestId("traction-projection")).toHaveLength(1);
    expect(screen.getByText("11")).toBeTruthy();
    expect(screen.getByText("10 → ~31")).toBeTruthy();
    expect(screen.getByText("Projected by month end")).toBeTruthy();
  });

  it("monthly: says no data when pp-sketch has no monthly series yet", async () => {
    await mount({ ...DATA, monthly: undefined });
    fireEvent.click(screen.getByRole("button", { name: "Monthly active students" }));
    expect(screen.getByText("No data yet.")).toBeTruthy();
  });

  it("DAU / MAU: one bar per month, the month in progress lighter and without an estimate", async () => {
    await mount(DATA);
    fireEvent.click(screen.getByRole("button", { name: "DAU / MAU" }));
    expect(screen.getByTestId("traction-dau-mau")).toBeTruthy();
    expect(screen.getAllByTestId("traction-bar")).toHaveLength(2);
    // no month-end estimate: the month in progress is its figure so far, lighter
    expect(screen.queryByTestId("traction-projection")).toBeNull();
    expect(screen.queryByText("Estimated by month end")).toBeNull();
    expect(screen.getByText("23%")).toBeTruthy();
    expect(screen.getByText("38%")).toBeTruthy();
    expect(screen.getByText("This month so far")).toBeTruthy();
    const bars = screen.getAllByTestId("traction-bar").map((b) => b.querySelector("rect")!.getAttribute("class"));
    expect(bars).toEqual(["fill-brand-ink", "fill-brand-mute"]);
    expect(screen.getByText(/Monthly, India time/)).toBeTruthy();
  });

  it("DAU / MAU: says no data when pp-sketch does not serve it yet", async () => {
    await mount({ ...DATA, monthly: DATA.monthly!.map((m) => ({ month: m.month, joined_earlier: m.joined_earlier, joined_this_month: m.joined_this_month, projected_joined_earlier: m.projected_joined_earlier, projected_joined_this_month: m.projected_joined_this_month })) });
    fireEvent.click(screen.getByRole("button", { name: "DAU / MAU" }));
    expect(screen.getByText("No data yet.")).toBeTruthy();
    expect(screen.queryByTestId("traction-dau-mau")).toBeNull();
  });

  it("Download CSV saves every toggle's data as one file", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:x");
    const { createObjectURL: origCreate, revokeObjectURL: origRevoke } = URL;
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await mount(DATA);
    fireEvent.click(screen.getByTestId("traction-csv"));
    expect(click).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain("Date,Minutes spent,");
    expect(text).toContain("2026-05-10,45,");
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe("lifteracy-traction-2026-05-11.csv");
    click.mockRestore();
    Object.assign(URL, { createObjectURL: origCreate, revokeObjectURL: origRevoke });
  });

  it("no Download CSV without daily data", async () => {
    await mount({ ...DATA, daily: [] });
    expect(screen.queryByTestId("traction-csv")).toBeNull();
  });
});
