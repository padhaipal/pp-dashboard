import { describe, expect, it } from "vitest";
import { monthLabel, shortDate, TRACTION_METRICS } from "./traction-data";

describe("TRACTION_METRICS", () => {
  it("offers the ten series in the asked order, minutes first (the default)", () => {
    expect(TRACTION_METRICS.map((m) => m.key)).toEqual([
      "minutes",
      "users_over_5min",
      "students_onboarded",
      "mpl_b_passed",
      "teachers_onboarded",
      "schools",
      "blocks",
      "districts",
      "states",
      "monthly",
    ]);
  });
});

describe("shortDate", () => {
  it("formats an IST date as day + month", () => {
    expect(shortDate("2026-09-01")).toBe("1 Sep");
  });
  it("formats a month", () => {
    expect(monthLabel("2026-04")).toBe("Apr 2026");
  });
});
