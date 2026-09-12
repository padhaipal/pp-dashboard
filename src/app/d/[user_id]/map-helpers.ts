// Planar geometry helpers for the d3 + SVG map (ported from mvp2.html).
// Everything works on PROJECTED rings so polygon winding never matters.

import { geoMercator, type GeoProjection } from "d3";

export type Ring = [number, number][];
export type Feature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] } | null;
};
export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

type Proj = (c: [number, number]) => [number, number] | null;

const polysOf = (g: Feature["geometry"]): number[][][][] =>
  !g ? [] : g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];

export const stripClose = (r: Ring): Ring =>
  r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;

export const ringArea = (r: Ring): number => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s / 2;
};

export function bboxOf(r: Ring): [number, number, number, number] {
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity;
  for (const p of r) {
    if (p[0] < a) a = p[0];
    if (p[1] < b) b = p[1];
    if (p[0] > c) c = p[0];
    if (p[1] > d) d = p[1];
  }
  return [a, b, c, d];
}

export function unionBbox(boxes: [number, number, number, number][]): [number, number, number, number] {
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity;
  for (const [a, b, c, d] of boxes) {
    if (a < minx) minx = a;
    if (b < miny) miny = b;
    if (c > maxx) maxx = c;
    if (d > maxy) maxy = d;
  }
  return [minx, miny, maxx, maxy];
}

export const centroidOf = (ring: Ring): [number, number] => {
  let x = 0,
    y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  const n = ring.length || 1;
  return [x / n, y / n];
};

const projectRing = (ring: number[][], proj: Proj): Ring =>
  ring
    .map((c) => proj([c[0], c[1]]))
    .filter((p): p is [number, number] => !!p && !isNaN(p[0]) && !isNaN(p[1]));

// largest exterior ring of a feature, projected
export function largestRing(feature: Feature, proj: Proj): Ring {
  let best: Ring | null = null,
    bestA = -1;
  for (const poly of polysOf(feature.geometry)) {
    const pr = projectRing(poly[0], proj);
    if (pr.length < 3) continue;
    const a = Math.abs(ringArea(pr));
    if (a > bestA) {
      bestA = a;
      best = pr;
    }
  }
  return best || [];
}

// every exterior ring of a feature, projected (multi-part regions: enclaves, islands)
export function exteriorRings(feature: Feature, proj: Proj): Ring[] {
  const out: Ring[] = [];
  for (const poly of polysOf(feature.geometry)) {
    const pr = stripClose(projectRing(poly[0], proj));
    if (pr.length >= 3) out.push(pr);
  }
  return out;
}

export const toPath = (poly: Ring) => "M" + poly.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L") + "Z";
export const ringsToPath = (rings: Ring[]) => rings.map(toPath).join(" ");

// manual mercator fit using PROJECTED bounds of raw coords (not geoBounds), rotated
// to the features' circular-mean longitude so antimeridian spans never straddle the seam.
export function fitMercator(features: Feature[], w: number, h: number, pad: number): GeoProjection | null {
  let sx = 0,
    sy = 0,
    nC = 0;
  for (const f of features) {
    for (const poly of polysOf(f.geometry))
      for (const ring of poly)
        for (const c of ring) {
          const r = (c[0] * Math.PI) / 180;
          sx += Math.cos(r);
          sy += Math.sin(r);
          nC++;
        }
  }
  const meanLon = nC ? (Math.atan2(sy, sx) * 180) / Math.PI : 0;
  const proj = geoMercator().rotate([-meanLon, 0]).scale(1).translate([0, 0]);
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity;
  for (const f of features) {
    for (const poly of polysOf(f.geometry))
      for (const ring of poly)
        for (const c of ring) {
          const p = proj([c[0], c[1]]);
          if (!p || isNaN(p[0])) continue;
          if (p[0] < minx) minx = p[0];
          if (p[1] < miny) miny = p[1];
          if (p[0] > maxx) maxx = p[0];
          if (p[1] > maxy) maxy = p[1];
        }
  }
  if (!isFinite(minx)) return null;
  const bw = Math.max(1e-9, maxx - minx),
    bh = Math.max(1e-9, maxy - miny);
  const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
  proj.scale(s).translate([(w - s * (minx + maxx)) / 2, (h - s * (miny + maxy)) / 2]);
  return proj;
}

// planar km² from lon/lat rings (cos-lat corrected) — winding-independent
export function planarAreaKm2(feature: Feature): number {
  let total = 0;
  for (const poly of polysOf(feature.geometry)) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    let s = 0,
      latSum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      s += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      latSum += ring[i][1];
    }
    total += Math.abs(s / 2) * Math.cos(((latSum / ring.length) * Math.PI) / 180);
  }
  return total * 111.32 * 110.57;
}

// A tiny polygon feature around a set of lon/lat points so fitMercator can frame
// levels that have no boundary polygon (block level with only school points).
export function pointsFeature(points: [number, number][]): Feature | null {
  if (!points.length) return null;
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity;
  for (const [x, y] of points) {
    if (x < minx) minx = x;
    if (y < miny) miny = y;
    if (x > maxx) maxx = x;
    if (y > maxy) maxy = y;
  }
  // at least ~1 km of extent so a single point still frames
  const padX = Math.max(0.005, (maxx - minx) * 0.1),
    padY = Math.max(0.005, (maxy - miny) * 0.1);
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [minx - padX, miny - padY],
          [maxx + padX, miny - padY],
          [maxx + padX, maxy + padY],
          [minx - padX, maxy + padY],
          [minx - padX, miny - padY],
        ],
      ],
    },
  };
}

// ------------------------------------------------------------------ jitter

// 32-bit string hash (used ONLY for the deterministic school jitter below).
export function codeHash(s: string): number {
  let h1 = 0xdeadbeef ^ s.length,
    h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return h1 >>> 0;
}

export const JITTER_MAX_M = 300;

// Schools without coordinates plot at the block's point, offset by a deterministic
// jitter (hash of the school code) of at most JITTER_MAX_M metres.
export function jitterLatLng(code: string, lat: number, lng: number): [number, number] {
  const h = codeHash(code);
  const angle = ((h % 3600) / 3600) * 2 * Math.PI;
  const dist = (((h >>> 12) % 1000) / 1000) * JITTER_MAX_M;
  const dLat = (dist * Math.cos(angle)) / 111_320;
  const dLng = (dist * Math.sin(angle)) / (111_320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return [lat + dLat, lng + dLng];
}

export const boundaryUrl = (type: "country" | "state" | "district", code: string) =>
  `/boundaries/${type}/${encodeURIComponent(code)}.geojson`;
