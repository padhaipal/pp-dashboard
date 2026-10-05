import { describe, expect, it } from "vitest";
import {
  ageBandLabel,
  ageBandOf,
  binColor,
  binOf,
  childFill,
  csvUrl,
  DEFAULT_METRIC,
  DEFAULT_TIME_WINDOW,
  fmtDuration,
  fmtMinutes,
  fmtPerDay,
  isTimeMode,
  METRIC_BY,
  passMarkOf,
  METRICS,
  scoreColor,
  scoresUrl,
  spotlightUrl,
  studentModalRows,
  TEST_KEY_OF,
  TIME_WINDOWS,
  timeColor,
  timeFill,
  timeWindowSuffix,
  UNCOVERED,
  usageColor,
  usageHistoryUrl,
  type MediaRow,
} from "./dashboard-types";
import { parseIncompleteStates } from "./incomplete-states";
import { jitterLatLng, JITTER_MAX_M } from "./map-helpers";

describe("bin → colour", () => {
  it("maps the three bins onto mvp2's scale and none onto UNCOVERED", () => {
    expect(binColor("high")).toBe("rgb(34,197,94)");
    expect(binColor("mid")).toBe("rgb(234,179,8)");
    expect(binColor("low")).toBe("rgb(239,68,68)");
    expect(binColor("none")).toBe(UNCOVERED);
    expect(binColor("high")).toBe(scoreColor(1));
    expect(binColor("low")).toBe(scoreColor(0));
  });

  it("bins pass rates at 80 / 50", () => {
    expect(binOf(80)).toBe("high");
    expect(binOf(79.9)).toBe("mid");
    expect(binOf(50)).toBe("mid");
    expect(binOf(49.9)).toBe("low");
    expect(binOf(null)).toBe("none");
  });

  it("area fill is grey when not using Lifteracy", () => {
    expect(childFill({ using_lifteracy: false, pass_rate: 90 })).toBe(UNCOVERED);
    expect(childFill({ using_lifteracy: true, pass_rate: null })).toBe(UNCOVERED);
    expect(childFill({ using_lifteracy: true, pass_rate: 100 })).toBe("rgb(34,197,94)");
  });
});

describe("incomplete states csv", () => {
  it("collects the distinct state codes", () => {
    const csv = "state_code,district_code,udise_name,reason\n12,1227,KEYI PANYOR,x\n12,1228,BICHOM,x\n28,2837,POLAVARAM,x\n";
    expect(parseIncompleteStates(csv)).toEqual(["12", "28"]);
  });
});

describe("school jitter", () => {
  it("is deterministic and within 300 m", () => {
    const [lat, lng] = jitterLatLng("SCH-1", 26.8, 80.9);
    expect(jitterLatLng("SCH-1", 26.8, 80.9)).toEqual([lat, lng]);
    const dLat = (lat - 26.8) * 111_320;
    const dLng = (lng - 80.9) * 111_320 * Math.cos((26.8 * Math.PI) / 180);
    expect(Math.hypot(dLat, dLng)).toBeLessThanOrEqual(JITTER_MAX_M + 1);
    expect(jitterLatLng("SCH-2", 26.8, 80.9)).not.toEqual([lat, lng]);
  });
});

describe("usage metric", () => {
  it("sits first in the toggle order, has no test history, and formats minutes", () => {
    expect(METRICS[0].key).toBe("usage");
    expect(METRICS.map((m) => m.key)).toEqual(["usage", "nipun_g2", "nipun_g3", "mpl_b"]);
    // the usage metric is called "Time" everywhere it is shown
    expect(METRIC_BY.usage.label).toBe("Time");
    expect(METRIC_BY.usage.short).toBe("Time");
    expect(DEFAULT_METRIC).toBe("usage");
    expect(TEST_KEY_OF.usage).toBeUndefined();
    expect(fmtMinutes(null)).toBe("—");
    expect(fmtMinutes(7.4)).toBe("7 min");
    // strictly more than 5 minutes is a pass
    expect(usageColor(5)).toBe("#f59e0b");
    expect(usageColor(5.1)).toBe("#16a34a");
    expect(usageColor(0)).toBe("#dc2626");
    expect(usageColor(null)).toBe("#dc2626");
  });
});

describe("pass marks and age bands", () => {
  it("NIPUN passes above 80, MPL-B above 50; bands are the whole ages covered; the response's values win", () => {
    expect(passMarkOf("nipun_g2")).toBe(80);
    expect(passMarkOf("nipun_g3")).toBe(80);
    expect(passMarkOf("mpl_b")).toBe(50);
    expect(passMarkOf("usage")).toBeNull();
    expect(passMarkOf("mpl_b", 60)).toBe(60);
    expect(passMarkOf("mpl_b", null)).toBe(50);
    expect(ageBandOf("nipun_g2")).toEqual([7, 9]);
    expect(ageBandOf("mpl_b", [9, 11])).toEqual([9, 11]);
    expect(ageBandOf("usage")).toBeNull();
    // the headline names one age: the band's lower bound
    expect(ageBandLabel([7, 9])).toBe("7");
    expect(ageBandLabel([8, 10])).toBe("8");
    expect(ageBandLabel([8, 9])).toBe("8");
  });
});

describe("Time windows", () => {
  it("offers yesterday / last seven days / all time, defaulting to all time", () => {
    expect(TIME_WINDOWS.map((w) => [w.key, w.label])).toEqual([
      ["yesterday", "Yesterday"],
      ["7d", "Last seven days"],
      ["all", "All time"],
    ]);
    expect(DEFAULT_TIME_WINDOW).toBe("all");
    expect(timeWindowSuffix("7d")).toBe("last seven days");
    expect(timeWindowSuffix("yesterday")).toBe("yesterday");
    expect(timeWindowSuffix("all", (s) => s.toUpperCase())).toBe("ALL TIME");
  });

  it("totals: whole minutes up to 119, hours from 120 minutes up", () => {
    expect(fmtDuration(null)).toBe("—");
    expect(fmtDuration(undefined)).toBe("—");
    expect(fmtDuration(0)).toBe("0 min");
    expect(fmtDuration(45.4)).toBe("45 min");
    expect(fmtDuration(119)).toBe("119 min");
    expect(fmtDuration(119.4)).toBe("119 min");
    expect(fmtDuration(119.6)).toBe("2 hours");
    expect(fmtDuration(120)).toBe("2 hours");
    expect(fmtDuration(150)).toBe("2.5 hours");
    expect(fmtDuration(1500)).toBe("25 hours");
    expect(fmtDuration(6000)).toBe("100 hours");
    // units go through the translator
    expect(fmtDuration(45, (s) => (s === "min" ? "मिनट" : s))).toBe("45 मिनट");
    expect(fmtDuration(150, (s) => (s === "hours" ? "घंटे" : s))).toBe("2.5 घंटे");
  });

  it("averages are always minutes per day, never hours", () => {
    expect(fmtPerDay(null)).toBe("—");
    expect(fmtPerDay(0)).toBe("0 min per day");
    expect(fmtPerDay(0.44)).toBe("0.4 min per day");
    expect(fmtPerDay(5.4)).toBe("5.4 min per day");
    expect(fmtPerDay(9.96)).toBe("10 min per day");
    expect(fmtPerDay(12.4)).toBe("12 min per day");
    expect(fmtPerDay(300)).toBe("300 min per day");
  });

  it("colour follows the average per day: green past 5, amber for some, red for none, grey when nothing to average", () => {
    expect(timeColor(5.1)).toBe("#16a34a");
    expect(timeColor(5)).toBe("#f59e0b");
    expect(timeColor(0.1)).toBe("#f59e0b");
    expect(timeColor(0)).toBe("#dc2626");
    expect(timeColor(null)).toBe(UNCOVERED);
    expect(timeColor(undefined)).toBe(UNCOVERED);
    expect(timeFill({ using_lifteracy: true, time_per_day: 7 })).toBe("#16a34a");
    expect(timeFill({ using_lifteracy: true, time_per_day: null })).toBe(UNCOVERED);
    expect(timeFill({ using_lifteracy: false, time_per_day: 7 })).toBe(UNCOVERED);
  });

  it("the window is sent only with the Time metric", () => {
    expect(scoresUrl("g1", "usage", 30, "7d")).toBe("/api/proxy/geo-entities/g1/scores?metric=usage&range=30&window=7d");
    expect(spotlightUrl("g1", "usage", "all", "yesterday")).toBe("/api/proxy/geo-entities/g1/spotlight?metric=usage&range=all&window=yesterday");
    expect(csvUrl("g1", "usage", 30, "all")).toBe("/api/proxy/geo-entities/g1/scores.csv?metric=usage&range=30&window=all");
    expect(scoresUrl("g1", "nipun_g3", 30, "7d")).toBe("/api/proxy/geo-entities/g1/scores?metric=nipun_g3&range=30");
    expect(scoresUrl("g1", "usage", 30)).toBe("/api/proxy/geo-entities/g1/scores?metric=usage&range=30");
    expect(usageHistoryUrl("s 1", "all")).toBe("/api/proxy/users/s%201/usage-history?range=all");
  });

  it("Time mode = pp-sketch echoed the window on a usage response", () => {
    expect(isTimeMode({ metric: "usage", window: "7d" })).toBe(true);
    expect(isTimeMode({ metric: "usage" })).toBe(false);
    expect(isTimeMode({ metric: "nipun_g3", window: "7d" })).toBe(false);
    expect(isTimeMode(null)).toBe(false);
  });
});

describe("studentModalRows", () => {
  const row = (over: Partial<MediaRow>): MediaRow => ({ id: "x", created_at: "2026-09-30T10:00:00Z", has_audio: true, answer: null, answer_correct: null, ...over });

  it("keeps voice notes (assessed or not) and answered taps; drops onboarding rows and taps that were not awaited", () => {
    const rows = [
      row({ id: "legacy" }), // no kind → a voice note from an older pp-sketch
      row({ id: "voice", kind: "voice", answer_correct: true }),
      row({ id: "tap-right", kind: "tap", answer_correct: true }),
      row({ id: "tap-wrong", kind: "tap", answer_correct: false }),
      row({ id: "tap-ignored", kind: "tap", answer_correct: null }),
      row({ id: "onboarding", kind: "onboarding" }),
    ];
    expect(studentModalRows(rows).map((r) => r.id)).toEqual(["legacy", "voice", "tap-right", "tap-wrong"]);
    expect(studentModalRows([])).toEqual([]);
  });
});
