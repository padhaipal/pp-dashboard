import { describe, expect, it } from "vitest";
import { binColor, binOf, childFill, scoreColor, UNCOVERED } from "./dashboard-types";
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
