// Guards the committed boundary files against state-code mislabels. build.py
// once keyed state files by the LGD layer's own codes: Andhra Pradesh's
// polygon shipped as 37, Ladakh's as 38, DNH&DD's as 39, and no 28 existed.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "public", "boundaries");

// UDISE state/UT codes: 01–38 minus 25/26 (merged into 38 in 2020).
const UDISE_STATES = Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, "0")).filter(
  (c) => c !== "25" && c !== "26",
);

type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

type Geometry = { coordinates?: unknown; geometries?: Geometry[] };

function readFeature(type: string, code: string) {
  const fc = JSON.parse(fs.readFileSync(path.join(DIR, type, `${code}.geojson`), "utf8"));
  return fc.features[0] as { properties: { code: string }; geometry: Geometry };
}

// make_valid leaves a few GeometryCollections.
const coordsOf = (g: Geometry): unknown => g.coordinates ?? g.geometries!.map(coordsOf);

function bbox(coords: unknown, box: BBox = [Infinity, Infinity, -Infinity, -Infinity]): BBox {
  if (typeof (coords as number[])[0] === "number") {
    const [lng, lat] = coords as number[];
    return [Math.min(box[0], lng), Math.min(box[1], lat), Math.max(box[2], lng), Math.max(box[3], lat)];
  }
  return (coords as unknown[]).reduce<BBox>((b, c) => bbox(c, b), box);
}

function csvRows(file: string): string[][] {
  return fs
    .readFileSync(path.join(DIR, file), "utf8")
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => l.split(","));
}

describe("public/boundaries", () => {
  it("has exactly one state file per UDISE state code, each labelled with its own code", () => {
    const files = fs.readdirSync(path.join(DIR, "state")).map((f) => f.replace(".geojson", ""));
    expect(files.sort()).toEqual(UDISE_STATES);
    const manifest = csvRows("boundaries_manifest.csv").filter((r) => r[0] === "state");
    expect(manifest.map((r) => r[1]).sort()).toEqual(UDISE_STATES);
    for (const code of UDISE_STATES) expect(readFeature("state", code).properties.code).toBe(code);
  });

  it("every district polygon lies inside its own state's polygon (bbox)", () => {
    const TOL = 0.05; // degrees; simplification noise
    const states = new Map(UDISE_STATES.map((c) => [c, bbox(coordsOf(readFeature("state", c).geometry))]));
    const outside: string[] = [];
    for (const [stateCode, districtCode] of csvRows("boundaries_district_crosswalk.csv")) {
      const s = states.get(stateCode)!;
      const d = bbox(coordsOf(readFeature("district", districtCode).geometry));
      if (d[0] < s[0] - TOL || d[1] < s[1] - TOL || d[2] > s[2] + TOL || d[3] > s[3] + TOL) {
        outside.push(`${districtCode} ∉ ${stateCode}`);
      }
    }
    expect(outside).toEqual([]);
  });
});
