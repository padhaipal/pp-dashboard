// Shared fixtures for the /d/[user_id] tests: a country-level profile, a scores
// payload with two child states (09 complete, 28 incomplete) and tiny GeoJSON
// squares standing in for the real boundary files.

import type { Child, PublicProfile, ScoresResponse, SpotlightResponse, StudentChild, TimeWindow, UsageHistory } from "./dashboard-types";

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
  age_band: [8, 10],
  pass_mark: 75,
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
  // one faint line per state on the trend
  children_series: [
    { id: CHILD_UP.id, points: [{ date: "2026-09-08", value: 80 }, { date: "2026-09-10", value: 82 }] },
    { id: CHILD_AP.id, points: [{ date: "2026-09-09", value: 60 }, { date: "2026-09-10", value: 58 }] },
  ],
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

// A block official (BEO): the page opens on their DISTRICT, among the peer blocks.
export const PROFILE_BLOCK: PublicProfile = {
  ...PROFILE,
  id: "u-beo",
  name: "Meena",
  role_title: "BEO",
  geo_entity: { id: "g-0901-01", type: "block", code: "090101", name: "KAKORI", has_boundary: false, lat: null, lng: null },
  ancestors: [
    { id: "g-in", type: "country", code: "IN", name: "India" },
    { id: "g-09", type: "state", code: "09", name: "UTTAR PRADESH" },
    { id: "g-0901", type: "district", code: "0901", name: "LUCKNOW" },
  ],
};

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
  // phone masked: the link holder (Tom, a fellow teacher) is not directly above Asha
  official: { id: "t-1", name: "Asha", role_title: "Teacher", avatar_seed: "asha", spotlight_message: null, phone: "9...2", pii: "masked" },
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
  { student_id: "s-1", label: "Rani", phone: "919999990011", name: "Rani Devi", pii: "full", score: 0.9, passed: true, attempts: 22, in_band: true, active: true, last_active_at: "2026-09-17T10:00:00Z", delta: 5.0 },
  { student_id: "s-2", label: "Student 2", phone: "919999990022", name: null, pii: "full", score: null, passed: null, attempts: 3, in_band: false, active: false, last_active_at: null, delta: null },
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
  nipun_grade_2: { status: "insufficient_data", attempts_available: 0, counted_message_ids: [] },
  nipun_grade_3: {
    status: "ok",
    attempts_available: 22,
    latest: { at: "2026-09-17T10:00:00Z", score: 0.9, passed: true },
    history: [
      { at: "2026-09-10T10:00:00Z", score: 0.5, passed: false },
      { at: "2026-09-17T10:00:00Z", score: 0.9, passed: true },
    ],
    // m-3 is the one listed tap that counted; m-4 was never awaited (not listed)
    counted_message_ids: ["m-3", "m-4", "m-old"],
  },
  // one answer so far (the tap m-3), 20 needed
  mpl_b: { status: "insufficient_data", attempts_available: 1, counted_message_ids: ["m-3"] },
};

export const MEDIA = {
  user: { name: "Rani Devi", pii: "full" as const },
  media: [
    { id: "m-1", created_at: new Date(Date.now() - 2 * 3600_000).toISOString(), has_audio: true, duration_ms: 7400, answer: "घर", answer_correct: true },
    { id: "m-2", created_at: new Date(Date.now() - 26 * 3600_000).toISOString(), has_audio: false, answer: "मछली", answer_correct: false },
    // a comprehension flow tap: no recording, the question and the option chosen
    {
      id: "m-3",
      kind: "tap",
      created_at: new Date(Date.now() - 27 * 3600_000).toISOString(),
      has_audio: false,
      answer: "स्कूल",
      answer_correct: false,
      tap: { question: "कमल कहाँ गया?", chosen: "बाज़ार", correct: "स्कूल" },
    },
    // a tap the lesson was not waiting for — never listed
    { id: "m-4", kind: "tap", created_at: new Date(Date.now() - 28 * 3600_000).toISOString(), has_audio: false, answer: "नदी", answer_correct: null, tap: { question: "पुराना सवाल", chosen: "पहाड़", correct: "नदी" } },
    // an onboarding voice note must never be listed here, even if one arrived
    { id: "m-5", kind: "onboarding", created_at: new Date(Date.now() - 29 * 3600_000).toISOString(), has_audio: true, answer: null, answer_correct: null },
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

// ---- Time (usage with a window) ----
// Per-window figures as pp-sketch returns them in Time mode: per student for
// areas, the student's own for the class view; no deltas, no most improved.
const TIME_BY_WINDOW: Record<TimeWindow, { root: [number, number, number]; up: [number, number, number]; ap: [number, number, number]; s1: [number, number, number]; s2: [number, number, number] }> = {
  yesterday: { root: [4, 4, 1], up: [6, 6, 1], ap: [0, 0, 1], s1: [12, 12, 1], s2: [0, 0, 1] },
  "7d": { root: [38, 5.4, 7], up: [49, 7, 7], ap: [14, 2, 7], s1: [84, 12, 7], s2: [3, 0.4, 7] },
  "30d": { root: [90, 3, 30], up: [130, 4.3, 30], ap: [40, 1.3, 30], s1: [100, 3.3, 30], s2: [20, 0.7, 30] },
  all: { root: [150, 3.1, 48], up: [1500, 31.3, 48], ap: [120, 2.5, 48], s1: [119, 2.5, 48], s2: [120, 2.5, 48] },
};
// time_sum (the total over every student) = time_total in these fixtures, so the figures asserted stay the same
const tf = ([time_total, time_per_day, time_days]: [number, number, number]) => ({ time_total, time_per_day, time_days, time_sum: time_total });

export function timeScores(window: TimeWindow): ScoresResponse {
  const w = TIME_BY_WINDOW[window];
  return {
    ...SCORES,
    metric: "usage",
    window,
    root: { ...SCORES.root, delta: 2, ...tf(w.root) },
    // deltas = minutes vs the window before; only a rise ranks as most improved
    children: [
      { ...CHILD_UP, delta: 7, bin: "high", ...tf(w.up) },
      { ...CHILD_AP, delta: -2, bin: "mid", ...tf(w.ap) },
    ],
    most_improved: [{ ...CHILD_UP, delta: 7, bin: "high", ...tf(w.up) }],
    time_delta_days: window === "yesterday" ? 1 : 7,
  };
}

export function timeScoresClass(window: TimeWindow): ScoresResponse {
  const w = TIME_BY_WINDOW[window];
  return {
    ...SCORES_CLASS,
    metric: "usage",
    window,
    root: { ...SCORES_CLASS.root, delta: 3, ...tf(w.root) },
    children: [
      { ...STUDENTS[0], score: w.s1[0], delta: 5, ...tf(w.s1) },
      { ...STUDENTS[1], score: w.s2[0], delta: -2, ...tf(w.s2) },
    ],
    time_delta_days: window === "yesterday" ? 1 : 7,
  };
}

// GET users/:id/usage-history — three days, the middle one idle.
export const USAGE_HISTORY: UsageHistory = {
  as_of: "2026-09-18",
  range: 30,
  points: [
    { date: "2026-09-15", minutes: 12 },
    { date: "2026-09-16", minutes: 0 },
    { date: "2026-09-17", minutes: 7.5 },
  ],
};

export function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

// Routes proxy + boundary URLs to fixtures; records every URL hit. `scores`
// answers the country root (g-in); `scoresById` answers any other entity.
// `timeById`: ids whose `metric=usage&window=…` scores requests are answered
// in Time mode ("geo" → timeScores, "class" → timeScoresClass). Without it a
// usage request gets the plain fixture — a pp-sketch that predates windows.
// `media`: the users/:id/media answer (default MEDIA — the viewer is the students' teacher).
export function makeFetch(opts: { scores?: ScoresResponse; scoresById?: Record<string, ScoresResponse>; timeById?: Record<string, "geo" | "class">; media?: unknown } = {}) {
  const calls: string[] = [];
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push((init?.method ? init.method + " " : "") + url);
    const path = url.split("?")[0];
    if (path in GEO) return jsonResponse(200, GEO[path]);
    const qs = new URLSearchParams(url.split("?")[1] ?? "");
    const tm = path.match(/^\/api\/proxy\/geo-entities\/([^/]+)\/(scores|spotlight)$/);
    if (tm && qs.get("metric") === "usage" && qs.get("window") && opts.timeById && tm[1] in opts.timeById) {
      const scores = (opts.timeById[tm[1]] === "class" ? timeScoresClass : timeScores)(qs.get("window") as TimeWindow);
      if (tm[2] === "scores") return jsonResponse(200, scores);
      const top = (scores.children as Child[])[0];
      return jsonResponse(200, { top: opts.timeById[tm[1]] === "class" ? null : { child: top, official: top.official }, most_improved: null });
    }
    if (/^\/api\/proxy\/users\/[^/]+\/usage-history$/.test(path)) return jsonResponse(200, { ...USAGE_HISTORY, range: qs.get("range") === "all" ? "all" : 30 });
    if (/^\/api\/proxy\/geo-entities\/g-in\/scores$/.test(path)) return jsonResponse(200, opts.scores ?? SCORES);
    if (/^\/api\/proxy\/geo-entities\/g-in\/spotlight$/.test(path)) return jsonResponse(200, SPOTLIGHT);
    const m = path.match(/^\/api\/proxy\/geo-entities\/([^/]+)\/scores$/);
    if (m && opts.scoresById && m[1] in opts.scoresById) return jsonResponse(200, opts.scoresById[m[1]]);
    if (/^\/api\/proxy\/geo-entities\/[^/]+\/spotlight$/.test(path)) return jsonResponse(200, { top: null, most_improved: null });
    // student modal
    if (/^\/api\/proxy\/users\/[^/]+\/literacy-test-scores$/.test(path)) return jsonResponse(200, TEST_SCORES);
    if (/^\/api\/proxy\/users\/[^/]+\/media$/.test(path)) return jsonResponse(200, opts.media ?? MEDIA);
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

// The same class and feed as a viewer who is NOT the students' teacher sees
// them (pp-sketch masks per viewer): names / phones first…last, no editing,
// recordings not playable.
export const STUDENTS_MASKED: StudentChild[] = STUDENTS.map((st) => ({
  ...st,
  pii: "masked",
  label: st.name ? "R...i" : st.label,
  name: st.name ? "R...i" : null,
  phone: st.phone ? `${st.phone[0]}...${st.phone[st.phone.length - 1]}` : st.phone,
}));
export const SCORES_CLASS_MASKED: ScoresResponse = { ...SCORES_CLASS, children: STUDENTS_MASKED };
export const MEDIA_MASKED = { ...MEDIA, user: { name: "R...i", pii: "masked" as const } };
