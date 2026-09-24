// Shared fixtures for the /d/[user_id] tests: a country-level profile, a scores
// payload with two child states (09 complete, 28 incomplete) and tiny GeoJSON
// squares standing in for the real boundary files.

import type { Child, PublicProfile, ScoresResponse, SpotlightResponse, StudentChild } from "./dashboard-types";

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
    { date: "2026-09-08", pass_rate: 70.0, n: 20, mean: 68.0 },
    { date: "2026-09-09", pass_rate: 71.0, n: 21, mean: 69.0 },
    { date: "2026-09-10", pass_rate: 72.0, n: 41, mean: 70.0 },
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

// School level: a teacher whose entity is a school; children are students.
export const PROFILE_SCHOOL: PublicProfile = {
  ...PROFILE,
  id: "u-sch",
  name: "Tom",
  role_title: "Teacher",
  geo_entity: { id: "g-sch", type: "school", code: "09010100101", name: "JHS CHINHAT", has_boundary: false, lat: 26.9, lng: 81.0 },
  ancestors: [
    { id: "g-in", type: "country", code: "IN", name: "India" },
    { id: "g-09", type: "state", code: "09", name: "UTTAR PRADESH" },
  ],
};

// The school's children are its teachers (the referrers of its students)…
export const TEACHER: Child = {
  id: "t-1",
  type: "teacher",
  code: "",
  name: "Asha",
  has_boundary: false,
  lat: null,
  lng: null,
  pass_rate: 75.0,
  n: 4,
  students: 4,
  students_active: 3,
  using_lifteracy: true,
  delta: 2.0,
  bin: "mid",
  official: { name: "Asha", role_title: "Teacher", avatar_seed: "asha", spotlight_message: null },
};

export const SCORES_SCHOOL: ScoresResponse = {
  as_of: "2026-09-18",
  metric: "nipun_g3",
  range: 30,
  entity: PROFILE_SCHOOL.geo_entity!,
  root: { pass_rate: 75.0, mean: 0.7, sd: 0.1, n: 4, students_active: 3, students_unbanded: 0, delta: 2.0 },
  series: [{ date: "2026-09-18", pass_rate: 75.0, n: 4, mean: 70.0 }],
  child_type: "teacher",
  children: [TEACHER],
  most_improved: [],
};

// …and a teacher's children (scores?id=<teacher user id>) are their students.
export const STUDENTS: StudentChild[] = [
  { student_id: "s-1", label: "Rani", name: "Rani Devi", score: 0.9, passed: true, attempts: 22, in_band: true, active: true, last_active_at: "2026-09-17T10:00:00Z", delta: 5.0 },
  { student_id: "s-2", label: "Student 2", name: null, score: null, passed: null, attempts: 3, in_band: false, active: false, last_active_at: null, delta: null },
];

export const SCORES_CLASS: ScoresResponse = {
  as_of: "2026-09-18",
  metric: "nipun_g3",
  range: 30,
  entity: { id: "t-1", type: "teacher", code: "", name: "Asha", has_boundary: false, lat: null, lng: null },
  root: { pass_rate: 100.0, mean: 0.9, sd: 0, n: 1, students_active: 1, students_unbanded: 0, delta: null },
  series: [{ date: "2026-09-18", pass_rate: 100.0, n: 1, mean: 90.0 }],
  students_series: [
    { student_id: "s-1", points: [{ date: "2026-09-18", value: 90 }] },
    { student_id: "s-2", points: [{ date: "2026-09-18", value: null }] },
  ],
  child_type: "student",
  children: STUDENTS,
  most_improved: [],
};

// Student modal payloads (GET users/:id/literacy-test-scores, GET users/:id/media).
export const TEST_SCORES = {
  nipun_grade_2: { status: "insufficient_data", attempts_available: 0 },
  nipun_grade_3: {
    status: "ok",
    attempts_available: 22,
    latest: { at: "2026-09-17T10:00:00Z", score: 0.9, passed: true },
    history: [
      { at: "2026-09-10T10:00:00Z", score: 0.5, passed: false },
      { at: "2026-09-17T10:00:00Z", score: 0.9, passed: true },
    ],
  },
  mpl_b: { status: "insufficient_data", attempts_available: 20 },
};

export const MEDIA = {
  user: { name: "Rani Devi" },
  media: [
    { id: "m-1", created_at: new Date(Date.now() - 2 * 3600_000).toISOString(), has_audio: true, answer: "घर", answer_correct: true },
    { id: "m-2", created_at: new Date(Date.now() - 26 * 3600_000).toISOString(), has_audio: false, answer: "मछली", answer_correct: false },
  ],
};

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
  "/boundaries/district/0901.geojson": square("0901", "LUCKNOW", "district", 80.5, 26.5),
};

// State level (UP): one district whose seed-time `has_boundary` is stale
// (false) although its polygon file exists, and no lat/lng (hierarchy rows
// never carry one) — it must still draw.
export const SCORES_UP: ScoresResponse = {
  ...SCORES,
  entity: CHILD_UP,
  child_type: "district",
  children: [{ ...CHILD_UP, id: "g-0901", type: "district", code: "0901", name: "LUCKNOW", has_boundary: false, lat: null, lng: null }],
  most_improved: [],
};

export function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

// Routes proxy + boundary URLs to fixtures; records every URL hit. `scores`
// answers the country root (g-in); `scoresById` answers any other entity.
export function makeFetch(opts: { scores?: ScoresResponse; scoresById?: Record<string, ScoresResponse> } = {}) {
  const calls: string[] = [];
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push((init?.method ? init.method + " " : "") + url);
    const path = url.split("?")[0];
    if (path in GEO) return jsonResponse(200, GEO[path]);
    if (/^\/api\/proxy\/geo-entities\/g-in\/scores$/.test(path)) return jsonResponse(200, opts.scores ?? SCORES);
    if (/^\/api\/proxy\/geo-entities\/g-in\/spotlight$/.test(path)) return jsonResponse(200, SPOTLIGHT);
    const m = path.match(/^\/api\/proxy\/geo-entities\/([^/]+)\/scores$/);
    if (m && opts.scoresById && m[1] in opts.scoresById) return jsonResponse(200, opts.scoresById[m[1]]);
    if (/^\/api\/proxy\/geo-entities\/[^/]+\/spotlight$/.test(path)) return jsonResponse(200, { top: null, most_improved: null });
    // student modal
    if (/^\/api\/proxy\/users\/[^/]+\/literacy-test-scores$/.test(path)) return jsonResponse(200, TEST_SCORES);
    if (/^\/api\/proxy\/users\/[^/]+\/media$/.test(path)) return jsonResponse(200, MEDIA);
    // letter-score chart (default modal view): no rows → "No scores recorded"
    if (/^\/api\/proxy\/users\/[^/]+\/scores$/.test(path)) return jsonResponse(200, []);
    if (/^\/api\/proxy\/scores\/letter-bins$/.test(path)) return jsonResponse(200, []);
    // student rename (PATCH users/:id/profile { name }) → { id, name }
    const p = path.match(/^\/api\/proxy\/users\/([^/]+)\/profile$/);
    if (p && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body ?? "{}")) as { name?: string };
      return jsonResponse(200, { id: p[1], name: body.name });
    }
    return jsonResponse(404, { message: `unmocked ${url}` });
  };
  return { fn, calls };
}
