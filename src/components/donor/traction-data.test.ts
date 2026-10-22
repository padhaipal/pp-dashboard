import { describe, expect, it } from "vitest";
import { shortDate, TRACTION_METRICS } from "./traction-data";

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
  it("draws only the cohort series as dots, with a note", () => {
    expect(TRACTION_METRICS.filter((m) => m.dots).map((m) => m.key)).toEqual(["cohort_avg_lifetime_hours"]);
    expect(TRACTION_METRICS.find((m) => m.dots)?.note).toMatch(/no student was onboarded/);
  });
});

describe("shortDate", () => {
  it("formats an IST date as day + month", () => {
    expect(shortDate("2026-09-01")).toBe("1 Sep");
  });
});
