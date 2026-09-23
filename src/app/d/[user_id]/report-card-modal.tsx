"use client";

// Report building blocks (RepKpis / RepTrend / RepLatest / RepImproved /
// RepQuote / RepMeta) used on the page, plus ReportCardModal: a preview of the
// same blocks with a one-page PDF export. jsPDF is loaded ONLY inside the
// export click handler via a dynamic import — never statically.

import { useEffect, useState } from "react";
import { AvatarImg, MvpTrend } from "./mvp-widgets";
import {
  ACCENT,
  binColor,
  CHILD_NOUN,
  CHILD_OFFICER,
  fmtPct,
  fmtPctInt,
  METRIC_BY,
  nipColor,
  UNCOVERED,
  type Child,
  type ChildType,
  type Metric,
  type Range,
  type RootStats,
  type SeriesPoint,
  UNNAMED,
  type SpotlightEntry,
  type SpotlightResponse,
  type StudentChild,
} from "./dashboard-types";
import type { T } from "./i18n";
import { IconClose, IconPdf } from "./icons";

const same: T = (s) => s;

export function useIsMobile(bp = 640): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const q = window.matchMedia(`(max-width: ${bp - 0.02}px)`);
    const f = () => setM(q.matches);
    const t = setTimeout(f, 0);
    q.addEventListener("change", f);
    return () => {
      clearTimeout(t);
      q.removeEventListener("change", f);
    };
  }, [bp]);
  return m;
}

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
  totalN,
  showUsing = true,
  t = same,
}: {
  root: RootStats;
  metricLabel: string;
  nounP: string;
  usingN: number;
  totalN: number;
  showUsing?: boolean;
  t?: T;
}) {
  const card = (big: string, label: string, color: string, key: string) => (
    <div key={key} className="flex-1 rounded-xl bg-zinc-50 px-4 py-6 text-center">
      <div className="whitespace-nowrap text-5xl font-extrabold tracking-tight" style={{ color }}>
        {big}
      </div>
      <div className="mt-1.5 whitespace-nowrap text-sm font-medium leading-tight text-zinc-500">{label}</div>
    </div>
  );
  return (
    <div className="flex flex-col gap-3 sm:flex-row" data-testid="root-kpis">
      {card(fmtPctInt(root.pass_rate), `${t("average")} ${metricLabel}`, nipColor(root.pass_rate), "pass")}
      {/* the share of children on Lifteracy follows the same red / amber / green rule as a score */}
      {showUsing && card(`${usingN} ${t("of")} ${totalN}`, `${t(nounP)} ${t("using Lifteracy")}`, nipColor(totalN > 0 ? (usingN / totalN) * 100 : null), "using")}
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
  t = same,
}: {
  series: SeriesPoint[];
  label?: string;
  metric?: Metric;
  students?: TrendStudent[];
  hoverId?: string | null;
  setHoverId?: (id: string | null) => void;
  pinId?: string | null;
  setPinId?: (id: string | null) => void;
  t?: T;
}) {
  const mobile = useIsMobile();
  const isUsage = metric === "usage";
  const showTarget = metric === "nipun_g2" || metric === "nipun_g3";
  const yLabel = label ?? t("Oral Literacy NIPUN Proxy percentage pass rate");
  const W = mobile ? 440 : 900,
    H = mobile ? 300 : 280,
    mL = mobile ? 36 : 46,
    mR = 12,
    mT = 12,
    mB = mobile ? 40 : 34,
    iw = W - mL - mR,
    ih = H - mT - mB;
  // Root value per point: the MEAN of the metric (mean score × 100, or mean
  // minutes for usage) — the average of the student lines, not the pass rate.
  const rootVal = (p: SeriesPoint) => p.mean;
  // A usage row dated D holds the previous IST day's minutes: label it by
  // that day so the axis ends at yesterday, the last complete day.
  const dayLabel = (iso: string) => fmtDay(isUsage ? shiftDay(iso, -1) : iso);
  const n = series.length;
  const byDate = new Map(series.map((p, i) => [p.date, i]));
  // Minutes axis grows with the data (multiples of 10, at least 30).
  const yMax = isUsage
    ? Math.max(30, Math.ceil(Math.max(0, ...series.map((p) => p.mean ?? 0), ...students.flatMap((s) => s.points.map((q) => q.value ?? 0))) / 10) * 10)
    : 100;
  const ticks = isUsage ? Array.from({ length: yMax / 10 + 1 }, (_, i) => i * 10) : [0, 20, 40, 60, 80, 100];
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
  const rootPts = series.map((p, i) => ({ i, v: rootVal(p) }));
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
      {showTarget && (
        <>
          <line x1={mL} x2={W - mR} y1={y(80)} y2={y(80)} stroke="#ef4444" strokeWidth={mobile ? 2 : 1.3} strokeDasharray="5 3" pointerEvents="none" />
          <text x={mL + 3} y={y(80) - 4} fontSize={mobile ? 12 : 9} fill="#ef4444" fontWeight="700" pointerEvents="none">
            {t("80% NIPUN target")}
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

export function sortedLatest(children: Child[]): Child[] {
  return children.slice().sort((a, b) => (b.using_lifteracy ? (b.pass_rate ?? -1) : -2) - (a.using_lifteracy ? (a.pass_rate ?? -1) : -2));
}

export function RepLatest({
  childrenRows,
  hoverId,
  setHoverId,
  selId,
  onSelect,
  onPick,
  label,
}: {
  childrenRows: Child[];
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selId: string | null;
  onSelect: (c: Child) => void;
  onPick: (c: Child) => void;
  label: string;
}) {
  const arr = sortedLatest(childrenRows);
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
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={mL} x2={mL + iw} y1={mT + ih - (g / 100) * ih} y2={mT + ih - (g / 100) * ih} stroke="#f1f5f9" />
          <text x={mL - 5} y={mT + ih - (g / 100) * ih + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
            {g}
          </text>
        </g>
      ))}
      <text transform={`translate(12 ${mT + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize="8.5" fill="#64748b">
        {label}
      </text>
      {arr.map((it, i) => {
        const has = it.using_lifteracy && it.pass_rate != null;
        const v = has ? it.pass_rate! : 0,
          h = has ? (v / 100) * ih : ih;
        const col = has ? binColor(it.bin) : "#e5e7eb",
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
            <title>{`${it.name} — ${has ? fmtPct(it.pass_rate) : "not using Lifteracy"}`}</title>
          </rect>
        );
      })}
      <line x1={mL} x2={mL + iw} y1={mT + ih - 0.8 * ih} y2={mT + ih - 0.8 * ih} stroke="#ef4444" strokeWidth="1.3" strokeDasharray="5 3" pointerEvents="none" />
      <text x={mL + iw} y={mT + ih - 0.8 * ih - 4} textAnchor="end" fontSize="9" fontWeight="700" fill="#ef4444" pointerEvents="none">
        80% NIPUN target
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ most improved

// Anything rankable by delta: geo children, teachers, or (class view) students.
export type ImprovedRow = { id: string; name: string; delta: number | null };

export function RepImproved<R extends ImprovedRow>({
  mostImproved,
  hoverId,
  setHoverId,
  selId,
  onSelect,
  onPick,
}: {
  mostImproved: R[];
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selId: string | null;
  onSelect: (c: R) => void;
  onPick: (c: R) => void;
}) {
  const mobile = useIsMobile();
  const arr = mostImproved.filter((c) => c.delta != null);
  // mvp2 renders nothing under the heading until there is something to rank.
  if (!arr.length) return null;
  const W = mobile ? 440 : 900,
    rowH = mobile ? 30 : 19,
    mT = 6,
    mL = mobile ? 130 : 168,
    mR = mobile ? 52 : 44,
    H = mT * 2 + arr.length * rowH;
  const max = Math.max(1, ...arr.map((i) => Math.abs(i.delta!))),
    iw = W - mL - mR;
  return (
    <svg data-rep-chart="improved" viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {arr.map((it, i) => {
        const yy = mT + i * rowH,
          bw = Math.max(2, (Math.abs(it.delta!) / max) * iw),
          hot = hoverId === it.id || selId === it.id;
        const mx = mobile ? 16 : 30;
        const nm = it.name.length > mx ? it.name.slice(0, mx - 1) + "…" : it.name;
        const pos = it.delta! >= 0;
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
              {(pos ? "+" : "") + it.delta!.toFixed(1)}
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
  t = same,
}: {
  kind: "top" | "improved";
  entry: SpotlightEntry;
  nounS: string;
  officer: string;
  range?: Range;
  t?: T;
}) {
  const title = kind === "top" ? `${t("Top")} ${t(nounS).toLowerCase()}` : t("Most improved");
  if (!entry) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-400">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">{title}</div>
        {t("No")} {t(nounS).toLowerCase()} {t("qualifies yet.")}
      </div>
    );
  }
  const { child, official } = entry;
  const when = range ? `${t("last")} ${range} ${t("days")}` : t("this week");
  const head =
    kind === "top"
      ? `${title} — ${fmtPctInt(child.pass_rate)}`
      : `${title} — ${child.delta != null && child.delta >= 0 ? "+" : ""}${child.delta?.toFixed(1) ?? "—"} ${t("pts")} ${when}`;
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
  t = same,
}: {
  child?: Child | null;
  student?: StudentChild | null;
  metricLabel: string;
  officer: string;
  range?: Range;
  t?: T;
}) {
  const suffix = range ? `${t("last")} ${range} ${t("days")}` : "";
  const box = (col: string, left: React.ReactNode, big: string, trend: React.ReactNode) => (
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
          <div className="mt-1.5 w-full text-[13px] leading-tight text-zinc-500">
            {t("Latest")} {metricLabel}
          </div>
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
  const col = child.using_lifteracy ? nipColor(child.pass_rate) : UNCOVERED;
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
    child.using_lifteracy ? fmtPctInt(child.pass_rate) : "—",
    child.using_lifteracy ? <MvpTrend delta={child.delta} suffix={suffix} /> : null,
  );
}

// ------------------------------------------------------------------ PDF export

export type ReportData = {
  title: string; // location path
  shareLink: string;
  metric: Metric;
  range: Range;
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
  const metricLabel = METRIC_BY[data.metric].label;
  let y = 54;

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(AC[0], AC[1], AC[2]);
  doc.text(`${data.title} Report`, PW / 2, y, { align: "center" });
  y += 15;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(150);
  doc.text(`${metricLabel} · last ${data.range} days · as of ${data.asOf ?? "—"}`, PW / 2, y, { align: "center" });

  // KPIs
  y += 20;
  const usingN = data.childrenRows.filter((c) => c.using_lifteracy).length;
  const kpis: [string, string, [number, number, number]][] = [[fmtPctInt(data.root.pass_rate), `average ${metricLabel}`, rgb(nipColor(data.root.pass_rate))]];
  if (data.childType !== "student") kpis.push([`${usingN} of ${data.childrenRows.length}`, `${nounP} using Lifteracy`, [22, 163, 74]]);
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
    const arr = sortedLatest(data.childrenRows);
    const bh = 90,
      bx = M + 24,
      bw = CW - 24;
    doc.setDrawColor(230).line(bx, y + bh, bx + bw, y + bh);
    doc.setDrawColor(239, 68, 68).setLineDashPattern([3, 2], 0).line(bx, y + bh * 0.2, bx + bw, y + bh * 0.2).setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(120);
    doc.text("100", bx - 3, y + 4, { align: "right" });
    doc.text("0", bx - 3, y + bh + 2, { align: "right" });
    const w = bw / Math.max(1, arr.length);
    arr.forEach((c, i) => {
      const has = c.using_lifteracy && c.pass_rate != null;
      const h = has ? (c.pass_rate! / 100) * bh : bh;
      const col: [number, number, number] = has ? rgb(binColor(c.bin)) : [229, 231, 235];
      doc.setFillColor(col[0], col[1], col[2]).rect(bx + i * w + 0.3, y + bh - h, Math.max(0.6, w - 0.6), h, "F");
    });
    y += bh + 16;
  }

  // most improved — primitive bars
  section(`Most improved (last ${data.range} days)`);
  {
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
  const quotes: [string, SpotlightEntry][] = [
    [`Top ${nounS.toLowerCase()}`, data.spotlight?.top ?? null],
    ["Most improved", data.spotlight?.most_improved ?? null],
  ];
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
  doc.text(`Generated ${gen.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST · ${data.shareLink} · ${metricLabel} · ${data.range}-day window · Lifteracy`, M, PH - M + 6);
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
  const metricLabel = METRIC_BY[data.metric].label;
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
              {metricLabel} · {data.range} days · as of {data.asOf ?? "—"}
            </div>
          </div>
          <RepKpis root={data.root} metricLabel={metricLabel} nounP={nounP} usingN={usingN} totalN={data.childrenRows.length} showUsing={data.childType !== "student"} />
          <div>
            <div className="mb-1 text-sm font-semibold text-zinc-800">Trend</div>
            <RepTrend series={data.series} label={`${metricLabel} pass rate`} />
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-zinc-800">Latest — all {nounP}</div>
            <RepLatest childrenRows={data.childrenRows} hoverId={hover} setHoverId={setHover} selId={null} onSelect={() => {}} onPick={() => {}} label={`${metricLabel} pass rate`} />
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold text-zinc-800">Most improved</div>
            <RepImproved mostImproved={data.mostImproved} hoverId={hover} setHoverId={setHover} selId={null} onSelect={() => {}} onPick={() => {}} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RepQuote kind="top" entry={data.spotlight?.top ?? null} nounS={nounS} officer={officer} />
            <RepQuote kind="improved" entry={data.spotlight?.most_improved ?? null} nounS={nounS} officer={officer} />
          </div>
          <div className="text-[9px] text-zinc-400">
            Generated from live Lifteracy data · {data.shareLink}
          </div>
        </div>
      </div>
    </div>
  );
}
