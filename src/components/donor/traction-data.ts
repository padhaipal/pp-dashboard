// The donor page's Traction chart: the series pp-sketch serves (GET
// users/dashboard/traction, via the public proxy) and the pure helpers the
// chart draws from. No React, no DOM.

export interface TractionDay {
  date: string; // IST YYYY-MM-DD
  users_over_5min: number;
  minutes: number;
  students_onboarded: number;
  mpl_b_passed: number;
  teachers_onboarded: number;
  schools: number;
  blocks: number;
  districts: number;
  states: number;
}

// Per IST month: students with at least one day > 5 min active that month,
// split by onboarding month; projected_* = the month in progress scaled
// linearly to month end (null for complete months).
export interface TractionMonth {
  month: string; // YYYY-MM
  joined_earlier: number;
  joined_this_month: number;
  projected_joined_earlier: number | null;
  projected_joined_this_month: number | null;
}

export interface TractionResponse {
  from: string;
  to: string;
  computed_at: string;
  daily: TractionDay[];
  // absent from a pp-sketch older than the monthly series / the totals
  monthly?: TractionMonth[];
  // all time through `to`: active hours (whole), onboarded students
  totals?: { hours: number; students: number };
}

export type TractionKey = Exclude<keyof TractionDay, "date">;
// a daily series, or the monthly bar chart
export type TractionChoice = TractionKey | "monthly";

export const TRACTION_URL = "/api/proxy/users/dashboard/traction";

const fmtInt = (v: number) => Math.round(v).toLocaleString("en-IN");

// Toggle order = the order asked for; the first is the default. `unit` is
// the y-axis title.
export interface TractionMetric {
  key: TractionChoice;
  label: string;
  short: string;
  unit: string;
  format: (v: number) => string;
}

export const TRACTION_METRICS: TractionMetric[] = [
  { key: "minutes", label: "Minutes spent", short: "Minutes", unit: "Minutes", format: fmtInt },
  { key: "users_over_5min", label: "Users over 5 min", short: "Users 5+ min", unit: "Users", format: fmtInt },
  { key: "students_onboarded", label: "Students onboarded", short: "Students", unit: "Students", format: fmtInt },
  { key: "mpl_b_passed", label: "Passed MPL-B", short: "MPL-B", unit: "Students", format: fmtInt },
  { key: "teachers_onboarded", label: "Teachers onboarded", short: "Teachers", unit: "Teachers", format: fmtInt },
  { key: "schools", label: "Schools", short: "Schools", unit: "Schools", format: fmtInt },
  { key: "blocks", label: "Blocks", short: "Blocks", unit: "Blocks", format: fmtInt },
  { key: "districts", label: "Districts", short: "Districts", unit: "Districts", format: fmtInt },
  { key: "states", label: "States", short: "States", unit: "States", format: fmtInt },
  { key: "monthly", label: "Monthly active students", short: "Monthly", unit: "Students", format: fmtInt },
];

export const seriesOf = (daily: TractionDay[], key: TractionKey): (number | null)[] => daily.map((d) => d[key]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-09" → "Sep 2026"
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1] ?? ""} ${y}`;
}

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-09-01" → "1 September"
export function longDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_LONG[m - 1] ?? ""}`;
}

// The chart's x labels: indexes of the dates that are a month's 1st, thinned
// to at most `max` (every 2nd, 3rd… month, always keeping the latest).
export function monthStartLabels(dates: string[], max: number): Set<number> {
  const firsts = dates.flatMap((d, i) => (d.endsWith("-01") ? [i] : []));
  const step = Math.max(1, Math.ceil(firsts.length / max));
  return new Set(firsts.filter((_, k) => (firsts.length - 1 - k) % step === 0));
}

// "2026-09-01" → "1 Sep" (a fixed table: ICU builds differ — "Sept")
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1] ?? ""}`;
}

// The CSV behind "Download CSV": every toggle's data, one row per IST day.
// Daily series as served; "Monthly active students" is a per-month figure,
// so each day carries its month's values (blank for a month pp-sketch has
// no row for). Header = the toggle labels. Rows are aggregates only.
export function tractionCsv(data: TractionResponse): string {
  const daily = TRACTION_METRICS.filter((m): m is TractionMetric & { key: TractionKey } => m.key !== "monthly");
  const byMonth = new Map((data.monthly ?? []).map((m) => [m.month, m]));
  const header = [
    "Date",
    ...daily.map((m) => m.label),
    "Monthly active students (whole month)",
    "Monthly active students: joined in an earlier month",
    "Monthly active students: joined this month",
    "Monthly active students: projected by month end",
  ];
  const cell = (v: number | null | undefined) => (v == null ? "" : String(v));
  const rows = data.daily.map((d) => {
    const m = byMonth.get(d.date.slice(0, 7));
    const projected = m && m.projected_joined_earlier !== null && m.projected_joined_this_month !== null ? m.projected_joined_earlier + m.projected_joined_this_month : null;
    return [d.date, ...daily.map((k) => cell(d[k.key])), cell(m && m.joined_earlier + m.joined_this_month), cell(m?.joined_earlier), cell(m?.joined_this_month), cell(projected)];
  });
  const escape = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\n") + "\n";
}

export const tractionCsvFilename = (data: TractionResponse) => `lifteracy-traction-${data.computed_at.slice(0, 10)}.csv`;
