// Types + pure helpers shared by the public teacher dashboard (/d/[user_id]).
// Mirrors the pp-sketch contract for /users/:id/public, /geo-entities/:id/scores
// and /geo-entities/:id/spotlight. No React, no DOM — safe to import anywhere.

// "usage" is the leading indicator: active minutes per student on the day
// before as_of; pass = strictly more than USAGE_PASS_MINUTES. Its per-student
// `score` is minutes (absent = 0), its `delta` is in minutes.
export type Metric = "usage" | "nipun_g2" | "nipun_g3" | "mpl_b";
export const USAGE_PASS_MINUTES = 5;
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

export type Official = {
  name: string | null;
  role_title: string | null;
  avatar_seed: string | null;
  spotlight_message: string | null;
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

export type Child = GeoRef & {
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

export type StudentChild = {
  student_id: string;
  label: string; // first name, else "Student N"
  name: string | null; // full name as stored; edited from the class view
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
export type SnapshotTestScore = { status: "ok" | "insufficient_data"; attempts_available: number; latest?: TestSnapshotPoint; history?: TestSnapshotPoint[] };
export type LiteracyTestScores = { nipun_grade_2: SnapshotTestScore; nipun_grade_3: SnapshotTestScore; mpl_b: SnapshotTestScore };
// No test history for "usage" (undefined → empty series).
export const TEST_KEY_OF: Partial<Record<Metric, keyof LiteracyTestScores>> = { nipun_g2: "nipun_grade_2", nipun_g3: "nipun_grade_3", mpl_b: "mpl_b" };

// GET users/:id/media — the student's recent voice notes (newest first).
export type MediaRow = {
  id: string;
  created_at: string;
  has_audio: boolean;
  answer: string | null;
  answer_correct: boolean | null;
};
export type UserMedia = { user: { name: string | null }; media: MediaRow[] };

// mean: usage = minutes per student that day (absent = 0); tests = mean score × 100.
export type SeriesPoint = { date: string; pass_rate: number | null; n: number; mean: number | null };
// Class level only: one line per student (minutes for usage, score × 100 for tests, null = gap).
export type StudentSeries = { student_id: string; points: { date: string; value: number | null }[] };

export type RootStats = {
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
  entity: GeoRef;
  root: RootStats;
  series: SeriesPoint[];
  students_series?: StudentSeries[];
  child_type: ChildType;
  children: Child[] | StudentChild[];
  most_improved: Child[];
};

export type SpotlightEntry = { child: Child; official: Official } | null;
export type SpotlightResponse = { top: SpotlightEntry; most_improved: SpotlightEntry };

export const METRICS: { key: Metric; label: string; short: string }[] = [
  { key: "usage", label: "Daily usage (5+ min)", short: "Usage" },
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
export const DEFAULT_METRIC: Metric = "nipun_g3";
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

// ------------------------------------------------------------------ urls

export const scoresUrl = (id: string, metric: Metric, range: Range) =>
  `/api/proxy/geo-entities/${encodeURIComponent(id)}/scores?metric=${metric}&range=${range}`;
export const csvUrl = (id: string, metric: Metric, range: Range) =>
  `/api/proxy/geo-entities/${encodeURIComponent(id)}/scores.csv?metric=${metric}&range=${range}`;
export const spotlightUrl = (id: string, metric: Metric, range: Range) =>
  `/api/proxy/geo-entities/${encodeURIComponent(id)}/spotlight?metric=${metric}&range=${range}`;
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
