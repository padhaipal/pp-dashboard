// Types + pure helpers shared by the public teacher dashboard (/d/[user_id]).
// Mirrors the pp-sketch contract for /users/:id/public, /geo-entities/:id/scores
// and /geo-entities/:id/spotlight. No React, no DOM — safe to import anywhere.

// "usage" is the leading indicator: active minutes per student on the day
// before as_of; pass = strictly more than USAGE_PASS_MINUTES. Its per-student
// `score` is minutes (absent = 0), its `delta` is in minutes.
export type Metric = "usage" | "nipun_g2" | "nipun_g3" | "mpl_b";
export const USAGE_PASS_MINUTES = 5;
// Pass marks (a pass is a score STRICTLY above) and age bands ([min, max)
// whole years) of the three tests, as pp-sketch decides them
// (literacy-test-scores.ts NIPUN_PASS_THRESHOLD / MPL_B_PASS_THRESHOLD,
// age-bands.ts METRIC_AGE_BANDS). Every scores response carries its own
// `pass_mark` / `age_band`; these are the fallback for a pp-sketch that
// predates them — keep in sync.
export const PASS_MARK_PCT: Record<Exclude<Metric, "usage">, number> = { nipun_g2: 75, nipun_g3: 75, mpl_b: 50 };
// Questions a test needs before it has a score (NIPUN: the last 4 first
// attempts; MPL-B: 20 — plus a spread of question types, so "at least").
export const TEST_QUESTION_COUNT: Record<Exclude<Metric, "usage">, number> = { nipun_g2: 4, nipun_g3: 4, mpl_b: 20 };
export const METRIC_AGE_BANDS: Record<Exclude<Metric, "usage">, [number, number]> = { nipun_g2: [7, 9], nipun_g3: [8, 10], mpl_b: [8, 10] };
export const passMarkOf = (metric: Metric, fromResponse?: number | null): number | null => (metric === "usage" ? null : (fromResponse ?? PASS_MARK_PCT[metric]));
export const ageBandOf = (metric: Metric, fromResponse?: [number, number] | null): [number, number] | null => (metric === "usage" ? null : (fromResponse ?? METRIC_AGE_BANDS[metric]));
// The age the test is described by: the band's lower bound ("8 year old
// students" for [8, 10)) — one number, as the headline is worded.
export const ageBandLabel = ([min]: [number, number]): string => `${min}`;
// 30 = last 30 days; "all" = all time (no lower bound; deltas are vs the
// student's / entity's oldest row).
export type Range = 30 | "all";
export type GeoType = "country" | "state" | "district" | "block" | "school";
// school → teacher (the referrers of its students) → student
export type ChildType = "state" | "district" | "block" | "school" | "teacher" | "student";
export type Bin = "high" | "mid" | "low" | "none";

export type GeoRef = {
  id: string;
  // "teacher" = a teacher's user id standing in as the level below a school
  type: GeoType | "teacher";
  code: string;
  name: string;
  has_boundary: boolean;
  lat: number | null;
  lng: number | null;
  // schools only: UDISE management; the map marks private schools
  management_group?: ManagementGroup | null;
};

export type ManagementGroup = "government" | "government_aided" | "private" | "other";
export const isPrivateSchool = (g: GeoRef) => g.type === "school" && g.management_group === "private";

export type Ancestor ={ id: string; type: GeoType; code: string; name: string };

// Whether a person's name / phone / recordings came back as stored ("full")
// or masked to first…last ("masked") — pp-sketch decides per viewer: in full
// only for the account directly above them (a student's own teacher, a
// teacher's block official). Absent on a pp-sketch that predates masking →
// treat as masked.
export type PiiVisibility = "full" | "masked";
export const isPiiFull = (pii: PiiVisibility | undefined): boolean => pii === "full";

export type Official = {
  id?: string;
  name: string | null;
  role_title: string | null;
  avatar_seed: string | null;
  spotlight_message: string | null;
  // the official's WhatsApp number — masked unless the viewer is directly above them
  phone?: string | null;
  pii?: PiiVisibility;
} | null;

export type PublicProfile = {
  id: string;
  name: string | null;
  role_title: string | null;
  avatar_seed: string | null;
  spotlight_message: string | null;
  geo_entity: GeoRef | null;
  ancestors: Ancestor[]; // root first
  share_link: string;
  // "What is Lifteracy?" clip, resolved server-side from the
  // lifteracy-explainer stid; null when unseeded → the link is omitted.
  explainer_url: string | null;
};

// "Time" (the usage metric with a window): active time over the chosen
// window. A student's own figures; for an area, a teacher or a class they are
// PER STUDENT. Absent on a pp-sketch that predates Time windows.
export type TimeFields = {
  time_total?: number | null; // minutes in the window
  time_per_day?: number | null; // minutes per day — what the colour follows
  time_days?: number; // days the figures cover
};

export type Child = GeoRef & TimeFields & {
  pass_rate: number | null;
  n: number;
  students_active: number;
  using_lifteracy: boolean;
  delta: number | null;
  bin: Bin;
  official: Official;
  // teacher rows only: how many students the teacher referred
  students?: number;
};

export type StudentChild = TimeFields & {
  student_id: string;
  label: string; // first name, else "Student N"
  // the student's WhatsApp number, shown beside the name everywhere (absent
  // on a pp-sketch that predates it); masked unless the viewer is the
  // student's own teacher
  phone?: string;
  name: string | null; // full name as stored; edited from the class view
  // "full" → label / name / phone as stored and the name may be edited
  pii?: PiiVisibility;
  score: number | null; // 0-1
  passed: boolean | null;
  attempts: number;
  in_band: boolean;
  active: boolean;
  last_active_at: string | null;
  delta: number | null; // points vs the row ≤ as_of − range
};

// GET users/:id/literacy-test-scores — per-test snapshot history (score 0-1).
export type TestSnapshotPoint = { at: string; score: number; passed: boolean };
// counted_message_ids: the interactions (media ids) behind `latest` and the
// history point before it — or, while insufficient, every answer so far.
export type SnapshotTestScore = { status: "ok" | "insufficient_data"; attempts_available: number; latest?: TestSnapshotPoint; history?: TestSnapshotPoint[]; counted_message_ids?: string[] };
export type LiteracyTestScores = { nipun_grade_2: SnapshotTestScore; nipun_grade_3: SnapshotTestScore; mpl_b: SnapshotTestScore };
// No test history for "usage" (undefined → empty series).
export const TEST_KEY_OF: Partial<Record<Metric, keyof LiteracyTestScores>> = { nipun_g2: "nipun_grade_2", nipun_g3: "nipun_grade_3", mpl_b: "mpl_b" };

// GET users/:id/usage-history — a student's active minutes per day (`date`
// is the day the minutes were spent; days without activity are 0).
export type UsageHistory = { as_of: string | null; range: Range; points: { date: string; minutes: number }[] };

// GET users/:id/media — the student's recent interactions (newest first):
// voice notes and comprehension flow taps. pp-sketch never returns the
// parent-onboarding voice notes to this public page (they need the staff-only
// `onboarding` param, which the proxy drops for sessionless callers).
export type MediaRow = {
  id: string;
  // Absent on a pp-sketch that predates the field → a voice note.
  kind?: "voice" | "tap" | "onboarding";
  created_at: string;
  has_audio: boolean;
  // voice-note length (ms), shown in place of the player when the viewer
  // may not hear the recording
  duration_ms?: number | null;
  // voice: the word / passage asked for; tap: the correct option's text
  answer: string | null;
  // tap: null = the lesson was not waiting for that tap (nothing recorded)
  answer_correct: boolean | null;
  tap?: { question: string | null; chosen: string | null; correct: string | null } | null;
};
// `user.pii` says whether the recordings may be played by this viewer
// (GET media-meta-data/:id/audio answers 403 otherwise).
export type UserMedia = { user: { name: string | null; pii?: PiiVisibility }; media: MediaRow[] };

// What the student modal lists and counts as activity: voice notes and the
// taps that answered a question. An onboarding row is dropped even if one
// ever arrived (defence in depth — this page is public), and so is a tap
// that was not awaited.
export const studentModalRows = (media: MediaRow[]): MediaRow[] =>
  media.filter((m) => m.kind !== "onboarding" && !(m.kind === "tap" && m.answer_correct === null));

// mean: usage = minutes per student that day (absent = 0); tests = mean score × 100.
export type SeriesPoint = { date: string; pass_rate: number | null; n: number; mean: number | null };
// Class level only: one line per student (minutes for usage, score × 100 for tests, null = gap).
export type StudentSeries = { student_id: string; points: { date: string; value: number | null }[] };

export type RootStats = TimeFields & {
  pass_rate: number | null;
  mean: number | null;
  sd: number | null;
  n: number | null;
  students_active: number | null;
  students_unbanded: number | null;
  delta: number | null;
};

export type ScoresResponse = {
  as_of: string | null;
  metric: Metric;
  range: Range;
  // Echoed by pp-sketch when the request carried a Time window: the response
  // then has the time_* fields and no deltas / most improved.
  window?: TimeWindow;
  // Test metrics: the age band counted and the pass mark (%) — see PASS_MARK_PCT.
  age_band?: [number, number];
  pass_mark?: number;
  entity: GeoRef;
  root: RootStats;
  series: SeriesPoint[];
  students_series?: StudentSeries[];
  // Geo and school levels: one faint line per child (an area, or a
  // teacher's class) on the trend chart.
  children_series?: { id: string; points: { date: string; value: number | null }[] }[];
  // Time mode: `delta` on root / children / students = minutes vs the window
  // before (1 = yesterday vs the day before, 7 = the last seven days vs the
  // seven before — all time compares the last seven days too).
  time_delta_days?: 1 | 7;
  child_type: ChildType;
  children: Child[] | StudentChild[];
  most_improved: Child[];
};

export type SpotlightEntry = { child: Child; official: Official } | null;
export type SpotlightResponse = { top: SpotlightEntry; most_improved: SpotlightEntry };

export const METRICS: { key: Metric; label: string; short: string }[] = [
  { key: "usage", label: "Time", short: "Time" },
  { key: "nipun_g2", label: "NIPUN grade 2 proxy", short: "NIPUN g2 proxy" },
  { key: "nipun_g3", label: "NIPUN grade 3 proxy", short: "NIPUN g3 proxy" },
  { key: "mpl_b", label: "MPL-B proxy", short: "MPL-B proxy" },
];
export const METRIC_BY: Record<Metric, { key: Metric; label: string; short: string }> = {
  usage: METRICS[0],
  nipun_g2: METRICS[1],
  nipun_g3: METRICS[2],
  mpl_b: METRICS[3],
};
// The window of the Time metric: a second toggle shown under the metric
// toggle while Time is selected. "7d" = the last seven days (never "week").
export type TimeWindow = "yesterday" | "7d" | "all";
export const TIME_WINDOWS: { key: TimeWindow; label: string; suffix: string }[] = [
  { key: "yesterday", label: "Yesterday", suffix: "yesterday" },
  { key: "7d", label: "Last seven days", suffix: "last seven days" },
  { key: "all", label: "All time", suffix: "all time" },
];
export const DEFAULT_TIME_WINDOW: TimeWindow = "all";
// "yesterday" / "last seven days" / "all time" for labels and captions.
export const timeWindowSuffix = (w: TimeWindow, t: (s: string) => string = (s) => s) => t(TIME_WINDOWS.find((x) => x.key === w)!.suffix);
// A scores response is in Time mode when pp-sketch echoed the window.
export const isTimeMode = (s: { metric: Metric; window?: TimeWindow } | null | undefined): boolean => !!s && s.metric === "usage" && s.window != null;
export const RANGES: Range[] = [30, "all"];
// "30 days" / "All time" on toggles; "last 30 days" / "all time" in suffixes.
export const rangeLabel = (r: Range, t: (s: string) => string = (s) => s) => (r === "all" ? t("All time") : `${r} ${t("days")}`);
export const rangeSuffix = (r: Range, t: (s: string) => string = (s) => s) => (r === "all" ? t("all time") : `${t("last")} ${r} ${t("days")}`);
// The student modal's chart picker: the letter-score chart (default) plus the
// dashboard metrics.
export type ModalMetric = Metric | "letters";
export const LETTERS_LABEL = "Letter scores";
export const MODAL_METRICS: { key: ModalMetric; label: string }[] = [{ key: "letters", label: LETTERS_LABEL }, ...METRICS];
// Shown wherever a student has no name yet (the API's "Student N" label is
// never displayed): tiles, modal title, most-improved rows, trend lines.
export const UNNAMED = "~";
// Time is what the page opens on (fresh load / refresh / navigation).
export const DEFAULT_METRIC: Metric = "usage";
export const DEFAULT_RANGE: Range = 30;

export const CHILD_NOUN: Record<ChildType, [string, string]> = {
  state: ["State", "states"],
  district: ["District", "districts"],
  block: ["Block", "blocks"],
  school: ["School", "schools"],
  teacher: ["Teacher", "teachers"],
  student: ["Student", "students"],
};
// mvp2's REP_OFFICER: the officer who leads each child unit (school-level
// children are teachers, so the school's spotlight is the "Teacher Spotlight").
export const CHILD_OFFICER: Record<ChildType, string> = {
  state: "DGSE",
  district: "BSA",
  block: "BEO",
  school: "Principal",
  teacher: "Teacher",
  student: "Teacher",
};

// `children` is StudentChild[] exactly when child_type is "student".
export const geoChildrenOf = (s: ScoresResponse): Child[] => (s.child_type === "student" ? [] : (s.children as Child[]));
export const studentChildrenOf = (s: ScoresResponse): StudentChild[] => (s.child_type === "student" ? (s.children as StudentChild[]) : []);

// ------------------------------------------------------------------ colours

// light grey = an area with no Lifteracy user (using_lifteracy false / bin none).
export const UNCOVERED = "#a1a1aa";
// incomplete states (district boundaries missing) render black and are not drillable.
export const INCOMPLETE_FILL = "#000000";
export const INCOMPLETE_TOOLTIP = "District boundaries not yet available for this state";
export const ACCENT = "#1d9edf";

// "See Lifteracy in Action" — the clip embedded on www.lifteracy.ai/#video
// (Framer-hosted mp4, CORS *, immutable). Shown in the teacher's share bar;
// the share link points parents at the website section, not the raw file.
export const EXPLAINER_VIDEO_URL = "https://framerusercontent.com/assets/UzlwOpPmZp3DVtJKOUr7hrlM8.mp4";
export const EXPLAINER_SHARE_URL = "https://www.lifteracy.ai/#video";

const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
export function scoreRGB(p: number): number[] {
  const red = [239, 68, 68],
    yellow = [234, 179, 8],
    green = [34, 197, 94];
  const c = p < 0.5 ? lerp(red, yellow, p / 0.5) : lerp(yellow, green, (p - 0.5) / 0.5);
  return c.map((v) => v | 0);
}
// mvp2's continuous red → yellow → green scale, p in 0..1
export const scoreColor = (p: number) => `rgb(${scoreRGB(clamp01(p)).join(",")})`;
export const textOn = (p: number) => {
  const [r, g, b] = scoreRGB(clamp01(p));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1c1917" : "#ffffff";
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// bin → colour: the three bins sit on mvp2's scoreColor scale; none → UNCOVERED.
export function binColor(bin: Bin): string {
  switch (bin) {
    case "high":
      return scoreColor(1);
    case "mid":
      return scoreColor(0.5);
    case "low":
      return scoreColor(0);
    default:
      return UNCOVERED;
  }
}

// Map/area fill for a child: grey when not using Lifteracy or without a score.
export function childFill(c: { using_lifteracy: boolean; pass_rate: number | null }): string {
  if (!c.using_lifteracy || c.pass_rate == null) return UNCOVERED;
  return scoreColor(c.pass_rate / 100);
}

export function binOf(passRate: number | null): Bin {
  if (passRate == null) return "none";
  return passRate >= 80 ? "high" : passRate >= 50 ? "mid" : "low";
}

// mvp2's `nipColor`: the three-step green / amber / red used for every card,
// tint, headline figure and legend swatch (the map keeps the continuous scale).
// `v` is a percentage 0–100; null → UNCOVERED grey.
export const nipColor = (v: number | null): string => (v == null ? UNCOVERED : v >= 80 ? "#16a34a" : v >= 50 ? "#f59e0b" : "#dc2626");
// Per-student usage: green past the 5-minute mark, amber for some use, red for none.
export const usageColor = (minutes: number | null): string => (minutes == null || minutes <= 0 ? "#dc2626" : minutes > USAGE_PASS_MINUTES ? "#16a34a" : "#f59e0b");
export const fmtMinutes = (minutes: number | null): string => (minutes == null ? "—" : `${Math.round(minutes)} min`);

// A total of active time: whole minutes up to 119, hours (one decimal at
// most) from 120 minutes up — "45 min", "119 min", "2 hours", "2.5 hours".
export const TIME_HOURS_FROM_MINUTES = 120;
export function fmtDuration(minutes: number | null | undefined, t: (s: string) => string = (s) => s): string {
  if (minutes == null) return "—";
  const m = Math.round(minutes);
  if (m < TIME_HOURS_FROM_MINUTES) return `${m} ${t("min")}`;
  return `${Number((minutes / 60).toFixed(1))} ${t("hours")}`;
}
// An average per day — always minutes, never hours: one decimal under 10
// ("0.4 min per day"), whole minutes from 10 up.
export function fmtPerDay(minutes: number | null | undefined, t: (s: string) => string = (s) => s): string {
  if (minutes == null) return "—";
  const v = minutes < 10 ? Number(minutes.toFixed(1)) : Math.round(minutes);
  return `${v} ${t("min per day")}`;
}
// Colour for a Time figure, from the average minutes per day: green past the
// 5-minute mark, amber for some use, red for none, grey when there is nothing
// to average (not using Lifteracy).
export const timeColor = (perDay: number | null | undefined): string => (perDay == null ? UNCOVERED : usageColor(perDay));
// Map / marker / bar fill of a child in Time mode.
export const timeFill = (c: { using_lifteracy: boolean; time_per_day?: number | null }): string => (c.using_lifteracy ? timeColor(c.time_per_day) : UNCOVERED);

// ------------------------------------------------------------------ urls

// `window` is sent only for the Time (usage) metric.
const windowQs = (metric: Metric, window?: TimeWindow) => (metric === "usage" && window ? `&window=${window}` : "");
export const scoresUrl = (id: string, metric: Metric, range: Range, window?: TimeWindow) =>
  `/api/proxy/geo-entities/${encodeURIComponent(id)}/scores?metric=${metric}&range=${range}${windowQs(metric, window)}`;
export const csvUrl = (id: string, metric: Metric, range: Range, window?: TimeWindow) =>
  `/api/proxy/geo-entities/${encodeURIComponent(id)}/scores.csv?metric=${metric}&range=${range}${windowQs(metric, window)}`;
export const spotlightUrl = (id: string, metric: Metric, range: Range, window?: TimeWindow) =>
  `/api/proxy/geo-entities/${encodeURIComponent(id)}/spotlight?metric=${metric}&range=${range}${windowQs(metric, window)}`;
// student modal "Time" chart: the student's active minutes per day
export const usageHistoryUrl = (id: string, range: Range) => `/api/proxy/users/${encodeURIComponent(id)}/usage-history?range=${range}`;
export const profileUrl = (id: string) => `/api/proxy/users/${encodeURIComponent(id)}/profile`;
// student modal: per-test history, recent voice notes and one note's audio
export const testScoresUrl = (id: string) => `/api/proxy/users/${encodeURIComponent(id)}/literacy-test-scores`;
// letter-score chart (ScoreChart on /user/[id]) — every score row + the learnt bins
export const letterScoresUrl = (id: string) => `/api/proxy/users/${encodeURIComponent(id)}/scores`;
export const letterBinsUrl = (id: string) => `/api/proxy/scores/letter-bins?users=${encodeURIComponent(id)}`;
export const mediaUrl = (id: string) => `/api/proxy/users/${encodeURIComponent(id)}/media`;
export const audioUrl = (mediaId: string) => `/api/proxy/media-meta-data/${encodeURIComponent(mediaId)}/audio`;

// ------------------------------------------------------------------ formatting

export const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
// mvp2 headline figures are whole percentages ("69%").
export const fmtPctInt = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
export const fmtDelta = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}`);

// Geo names arrive UPPERCASE from UDISE ("UTTAR PRADESH"); mvp2's location
// title shows them in title case. School names keep their own casing
// ("PRI.SCH. ICHHA NAGAR"), exactly as mvp2 does.
export function displayName(name: string, type: GeoType | "teacher" | "student"): string {
  if (type === "school" || type === "teacher" || type === "student") return name;
  return name
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join("");
}
export const EMPTY_ROOT_TEXT = "No results yet — share your link to get started.";
export const INACTIVE_LINK_TEXT = "This link is not active";
// Caption for a Time-mode delta.
export const timeDeltaSuffix = (days: 1 | 7 | undefined, t: (s: string) => string = (s) => s) => (days === 1 ? t("vs the day before") : t("vs the previous 7 days"));
