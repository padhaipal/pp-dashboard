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
  cohort_avg_lifetime_hours: number | null;
}

export interface TractionResponse {
  from: string;
  to: string;
  computed_at: string;
  daily: TractionDay[];
}

export type TractionKey = Exclude<keyof TractionDay, "date">;

export const TRACTION_URL = "/api/proxy/users/dashboard/traction";

const fmtInt = (v: number) => Math.round(v).toLocaleString("en-IN");
const fmtHours = (v: number) => v.toFixed(v < 10 ? 2 : 1);

// Toggle order = the order asked for. `unit` is the y-axis title.
export const TRACTION_METRICS: { key: TractionKey; label: string; short: string; unit: string; format: (v: number) => string }[] = [
  { key: "users_over_5min", label: "Users over 5 min", short: "Users 5+ min", unit: "Users", format: fmtInt },
  { key: "minutes", label: "Minutes spent", short: "Minutes", unit: "Minutes", format: fmtInt },
  { key: "students_onboarded", label: "Students onboarded", short: "Students", unit: "Students", format: fmtInt },
  { key: "mpl_b_passed", label: "Passed MPL-b", short: "MPL-b", unit: "Students", format: fmtInt },
  { key: "teachers_onboarded", label: "Teachers onboarded", short: "Teachers", unit: "Teachers", format: fmtInt },
  { key: "schools", label: "Schools", short: "Schools", unit: "Schools", format: fmtInt },
  { key: "blocks", label: "Blocks", short: "Blocks", unit: "Blocks", format: fmtInt },
  { key: "districts", label: "Districts", short: "Districts", unit: "Districts", format: fmtInt },
  { key: "states", label: "States", short: "States", unit: "States", format: fmtInt },
  { key: "cohort_avg_lifetime_hours", label: "Avg lifetime hours by onboarding day", short: "Cohort hours", unit: "Hours per student", format: fmtHours },
];

export const SMOOTH_MIN = 1;
export const SMOOTH_MAX = 14;
export const SMOOTH_DEFAULT = 7;

// Trailing mean over `days` days (the window shrinks at the start); nulls
// (a day without a cohort) are skipped, and a window with none stays null.
export function smooth(values: (number | null)[], days: number): (number | null)[] {
  const n = Math.max(1, Math.round(days));
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, i - n + 1); k <= i; k++) {
      const v = values[k];
      if (v !== null) {
        sum += v;
        count++;
      }
    }
    return count ? sum / count : null;
  });
}

export const seriesOf = (daily: TractionDay[], key: TractionKey): (number | null)[] => daily.map((d) => d[key]);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-09-01" → "1 Sep" (a fixed table: ICU builds differ — "Sept")
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1] ?? ""}`;
}
