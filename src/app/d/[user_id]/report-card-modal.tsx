"use client";

// Report building blocks (RepKpis / RepTrend / RepLatest / RepImproved /
// RepQuote / RepMeta) used on the page, plus ReportCardModal: a preview of the
// same blocks with a one-page PDF export. jsPDF is loaded ONLY inside the
// export click handler via a dynamic import — never statically.

import { useEffect, useState } from "react";
import { AvatarImg, MvpTrend } from "./mvp-widgets";
import { useIsMobile } from "./use-is-mobile";
import {
  ACCENT,
  binColor,
  CHILD_NOUN,
  CHILD_OFFICER,
  fmtDuration,
  fmtDurationParts,
  fmtPct,
  fmtPctInt,
  METRIC_BY,
  nipColor,
  windowColor,
  windowFill,
  timeWindowSuffix,
  type TimeWindow,
  UNCOVERED,
  type Child,
  type ChildType,
  type Metric,
  type Range,
  rangeLabel,
  rangeSuffix,
  type RootStats,
  type SeriesPoint,
  UNNAMED,
  type SpotlightEntry,
  type SpotlightResponse,
  type StudentChild,
  ageBandLabel,
  ageBandOf,
  passMarkOf,
} from "./dashboard-types";
import type { T } from "./i18n";
import { IconClose, IconPdf } from "./icons";

const same: T = (s) => s;

// useIsMobile lives in use-is-mobile.ts (shared with mvp-widgets).
export { useIsMobile } from "./use-is-mobile";

const shiftDay = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
const fmtDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
};

// ------------------------------------------------------------------ KPIs

// mvp2's headline cards: the average of the toggled metric (nipColor) and, above
// school level, "{usingN} of {totalN} {nounP} using Lifteracy".
export function RepKpis({
  root,
  metricLabel,
  nounP,
  usingN,
  showUsing = true,
  timeWindow,
  ageBand,
  t = same,
}: {
  root: RootStats;
  metricLabel: string;
  nounP: string;
  usingN: number;
  totalN: number;
  showUsing?: boolean;
  // Test metrics: the ages the pass rate counts ("7–8 year old students").
  ageBand?: [number, number] | null;
  // Time mode: the headline is the active time per student over this window
  // (total + minutes per day, coloured by the per-day average), not a pass rate.
  timeWindow?: TimeWindow;
  t?: T;
}) {
  const card = (big: string, label: string, color: string, key: string, sub?: string) => (
    <div key={key} className="min-w-0 flex-1 rounded-2xl bg-white px-3 py-5 text-center shadow-sm ring-1 ring-zinc-200 sm:px-4 sm:py-6" data-testid={`kpi-${key}`}>
      <div className="whitespace-nowrap text-3xl font-extrabold tracking-tight tabular-nums sm:text-5xl" style={{ color }}>
        {big}
      </div>
      {sub && (
        <div className="mt-1 whitespace-nowrap text-base font-bold leading-tight" style={{ color }} data-testid="kpi-per-day">
          {sub}
        </div>
      )}
      <div className="mt-1.5 text-xs font-medium leading-tight text-zinc-500 sm:text-sm">{label}</div>
    </div>
  );
  return (
    <div className="flex flex-row gap-3" data-testid="root-kpis">
      {timeWindow
        ? card(fmtDurationParts(root.time_sum, t).value, `${fmtDurationParts(root.time_sum, t).unit} ${timeWindowSuffix(timeWindow, t)}`, windowColor(root.time_total, timeWindow), "pass")
        : card(
            fmtPctInt(root.pass_rate),
            ageBand ? `${t("of")} ${ageBandLabel(ageBand)} ${t("year old students pass the")} ${metricLabel}` : `${t("of students pass the")} ${metricLabel}`,
            nipColor(root.pass_rate),
            "pass",
          )}
      {/* how many children are on Lifteracy — a plain count, in black */}
      {showUsing && card(`${usingN}`, `${t(nounP)} ${t("using Lifteracy")}`, "#18181b", "using")}
    </div>
  );
}

// ------------------------------------------------------------------ trend

// mvp2's spaghetti chart. The navy line is the root series; at class level
// `students` adds one faint line per student (hover a line or its tile to
// light it up and dim the rest, click a line to pin it). The y-axis follows
// the metric: percentages with the 80 % NIPUN target for the two NIPUN
// proxies, percentages without a target for MPL-B, and minutes (from
// `mean` / student `value`) for usage.
// 1, 2 or 5 × 10ⁿ at or above `raw` — a readable axis step.
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

export type TrendStudent = { id: string; label: string; points: { date: string; value: number | null }[] };
export function RepTrend({
  series,
  label,
  metric = "nipun_g3",
  students = [],
  hoverId = null,
  setHoverId,
  pinId = null,
  setPinId,
  passMark,
  t = same,
}: {
  series: SeriesPoint[];
  label?: string;
  metric?: Metric;
  // The test's pass mark in % (from the scores response); default per metric.
  passMark?: number | null;
  students?: TrendStudent[];
  hoverId?: string | null;
  setHoverId?: (id: string | null) => void;
  pinId?: string | null;
  setPinId?: (id: string | null) => void;
  t?: T;
}) {
  const mobile = useIsMobile();
  const isUsage = metric === "usage";
  // One dotted line per test: NIPUN at 75 (three of four right), MPL-B at 50.
  const mark = passMarkOf(metric, passMark);
  const yLabel = label ?? t("Oral Literacy NIPUN Proxy percentage pass rate");
  const W = mobile ? 440 : 900,
    H = mobile ? 300 : 280,
    mL = mobile ? 36 : 46,
    mR = 12,
    mT = 12,
    mB = mobile ? 40 : 34,
    iw = W - mL - mR,
    ih = H - mT - mB;
  // Root value per point: for usage the day's TOTAL minutes; for the tests the
  // mean score × 100. When child lines are drawn the navy line is instead the
  // average of those lines (below).
  const rootVal = (p: SeriesPoint) => (isUsage ? (p.total ?? p.mean) : p.mean);
  // A usage row dated D holds the previous IST day's minutes: label it by
  // that day so the axis ends at yesterday, the last complete day.
  const dayLabel = (iso: string) => fmtDay(isUsage ? shiftDay(iso, -1) : iso);
  const n = series.length;
  const byDate = new Map(series.map((p, i) => [p.date, i]));
  // Minutes axis fits the data: a "nice" step (1, 2, 5 × 10ⁿ) so the top
  // tick sits just above the highest line; the tests keep 0–100.
  const dataMax = isUsage ? Math.max(0, ...series.map((p) => rootVal(p) ?? 0), ...students.flatMap((s) => s.points.map((q) => q.value ?? 0))) : 100;
  const step = isUsage ? niceStep(dataMax / 5) : 20;
  const yMax = isUsage ? Math.max(step, Math.ceil(dataMax / step) * step) : 100;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const x = (i: number) => mL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw),
    y = (v: number) => mT + ih - (v / yMax) * ih;
  const pathOf = (pts: Array<{ i: number; v: number | null }>) => {
    let d = "",
      pen = false;
    for (const p of pts) {
      if (p.v == null) {
        pen = false;
        continue;
      }
      d += (pen ? "L" : "M") + x(p.i).toFixed(1) + " " + y(p.v).toFixed(1);
      pen = true;
    }
    return d;
  };
  // The navy line: the average of the lines on the plot (an area's children,
  // a school's teachers, a class's students) on each date; the root series
  // only where there are no lines.
  const rootPts = series.map((p, i) => {
    if (!students.length) return { i, v: rootVal(p) };
    const vals = students.map((s) => s.points.find((q) => q.date === p.date)?.value).filter((v): v is number => v != null);
    return { i, v: vals.length ? Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10 : null };
  });
  const d = pathOf(rootPts);
  let li = -1;
  for (let i = n - 1; i >= 0; i--) if (rootPts[i].v != null) {
    li = i;
    break;
  }
  const hot = pinId ?? hoverId;
  const every = Math.max(1, Math.ceil(n / (mobile ? 4 : 8)));
  const lines = students.map((s) => {
    const pts = s.points.filter((q) => byDate.has(q.date)).map((q) => ({ i: byDate.get(q.date)!, v: q.value }));
    let last = -1;
    for (let k = pts.length - 1; k >= 0; k--) if (pts[k].v != null) {
      last = k;
      break;
    }
    return { s, d: pathOf(pts), end: last >= 0 ? pts[last] : null };
  });
  // Draw the hot line last so it sits on top.
  const ordered = [...lines.filter((l) => l.s.id !== hot), ...lines.filter((l) => l.s.id === hot)];
  return (
    <svg data-rep-chart="trend" viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {ticks.map((g) => (
        <g key={g}>
          <line x1={mL} x2={W - mR} y1={y(g)} y2={y(g)} stroke="#f1f5f9" />
          <text x={mL - 5} y={y(g) + 3} textAnchor="end" fontSize={mobile ? 13 : 9} fill="#94a3b8">
            {g}
          </text>
        </g>
      ))}
      <text transform={`translate(12 ${mT + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={mobile ? 12 : 11} fontWeight="600" fill="#475569">
        {yLabel}
      </text>
      {li < 0 && lines.every((l) => !l.d) ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={mobile ? 16 : 13} fill="#94a3b8">
          {t("No results in this window")}
        </text>
      ) : (
        <>
          {ordered.map(({ s, d: sd, end }) => {
            if (!sd) return null;
            const on = hot === s.id;
            const dim = hot != null && !on;
            return (
              <g key={s.id} data-testid="student-line" data-student-id={s.id} data-hot={on ? "1" : undefined}>
                <path
                  d={sd}
                  fill="none"
                  stroke={on ? "#2563eb" : "#94a3b8"}
                  strokeWidth={(on ? 2.4 : 1.4) * (mobile ? 1.5 : 1)}
                  opacity={dim ? 0.3 : 0.9}
                  style={{ cursor: setPinId ? "pointer" : undefined }}
                  onMouseEnter={() => setHoverId?.(s.id)}
                  onMouseLeave={() => setHoverId?.(null)}
                  onClick={() => setPinId?.(pinId === s.id ? null : s.id)}
                />
                {on && end && end.v != null && (
                  <text x={x(end.i) - 4} y={y(end.v) - 6} textAnchor="end" fontSize={mobile ? 13 : 10} fontWeight="700" fill="#2563eb" pointerEvents="none">
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}
          {/* a window with one or two dates (Yesterday) has no line to draw: dots instead */}
          {n <= 2 &&
            ordered.flatMap(({ s }) =>
              s.points
                .filter((q) => byDate.has(q.date) && q.value != null)
                .map((q) => <circle key={`${s.id}-${q.date}`} cx={x(byDate.get(q.date)!)} cy={y(q.value!)} r={mobile ? 4 : 3} fill={hot === s.id ? "#2563eb" : "#94a3b8"} opacity={hot != null && hot !== s.id ? 0.3 : 0.9} data-testid="trend-dot" />),
            )}
          {n <= 2 && rootPts.filter((p) => p.v != null).map((p) => <circle key={`root-${p.i}`} cx={x(p.i)} cy={y(p.v!)} r={mobile ? 6 : 5} fill="#1e3a5f" data-testid="trend-dot" />)}
          {li >= 0 && (
            <>
              <path d={d} fill="none" stroke="#1e3a5f" strokeWidth={mobile ? 3.8 : 2.8} pointerEvents="none" opacity={hot != null ? 0.55 : 1} />
              <text x={x(li) - 4} y={y(rootPts[li].v!) - 7} textAnchor="end" fontSize={mobile ? 15 : 11} fontWeight="800" fill="#1e3a5f" pointerEvents="none">
                {t("Average")}
              </text>
            </>
          )}
        </>
      )}
      {/* the test's pass mark (NIPUN passes at it, MPL-B strictly above) — what the headline's "% passing" counts */}
      {!isUsage && mark !== null && (
        <>
          <line x1={mL} x2={W - mR} y1={y(mark)} y2={y(mark)} stroke="#64748b" strokeWidth={mobile ? 1.6 : 1.1} strokeDasharray="2 4" pointerEvents="none" data-testid="pass-mark" data-mark={mark} />
          <text x={W - mR - 3} y={y(mark) - 4} textAnchor="end" fontSize={mobile ? 12 : 9} fill="#64748b" fontWeight="700" pointerEvents="none">
            {mark}% {t("pass mark")}
          </text>
        </>
      )}
      {series.map((s, i) =>
        i % every === 0 || i === n - 1 ? (
          <text key={"l" + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={mobile ? 11 : 8} fill="#94a3b8">
            {dayLabel(s.date)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// ------------------------------------------------------------------ latest bars

// Best first; children not using Lifteracy last. Time mode ranks by total minutes.
export function sortedLatest(children: Child[], time = false): Child[] {
  const v = (c: Child) => (c.using_lifteracy ? ((time ? c.time_sum : c.pass_rate) ?? -1) : -2);
  return children.slice().sort((a, b) => v(b) - v(a));
}

export function RepLatest({
  childrenRows,
  hoverId,
  setHoverId,
  selId,
  onSelect,
  onPick,
  label,
  time = false,
}: {
  childrenRows: Child[];
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selId: string | null;
  onSelect: (c: Child) => void;
  onPick: (c: Child) => void;
  label: string;
  // Time mode: bars are minutes per student per day on an axis that fits the
  // data, coloured by the 5-minute rule; no NIPUN target line.
  time?: boolean;
}) {
  const arr = sortedLatest(childrenRows, time);
  const valueOf = (c: Child) => (time ? c.time_sum : c.pass_rate) ?? null;
  const top = time ? Math.max(10, Math.ceil(Math.max(0, ...arr.map((c) => c.time_sum ?? 0)) / 10) * 10) : 100;
  const W = 900,
    H = 232,
    mT = 8,
    mB = 14,
    mL = 46,
    iw = W - mL - 6,
    ih = H - mT - mB;
  const bw = iw / Math.max(1, arr.length);
  return (
    <svg data-rep-chart="latest" viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ maxHeight: 244, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {[0, top / 2, top].map((g) => (
        <g key={g}>
          <line x1={mL} x2={mL + iw} y1={mT + ih - (g / top) * ih} y2={mT + ih - (g / top) * ih} stroke="#f1f5f9" />
          <text x={mL - 5} y={mT + ih - (g / top) * ih + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
            {g}
          </text>
        </g>
      ))}
      <text transform={`translate(12 ${mT + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize="8.5" fill="#64748b">
        {label}
      </text>
      {arr.map((it, i) => {
        const val = valueOf(it);
        const has = it.using_lifteracy && val != null;
        const v = has ? val : 0,
          h = has ? (v / top) * ih : ih;
        const col = has ? (time ? windowFill(it) : binColor(it.bin)) : "#e5e7eb",
          xx = mL + i * bw,
          on = hoverId === it.id || selId === it.id;
        return (
          <rect
            key={it.id}
            x={xx + 0.4}
            y={mT + ih - h}
            width={Math.max(1, bw - 0.8)}
            height={h}
            fill={(hoverId || selId) && !on ? col + "99" : col}
            stroke={selId === it.id ? "#2563eb" : "none"}
            strokeWidth={selId === it.id ? 1.2 : 0}
            data-id={it.id}
            onMouseEnter={() => setHoverId(it.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onSelect(it)}
            onDoubleClick={() => onPick(it)}
            style={{ cursor: "pointer" }}
          >
            <title>{`${it.name} — ${has ? (time ? fmtDuration(it.time_sum) : fmtPct(it.pass_rate)) : "not using Lifteracy"}`}</title>
          </rect>
        );
      })}
      {!time && (
        <>
          <line x1={mL} x2={mL + iw} y1={mT + ih - 0.8 * ih} y2={mT + ih - 0.8 * ih} stroke="#ef4444" strokeWidth="1.3" strokeDasharray="5 3" pointerEvents="none" />
          <text x={mL + iw} y={mT + ih - 0.8 * ih - 4} textAnchor="end" fontSize="9" fontWeight="700" fill="#ef4444" pointerEvents="none">
            80% NIPUN target
          </text>
        </>
      )}
    </svg>
  );
}

// ------------------------------------------------------------------ most improved

// Anything rankable by delta: geo children, teachers, or (class view) students.
export type ImprovedRow = { id: string; name: string; delta: number | null };

// `format` renders the figure after the bar (default: a signed change,
// "+1.8"); `signed` false draws every bar green with no sign — the "top
// performing" ranking uses it with a value in `delta`.
export function RepImproved<R extends ImprovedRow>({
  mostImproved,
  hoverId,
  setHoverId,
  selId,
  onSelect,
  onPick,
  format,
  signed = true,
}: {
  mostImproved: R[];
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selId: string | null;
  onSelect: (c: R) => void;
  onPick: (c: R) => void;
  format?: (v: number) => string;
  signed?: boolean;
}) {
  const fmt = format ?? ((v: number) => (signed && v >= 0 ? "+" : "") + v.toFixed(1));
  // At most five rows; nothing under the heading until there is something to rank.
  const arr = mostImproved.filter((c) => c.delta != null).slice(0, 5);
  if (!arr.length) return null;
  // Drawn in a half-width column, so a 440-unit viewBox with 12.5-unit type
  // reads at ~13 px (the old 900-unit box scaled the text to ~6 px).
  const mobile = true;
  const W = 440,
    rowH = 30,
    mT = 6,
    mL = 150,
    mR = 70,
    H = mT * 2 + arr.length * rowH;
  const max = Math.max(1, ...arr.map((i) => Math.abs(i.delta!))),
    iw = W - mL - mR;
  return (
    <svg data-rep-chart="improved" viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {arr.map((it, i) => {
        const yy = mT + i * rowH,
          bw = Math.max(2, (Math.abs(it.delta!) / max) * iw),
          hot = hoverId === it.id || selId === it.id;
        const mx = 20;
        const nm = it.name.length > mx ? it.name.slice(0, mx - 1) + "…" : it.name;
        const pos = !signed || it.delta! >= 0;
        return (
          <g
            key={it.id}
            data-id={it.id}
            onMouseEnter={() => setHoverId(it.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onSelect(it)}
            onDoubleClick={() => onPick(it)}
            style={{ cursor: "pointer" }}
          >
            <rect x={0} y={yy} width={W} height={rowH} fill={selId === it.id ? "#dbeafe" : hoverId === it.id ? "#f0fdf4" : "transparent"} />
            <text x={mL - 6} y={yy + rowH - 7} textAnchor="end" fontSize={mobile ? 12.5 : 9.5} fill={hot ? "#15803d" : "#475569"}>
              {nm}
            </text>
            <rect x={mL} y={yy + 4} width={bw} height={rowH - 8} rx="1.5" fill={pos ? (hot ? "#15803d" : "#22c55e") : "#dc2626"} />
            <text x={mL + bw + 5} y={yy + rowH - 7} fontSize={mobile ? 12.5 : 9.5} fill={pos ? "#16a34a" : "#dc2626"} fontWeight="700">
              {fmt(it.delta!)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ spotlight quote

export function RepQuote({
  kind,
  entry,
  nounS,
  officer,
  range,
  time = false,
  deltaSuffix,
  t = same,
}: {
  kind: "top" | "improved";
  entry: SpotlightEntry;
  nounS: string;
  officer: string;
  range?: Range;
  // Time mode: the top card's figure is the child's active time, not a pass
  // rate, and the improved card's change is in minutes (`deltaSuffix` says
  // against which window).
  time?: boolean;
  deltaSuffix?: string;
  t?: T;
}) {
  const title = kind === "top" ? `${t("Top")} ${t(nounS).toLowerCase()}` : t("Most improved");
  if (!entry) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-400" data-testid={`spotlight-${kind}`} data-empty="1">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">{title}</div>
        {t("No")} {t(nounS).toLowerCase()} {t("qualifies yet.")}
      </div>
    );
  }
  const { child, official } = entry;
  const when = deltaSuffix ?? (range ? rangeSuffix(range, t) : t("this week"));
  const head =
    kind === "top"
      ? `${title} — ${time ? fmtDuration(child.time_sum, t) : fmtPctInt(child.pass_rate)}`
      : `${title} — ${child.delta != null && child.delta >= 0 ? "+" : ""}${child.delta?.toFixed(1) ?? "—"} ${t(time ? "min" : "pts")} ${when}`;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-100/80 px-4 py-4" data-testid={`spotlight-${kind}`}>
      <AvatarImg seed={official?.avatar_seed ?? child.id} size={56} className="h-14 w-14" ring="#16a34a" ringWidth={2} />
      <div className="min-w-0 text-[12px] leading-snug text-zinc-700">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">{head}</div>
        <div className="text-lg font-extrabold leading-tight text-zinc-900">{official?.name ?? t("No Lifteracy user yet")}</div>
        <div className="mb-2 text-[11px] font-semibold text-zinc-500">
          {official?.role_title ?? t(officer)} · {child.name}
        </div>
        {official?.spotlight_message ? (
          <div className="italic text-zinc-700">“{official.spotlight_message}”</div>
        ) : (
          <div className="italic text-zinc-400">{t("No spotlight message yet.")}</div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ detail card

// mvp2's RepMeta: left half tinted by the score (avatar, name, official, role),
// right half ONE headline figure — the toggled metric — with the trend arrow.
// `student` is the school-level subject (no official, no avatar: privacy).
export function RepMeta({
  child,
  student,
  metricLabel,
  officer,
  range,
  time = false,
  timeWindow,
  t = same,
}: {
  child?: Child | null;
  student?: StudentChild | null;
  metricLabel: string;
  officer: string;
  range?: Range;
  // Time mode: the figure is the child's active time per student (total, with
  // minutes per day under it), coloured by the per-day average; no trend arrow.
  time?: boolean;
  timeWindow?: TimeWindow;
  t?: T;
}) {
  const suffix = range ? rangeSuffix(range, t) : "";
  const box = (col: string, left: React.ReactNode, big: string, trend: React.ReactNode, sub?: string, perStudent = false) => (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch" data-testid="rep-meta">
      <div className="flex flex-1 items-center gap-4 rounded-xl px-5 py-5" style={{ background: col + "1f", border: "1px solid " + col + "55" }}>
        {left}
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3">
        <div className="flex min-w-0 flex-col items-center justify-center rounded-lg bg-zinc-50 px-2 py-4 text-center">
          <div className="flex w-full items-center justify-center gap-3">
            <div className="text-4xl font-extrabold tracking-tight" style={{ color: col }}>
              {big}
            </div>
            {trend}
          </div>
          {sub && (
            <div className="mt-0.5 text-base font-bold leading-tight" style={{ color: col }} data-testid="rep-meta-per-day">
              {sub}
            </div>
          )}
          <div className="mt-1.5 w-full text-[13px] leading-tight text-zinc-500">{perStudent ? `${metricLabel} · ${t("per student")}` : `${t("Latest")} ${metricLabel}`}</div>
        </div>
      </div>
    </div>
  );
  if (student) {
    const pct = student.score == null ? null : student.score * 100;
    const col = nipColor(pct);
    return box(
      col,
      <div className="min-w-0">
        <div className="truncate text-xl font-bold leading-tight text-zinc-900" title={student.name ?? UNNAMED}>
          {student.name ?? UNNAMED}
        </div>
        <div className="mt-0.5 text-sm font-medium text-zinc-700">{t("Student")}</div>
        <div className="text-[12px] text-zinc-500">
          {student.attempts} {t("attempts")}
        </div>
      </div>,
      fmtPctInt(pct),
      pct == null ? null : <MvpTrend delta={student.delta} suffix={suffix} />,
    );
  }
  if (!child) return <p className="text-sm text-zinc-400">{t("Hover or click a row or map area to see its details.")}</p>;
  const col = time ? windowFill(child, timeWindow) : child.using_lifteracy ? nipColor(child.pass_rate) : UNCOVERED;
  return box(
    col,
    <>
      {child.official && <AvatarImg seed={child.official.avatar_seed} size={80} className="h-20 w-20" ring={col} />}
      <div className="min-w-0">
        <div className="truncate text-xl font-bold leading-tight text-zinc-900" title={child.name}>
          {child.name}
        </div>
        <div className="mt-0.5 text-sm font-medium text-zinc-700">{child.official?.name ?? t("No Lifteracy user yet")}</div>
        <div className="text-[12px] text-zinc-500">{child.official?.role_title ?? t(officer)}</div>
      </div>
    </>,
    child.using_lifteracy ? (time ? fmtDuration(child.time_sum, t) : fmtPctInt(child.pass_rate)) : "—",
    child.using_lifteracy && !time ? <MvpTrend delta={child.delta} suffix={suffix} /> : null,
    undefined,
    time && child.using_lifteracy,
  );
}

// ------------------------------------------------------------------ PDF export

export type ReportData = {
  title: string; // location path
  shareLink: string;
  metric: Metric;
  range: Range;
  // Set when the dashboard is showing Time figures for this window.
  timeWindow?: TimeWindow;
  // Test metrics: from the scores response (age_band / pass_mark).
  ageBand?: [number, number] | null;
  passMark?: number | null;
  asOf: string | null;
  root: RootStats;
  series: SeriesPoint[];
  childType: ChildType;
  childrenRows: Child[];
  mostImproved: Child[];
  spotlight: SpotlightResponse | null;
};

// rasterise an on-page <svg> to a PNG data URL (for embedding in the PDF)
function svgToPng(svgEl: SVGSVGElement | null, bg = "#ffffff"): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!svgEl) return resolve(null);
    try {
      const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
      const w = svgEl.clientWidth || (vb && vb.width) || 800;
      let h = svgEl.clientHeight || (vb && vb.height) || 400;
      if (vb && vb.width && vb.height) h = w * (vb.height / vb.width);
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(w));
      clone.setAttribute("height", String(h));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
      const im = new Image();
      im.onload = () => {
        const s = 2,
          c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * s));
        c.height = Math.max(1, Math.round(h * s));
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(im, 0, 0, c.width, c.height);
        try {
          resolve({ dataUrl: c.toDataURL("image/png"), w, h });
        } catch {
          resolve(null);
        }
      };
      im.onerror = () => resolve(null);
      im.src = url;
    } catch {
      resolve(null);
    }
  });
}

const hex = (h: string): [number, number, number] => {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const rgb = (c: string): [number, number, number] => {
  const m = c.match(/rgb\((\d+),(\d+),(\d+)\)/);
  return m ? [+m[1], +m[2], +m[3]] : hex(c);
};

export async function exportReportPdf(data: ReportData, root: HTMLElement | null): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const trendImg = await svgToPng(root ? root.querySelector<SVGSVGElement>('svg[data-rep-chart="trend"]') : null);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const PW = doc.internal.pageSize.getWidth(),
    PH = doc.internal.pageSize.getHeight(),
    M = 40,
    CW = PW - 2 * M,
    FOOT = 30;
  const AC = hex(ACCENT);
  const [nounS, nounP] = CHILD_NOUN[data.childType];
  const time = data.timeWindow != null;
  const metricLabel = time ? `${METRIC_BY[data.metric].label} · ${timeWindowSuffix(data.timeWindow!)}` : METRIC_BY[data.metric].label;
  let y = 54;

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(AC[0], AC[1], AC[2]);
  doc.text(`${data.title} Report`, PW / 2, y, { align: "center" });
  y += 15;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(150);
  // Time: the window is already in the label; the 30-day / all-time range only drives the trend chart.
  doc.text(time ? `${metricLabel} · as of ${data.asOf ?? "—"}` : `${metricLabel} · ${rangeSuffix(data.range)} · as of ${data.asOf ?? "—"}`, PW / 2, y, { align: "center" });

  // KPIs
  y += 20;
  const usingN = data.childrenRows.filter((c) => c.using_lifteracy).length;
  const kpis: [string, string, [number, number, number]][] = [
    time
      ? [fmtDuration(data.root.time_sum), `total time · ${timeWindowSuffix(data.timeWindow!)}`, rgb(windowColor(data.root.time_total, data.timeWindow))]
      : [fmtPctInt(data.root.pass_rate), `of ${ageBandLabel(ageBandOf(data.metric, data.ageBand) ?? [0, 1])} year old students pass the ${metricLabel}`, rgb(nipColor(data.root.pass_rate))],
  ];
  if (data.childType !== "student") kpis.push([`${usingN}`, `${nounP} using Lifteracy`, [24, 24, 27]]);
  const kw = (CW - 10 * (kpis.length - 1)) / kpis.length,
    kh = 58;
  kpis.forEach((k, i) => {
    const x = M + i * (kw + 10);
    doc.setDrawColor(228).setFillColor(250, 250, 250).roundedRect(x, y, kw, kh, 6, 6, "FD");
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(k[2][0], k[2][1], k[2][2]);
    doc.text(k[0], x + kw / 2, y + 23, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(110);
    doc.text(doc.splitTextToSize(k[1], kw - 14), x + kw / 2, y + 37, { align: "center" });
  });
  y += kh + 18;

  const section = (label: string) => {
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(AC[0], AC[1], AC[2]);
    doc.text(label, M, y);
    y += 10;
  };

  // trend (rasterised on-screen chart)
  section("Trend");
  if (trendImg) {
    let dw = CW,
      dh = CW * (trendImg.h / trendImg.w);
    const cap = 170;
    if (dh > cap) {
      dh = cap;
      dw = dh * (trendImg.w / trendImg.h);
    }
    doc.addImage(trendImg.dataUrl, "PNG", M + (CW - dw) / 2, y, dw, dh);
    y += dh + 12;
  } else {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
    doc.text("(chart unavailable)", M, y + 8);
    y += 20;
  }

  // latest — primitive bars
  section(`Latest ${metricLabel} — all ${nounP}`);
  {
    const arr = sortedLatest(data.childrenRows, time);
    const bh = 90,
      bx = M + 24,
      bw = CW - 24;
    // Time: minutes per student on an axis that fits the data, no target line.
    const top = time ? Math.max(10, Math.ceil(Math.max(0, ...arr.map((c) => c.time_sum ?? 0)) / 10) * 10) : 100;
    doc.setDrawColor(230).line(bx, y + bh, bx + bw, y + bh);
    if (!time) doc.setDrawColor(239, 68, 68).setLineDashPattern([3, 2], 0).line(bx, y + bh * 0.2, bx + bw, y + bh * 0.2).setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(120);
    doc.text(String(top), bx - 3, y + 4, { align: "right" });
    doc.text("0", bx - 3, y + bh + 2, { align: "right" });
    const w = bw / Math.max(1, arr.length);
    arr.forEach((c, i) => {
      const val = time ? c.time_sum : c.pass_rate;
      const has = c.using_lifteracy && val != null;
      const h = has ? (val / top) * bh : bh;
      const col: [number, number, number] = has ? rgb(time ? windowFill(c, data.timeWindow) : binColor(c.bin)) : [229, 231, 235];
      doc.setFillColor(col[0], col[1], col[2]).rect(bx + i * w + 0.3, y + bh - h, Math.max(0.6, w - 0.6), h, "F");
    });
    y += bh + 16;
  }

  // most improved — primitive bars (not shown for Time: there is no change figure)
  if (!time) {
    section(`Most improved (${rangeSuffix(data.range)})`);
    const arr = data.mostImproved.filter((c) => c.delta != null).slice(0, 5);
    if (!arr.length) {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120).text("Not enough data yet.", M, y + 8);
      y += 18;
    } else {
      const max = Math.max(1, ...arr.map((c) => Math.abs(c.delta!)));
      const lx = M + 150,
        lw = CW - 150 - 40;
      arr.forEach((c) => {
        const bw = Math.max(2, (Math.abs(c.delta!) / max) * lw);
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(70);
        doc.text(c.name.length > 32 ? c.name.slice(0, 31) + "…" : c.name, lx - 6, y + 9, { align: "right" });
        const pos = c.delta! >= 0;
        doc.setFillColor(pos ? 34 : 220, pos ? 197 : 38, pos ? 94 : 38).rect(lx, y + 2, bw, 9, "F");
        doc.setFont("helvetica", "bold").setTextColor(pos ? 22 : 220, pos ? 163 : 38, pos ? 74 : 38);
        doc.text(`${pos ? "+" : ""}${c.delta!.toFixed(1)}`, lx + bw + 4, y + 9);
        y += 14;
      });
      y += 6;
    }
  }

  // spotlight quotes
  const quotes: [string, SpotlightEntry][] = [[`Top ${nounS.toLowerCase()}`, data.spotlight?.top ?? null]];
  if (!time) quotes.push(["Most improved", data.spotlight?.most_improved ?? null]);
  section(`${CHILD_OFFICER[data.childType]} spotlight`);
  for (const [label, e] of quotes) {
    if (y > PH - M - FOOT - 30) break;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(21, 128, 61);
    const who = e ? `${label} — ${e.official?.name ?? "no Lifteracy user yet"} · ${e.child.name}` : `${label} — none yet`;
    doc.text(who, M, y + 8);
    y += 11;
    doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(60);
    const q = e?.official?.spotlight_message ? `“${e.official.spotlight_message}”` : "No spotlight message yet.";
    const lines = doc.splitTextToSize(q, CW) as string[];
    doc.text(lines, M, y + 8);
    y += lines.length * 10 + 6;
  }

  // footer / generation metadata
  const gen = new Date();
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(150);
  doc.text(`Generated ${gen.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST · ${data.shareLink} · ${metricLabel} · ${data.range === "all" ? "all-time" : `${data.range}-day`} window · Lifteracy`, M, PH - M + 6);
  doc.save(`lifteracy-${data.title.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-report.pdf`);
}

// ------------------------------------------------------------------ modal

export function ReportCardModal({ data, onClose }: { data: ReportData; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const [nounS, nounP] = CHILD_NOUN[data.childType];
  const officer = CHILD_OFFICER[data.childType];
  const time = data.timeWindow != null;
  const metricLabel = time ? `${METRIC_BY[data.metric].label} · ${timeWindowSuffix(data.timeWindow!)}` : METRIC_BY[data.metric].label;
  const usingN = data.childrenRows.filter((c) => c.using_lifteracy).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportReportPdf(data, rootEl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-2xl bg-zinc-800 px-4 py-2 text-white">
          <span className="truncate text-xs font-semibold">{data.title} · report card</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={download}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              <IconPdf /> {busy ? "Generating…" : "Download PDF"}
            </button>
            <button type="button" onClick={onClose} className="text-zinc-300 hover:text-white" aria-label="Close">
              <IconClose />
            </button>
          </div>
        </div>
        {error && <p className="px-4 pt-3 text-sm text-red-600">PDF failed — {error}</p>}
        <div ref={setRootEl} className="space-y-6 p-4 sm:p-6">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <div>
              <div className="text-lg font-black" style={{ color: ACCENT }}>
                Lifteracy
              </div>
              <div className="text-[10px] text-zinc-400">Dashboard report card</div>
            </div>
            <div className="text-right text-[10px] text-zinc-500">
              {data.title}
              <br />
              {time ? metricLabel : `${metricLabel} · ${rangeLabel(data.range)}`} · as of {data.asOf ?? "—"}
            </div>
          </div>
          <RepKpis
            root={data.root}
            metricLabel={metricLabel}
            nounP={nounP}
            usingN={usingN}
            totalN={data.childrenRows.length}
            showUsing={data.childType !== "student"}
            timeWindow={data.timeWindow}
            ageBand={time ? undefined : ageBandOf(data.metric, data.ageBand)}
          />
          <div>
            <div className="mb-1 text-sm font-semibold text-zinc-800">Trend</div>
            {time ? <RepTrend series={data.series} metric="usage" label="Minutes per student" /> : <RepTrend series={data.series} metric={data.metric} passMark={data.passMark} label={`${metricLabel} pass rate`} />}
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-zinc-800">Latest — all {nounP}</div>
            <RepLatest
              childrenRows={data.childrenRows}
              hoverId={hover}
              setHoverId={setHover}
              selId={null}
              onSelect={() => {}}
              onPick={() => {}}
              label={time ? "Total minutes" : `${metricLabel} pass rate`}
              time={time}
            />
          </div>
          {/* Time has no change figure: no "most improved" */}
          {!time && (
            <div>
              <div className="mb-1 text-sm font-semibold text-zinc-800">Most improved</div>
              <RepImproved mostImproved={data.mostImproved} hoverId={hover} setHoverId={setHover} selId={null} onSelect={() => {}} onPick={() => {}} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RepQuote kind="top" entry={data.spotlight?.top ?? null} nounS={nounS} officer={officer} time={time} />
            {!time && <RepQuote kind="improved" entry={data.spotlight?.most_improved ?? null} nounS={nounS} officer={officer} />}
          </div>
          <div className="text-[9px] text-zinc-400">
            Generated from live Lifteracy data · {data.shareLink}
          </div>
        </div>
      </div>
    </div>
  );
}
