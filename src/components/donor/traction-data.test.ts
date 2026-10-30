import { describe, expect, it } from "vitest";
import { monthLabel, shortDate, TRACTION_METRICS, tractionCsv, tractionCsvFilename, type TractionResponse } from "./traction-data";

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

describe("tractionCsv", () => {
  const day = (date: string, minutes: number) => ({ date, users_over_5min: 2, minutes, students_onboarded: 3, mpl_b_passed: 1, teachers_onboarded: 4, schools: 5, blocks: 6, districts: 7, states: 8 });
  const DATA: TractionResponse = {
    from: "2026-04-01",
    to: "2026-05-01",
    computed_at: "2026-05-02T00:00:00Z",
    daily: [day("2026-03-31", 0), day("2026-04-30", 12.5), day("2026-05-01", 30)],
    monthly: [
      { month: "2026-04", joined_earlier: 0, joined_this_month: 11, projected_joined_earlier: null, projected_joined_this_month: null },
      { month: "2026-05", joined_earlier: 4, joined_this_month: 6, projected_joined_earlier: 12, projected_joined_this_month: 19 },
    ],
  };

  it("one row per day with every toggle: daily series, then the day's month", () => {
    const [header, ...rows] = tractionCsv(DATA).trimEnd().split("\n");
    expect(header).toBe(
      "Date,Minutes spent,Users over 5 min,Students onboarded,Passed MPL-B,Teachers onboarded,Schools,Blocks,Districts,States," +
        "Monthly active students (whole month),Monthly active students: joined in an earlier month,Monthly active students: joined this month,Monthly active students: projected by month end",
    );
    expect(rows).toEqual([
      "2026-03-31,0,2,3,1,4,5,6,7,8,,,,",
      "2026-04-30,12.5,2,3,1,4,5,6,7,8,11,0,11,",
      "2026-05-01,30,2,3,1,4,5,6,7,8,10,4,6,31",
    ]);
  });

  it("no monthly series (older pp-sketch): monthly columns blank", () => {
    const rows = tractionCsv({ ...DATA, monthly: undefined }).trimEnd().split("\n");
    expect(rows[3]).toBe("2026-05-01,30,2,3,1,4,5,6,7,8,,,,");
  });

  it("is named after the day pp-sketch computed it", () => {
    expect(tractionCsvFilename(DATA)).toBe("lifteracy-traction-2026-05-02.csv");
  });
});
