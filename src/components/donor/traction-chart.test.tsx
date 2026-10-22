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
  monthly: [
    { month: "2026-04", joined_earlier: 0, joined_this_month: 11, projected_joined_earlier: null, projected_joined_this_month: null },
    { month: "2026-05", joined_earlier: 4, joined_this_month: 6, projected_joined_earlier: 12, projected_joined_this_month: 19 },
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
});
