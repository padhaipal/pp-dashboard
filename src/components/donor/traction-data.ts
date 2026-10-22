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
  // absent from a pp-sketch older than the monthly series
  monthly?: TractionMonth[];
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
  { key: "mpl_b_passed", label: "Passed MPL-b", short: "MPL-b", unit: "Students", format: fmtInt },
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

// "2026-09-01" → "1 Sep" (a fixed table: ICU builds differ — "Sept")
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1] ?? ""}`;
}
