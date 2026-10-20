import { describe, expect, it } from "vitest";
import { shortDate, smooth, TRACTION_METRICS } from "./traction-data";

describe("smooth", () => {
  it("is a trailing mean whose window shrinks at the start", () => {
    expect(smooth([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7]);
    expect(smooth([2, 4, 6], 1)).toEqual([2, 4, 6]);
    expect(smooth([2, 4, 6], 14)).toEqual([2, 3, 4]);
  });
  it("skips nulls; a window of nulls stays null", () => {
    expect(smooth([null, 4, null, null, null], 2)).toEqual([null, 4, 4, null, null]);
  });
});

describe("TRACTION_METRICS", () => {
  it("offers the ten series in the asked order", () => {
    expect(TRACTION_METRICS.map((m) => m.key)).toEqual([
      "users_over_5min",
      "minutes",
      "students_onboarded",
      "mpl_b_passed",
      "teachers_onboarded",
      "schools",
      "blocks",
      "districts",
      "states",
      "cohort_avg_lifetime_hours",
    ]);
  });
});

describe("shortDate", () => {
  it("formats an IST date as day + month", () => {
    expect(shortDate("2026-09-01")).toBe("1 Sep");
  });
});
