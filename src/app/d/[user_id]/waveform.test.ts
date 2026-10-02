import { describe, expect, it } from "vitest";
import { fmtClipDuration, waveformBars } from "./waveform";

describe("waveformBars", () => {
  it("is deterministic per seed, differs between seeds, and stays within (0, 1]", () => {
    const a = waveformBars("m-1");
    expect(waveformBars("m-1")).toEqual(a);
    expect(waveformBars("m-2")).not.toEqual(a);
    expect(a).toHaveLength(28);
    for (const h of a) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(1);
    }
    expect(waveformBars("x", 5)).toHaveLength(5);
  });
});

describe("fmtClipDuration", () => {
  it("m:ss from milliseconds, rounded; — when unknown", () => {
    expect(fmtClipDuration(7400)).toBe("0:07");
    expect(fmtClipDuration(61_600)).toBe("1:02");
    expect(fmtClipDuration(0)).toBe("0:00");
    expect(fmtClipDuration(null)).toBe("—");
    expect(fmtClipDuration(undefined)).toBe("—");
    expect(fmtClipDuration(-5)).toBe("—");
  });
});
