// Shared fixtures for the /d/[user_id] tests: a country-level profile, a scores
// payload with two child states (09 complete, 28 incomplete) and tiny GeoJSON
// squares standing in for the real boundary files.

import type { Child, PublicProfile, ScoresResponse, SpotlightResponse } from "./dashboard-types";

export const PROFILE: PublicProfile = {
  id: "u1",
  name: "Asha Verma",
  role_title: "Minister",
  avatar_seed: "seed-1",
  spotlight_message: null,
  geo_entity: { id: "g-in", type: "country", code: "IN", name: "India", has_boundary: true, lat: null, lng: null },
  ancestors: [],
  share_link: "https://lifteracy.ai/d/u1",
  explainer_url: "https://example.com/explainer",
};

export const CHILD_UP: Child = {
  id: "g-09",
  type: "state",
  code: "09",
  name: "Uttar Pradesh",
  has_boundary: true,
  lat: 26.8,
  lng: 80.9,
  pass_rate: 72.0,
  n: 30,
  students_active: 120,
  using_lifteracy: true,
  delta: 2.5,
  bin: "mid",
  official: { name: "R. Singh", role_title: "DGSE", avatar_seed: "seed-up", spotlight_message: "Daily practice works." },
};

export const CHILD_AP: Child = {
  id: "g-28",
  type: "state",
  code: "28",
  name: "Andhra Pradesh",
  has_boundary: true,
  lat: 15.9,
  lng: 79.7,
  pass_rate: 60.0,
  n: 11,
  students_active: 40,
  using_lifteracy: true,
  delta: -1.0,
  bin: "mid",
  official: null,
};

export const SCORES: ScoresResponse = {
  as_of: "2026-09-10",
  metric: "nipun_g3",
  range: 30,
  entity: PROFILE.geo_entity!,
  root: { pass_rate: 72.0, mean: 0.7, sd: 0.1, n: 41, students_active: 160, students_unbanded: 3, delta: 1.5 },
  series: [
    { date: "2026-09-08", pass_rate: 70.0, n: 20 },
    { date: "2026-09-09", pass_rate: 71.0, n: 21 },
    { date: "2026-09-10", pass_rate: 72.0, n: 41 },
  ],
  child_type: "state",
  children: [CHILD_UP, CHILD_AP],
  most_improved: [CHILD_UP],
};

export const EMPTY_SCORES: ScoresResponse = {
  as_of: null,
  metric: "nipun_g3",
  range: 30,
  entity: PROFILE.geo_entity!,
  root: { pass_rate: null, mean: null, sd: null, n: null, students_active: null, students_unbanded: null, delta: null },
  series: [],
  child_type: "state",
  children: [],
  most_improved: [],
};

export const SPOTLIGHT: SpotlightResponse = { top: { child: CHILD_UP, official: CHILD_UP.official }, most_improved: null };

const square = (code: string, name: string, type: string, x: number, y: number) => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { code, name, type },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [x, y],
            [x + 2, y],
            [x + 2, y + 2],
            [x, y + 2],
            [x, y],
          ],
        ],
      },
    },
  ],
});

export const GEO: Record<string, unknown> = {
  "/boundaries/country/IN.geojson": square("IN", "India", "country", 76, 14),
  "/boundaries/state/09.geojson": square("09", "Uttar Pradesh", "state", 80, 26),
  "/boundaries/state/28.geojson": square("28", "Andhra Pradesh", "state", 78, 15),
};

export function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

// Routes proxy + boundary URLs to fixtures; records every URL hit.
export function makeFetch(opts: { scores?: ScoresResponse } = {}) {
  const calls: string[] = [];
  const fn = async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    const path = url.split("?")[0];
    if (path in GEO) return jsonResponse(200, GEO[path]);
    if (/^\/api\/proxy\/geo-entities\/g-in\/scores$/.test(path)) return jsonResponse(200, opts.scores ?? SCORES);
    if (/^\/api\/proxy\/geo-entities\/g-in\/spotlight$/.test(path)) return jsonResponse(200, SPOTLIGHT);
    return jsonResponse(404, { message: `unmocked ${url}` });
  };
  return { fn, calls };
}
