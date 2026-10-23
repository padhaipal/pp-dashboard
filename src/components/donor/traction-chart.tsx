"use client";

// The donor page's Traction section body: two headline figures (all-time
// hours on LIFTeracy, students), then the chart card — one series at a time from 1 April,
// one point per IST day (no averaging), its units on the y-axis. Above it
// the /d page's pill toggle picks the series (minutes by default). "Monthly
// active students" is a bar chart instead (MonthlyBars). Data: GET
// users/dashboard/traction (public proxy) — aggregates only, computed once
// a day by pp-sketch.

import { useEffect, useMemo, useState } from "react";
import { MvpMetricToggle } from "@/app/d/[user_id]/mvp-widgets";
import { niceTicks } from "@/app/dashboard/metrics-charts";
import { useIsMobile } from "@/app/d/[user_id]/use-is-mobile";
import {
  monthLabel,
  seriesOf,
  shortDate,
  TRACTION_METRICS,
  TRACTION_URL,
  type TractionChoice,
  type TractionMonth,
  type TractionResponse,
} from "./traction-data";

// colours are the globals.css brand tokens: the line and "joined in an
// earlier month" bars brand-ink, "joined this month" brand-mute
const SELECTED = "rounded-full bg-brand-ink px-3.5 py-1.5 text-white shadow-sm transition";

// drawing size: a narrower viewBox on phones keeps the type readable
const SIZE = { desktop: { W: 720, H: 300 }, mobile: { W: 420, H: 320 } };
const PAD = { top: 14, right: 16, bottom: 36, left: 56 };

export function TractionChart() {
  const [data, setData] = useState<TractionResponse | null>(null);
  const [error, setError] = useState(false);
  const [metric, setMetric] = useState<TractionChoice>(TRACTION_METRICS[0].key);
  const [hover, setHover] = useState<number | null>(null);
  const mobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    fetch(TRACTION_URL)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as TractionResponse;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const daily = useMemo(() => data?.daily ?? [], [data]);
  const cfg = TRACTION_METRICS.find((m) => m.key === metric)!;
  const values = useMemo(() => (metric === "monthly" ? [] : seriesOf(daily, metric)), [daily, metric]);
  const monthly = data?.monthly ?? [];
  const size = mobile ? SIZE.mobile : SIZE.desktop;

  return (
    <>
      {!data && !error && <HeadlineSkeleton />}
      {data?.totals && <Headline hours={data.totals.hours} students={data.totals.students} />}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6" data-testid="traction-chart">
      <div className="mb-4 flex justify-center">
        <MvpMetricToggle metric={metric} setMetric={setMetric} options={TRACTION_METRICS} selectedClass={SELECTED} />
      </div>
      {error && <p className="py-16 text-center text-sm text-zinc-500">Traction figures are unavailable right now.</p>}
      {!error && !data && <div className={"w-full animate-pulse rounded-lg bg-zinc-100 " + (mobile ? "aspect-[21/16]" : "aspect-[12/5]")} data-testid="traction-skeleton" aria-label="Loading" />}
      {metric === "monthly" ? (
        <>
          {data && monthly.length === 0 && <p className="py-16 text-center text-sm text-zinc-400">No data yet.</p>}
          {data && monthly.length > 0 && <MonthlyBars size={size} months={monthly} />}
        </>
      ) : (
        <>
          {data && daily.length === 0 && <p className="py-16 text-center text-sm text-zinc-400">No data yet.</p>}
          {data && daily.length > 0 && <Plot size={size} dates={daily.map((d) => d.date)} values={values} unit={cfg.unit} format={cfg.format} hover={hover} setHover={setHover} />}
        </>
      )}
      {data && (
        <div className="mt-1 text-right text-xs text-zinc-500">
          {metric === "monthly" ? "Monthly" : "Daily"}, India time · updated {shortDate(data.computed_at.slice(0, 10))}
        </div>
      )}
      </div>
    </>
  );
}

function Headline({ hours, students }: { hours: number; students: number }) {
  const figs: [string, number, string][] = [
    ["traction-hours", hours, "hours spent learning on LIFTeracy"],
    ["traction-students", students, "students"],
  ];
  return (
    <div className="mb-8 grid grid-cols-2 gap-6 sm:max-w-2xl" data-testid="traction-headline">
      {figs.map(([id, v, label]) => (
        <div key={id}>
          <div className="text-4xl font-extrabold tracking-tight text-brand-ink sm:text-6xl" data-testid={id}>
            {v.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-600 sm:text-base">{label}</div>
        </div>
      ))}
    </div>
  );
}

// same footprint as Headline, so the page doesn't jump when the data lands
function HeadlineSkeleton() {
  return (
    <div className="mb-8 grid grid-cols-2 gap-6 sm:max-w-2xl" aria-hidden="true" data-testid="traction-headline-skeleton">
      {[0, 1].map((k) => (
        <div key={k}>
          <div className="h-10 w-3/4 animate-pulse rounded-md bg-blue-100 sm:h-[3.75rem]" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-blue-100 sm:h-5" />
        </div>
      ))}
    </div>
  );
}

function Plot({
  size: { W, H },
  dates,
  values: sel,
  unit,
  format,
  hover,
  setHover,
}: {
  size: { W: number; H: number };
  dates: string[];
  values: (number | null)[];
  unit: string;
  format: (v: number) => string;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const n = dates.length;
  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // the series' own "nice" axis from 0
  const selMax = Math.max(0, ...sel.filter((v): v is number => v !== null));
  // niceTicks can stop a step short of the maximum: add the tick above it
  const ticks = niceTicks(0, selMax || 1);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  while (ticks[ticks.length - 1] < selMax) ticks.push(ticks[ticks.length - 1] + step);
  const top = ticks[ticks.length - 1] || 1;
  const yOf = (v: number, max: number) => PAD.top + plotH - (v / (max || 1)) * plotH;

  // a line as path segments (a null breaks it)
  const path = (vals: (number | null)[], max: number) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${yOf(v, max).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  // ~6 x labels
  const labelCount = Math.min(W < 600 ? 4 : 6, n);
  const labelIdx = new Set(Array.from({ length: labelCount }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, labelCount - 1))));
  const hv = hover !== null ? sel[hover] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" onMouseLeave={() => setHover(null)}>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={PAD.left} y1={yOf(tk, top)} x2={W - PAD.right} y2={yOf(tk, top)} stroke={tk === 0 ? "#a1a1aa" : "#e4e4e7"} strokeWidth={tk === 0 ? 1 : 0.5} />
          <text x={PAD.left - 6} y={yOf(tk, top) + 3} textAnchor="end" fontSize={12} className="fill-zinc-500">
            {Math.abs(tk) >= 1000 ? `${Number((tk / 1000).toFixed(1))}k` : Number(tk.toFixed(2))}
          </text>
        </g>
      ))}
      {dates.map((d, i) =>
        labelIdx.has(i) ? (
          <text key={d} x={x(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={12} className="fill-zinc-500">
            {shortDate(d)}
          </text>
        ) : null,
      )}
      <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" fontSize={12} className="fill-zinc-500" transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}>
        {unit}
      </text>

      <path d={path(sel, top)} fill="none" className="stroke-brand-ink" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" data-testid="traction-line" />

      {hover !== null && (
        <>
          <line x1={x(hover)} y1={PAD.top} x2={x(hover)} y2={PAD.top + plotH} stroke="#a1a1aa" strokeWidth={0.5} strokeDasharray="2,2" />
          {hv !== null && <circle cx={x(hover)} cy={yOf(hv, top)} r={4} className="fill-brand-ink" />}
        </>
      )}
      {dates.map((d, i) => {
        const half = n === 1 ? plotW / 2 : plotW / (n - 1) / 2;
        return <rect key={`hit-${d}`} x={x(i) - half} y={PAD.top} width={half * 2} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />;
      })}
      {hover !== null && (
        <g pointerEvents="none">
          {(() => {
            const boxW = 170;
            const bx = Math.min(Math.max(x(hover) - boxW / 2, PAD.left), W - PAD.right - boxW);
            return (
              <>
                <rect x={bx} y={PAD.top} width={boxW} height={38} rx={4} fill="#18181b" opacity={0.92} />
                <text x={bx + 8} y={PAD.top + 13} fontSize={12} fill="#d4d4d8">
                  {shortDate(dates[hover])}
                </text>
                <text x={bx + 8} y={PAD.top + 30} fontSize={12} fontWeight={600} fill="#fafafa">
                  {hv === null ? "—" : `${format(hv)} ${unit.toLowerCase()}`}
                </text>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

// "Monthly active students": one stacked bar per IST month — students with
// at least one 5-minute day that month, dark = onboarded in an earlier
// month, light = onboarded that month, total above. The month in progress
// also gets a dashed overlay up to its linear month-end projection.
function MonthlyBars({ size: { W, H }, months }: { size: { W: number; H: number }; months: TractionMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top0 = 6; // room for the total over the tallest bar
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - top0 - PAD.top - PAD.bottom;
  const y0 = top0 + PAD.top + plotH;
  const n = months.length;
  const slot = plotW / n;
  const barW = Math.min(64, slot * 0.6);
  const total = (m: TractionMonth) => m.joined_earlier + m.joined_this_month;
  const projected = (m: TractionMonth) => (m.projected_joined_earlier === null || m.projected_joined_this_month === null ? null : m.projected_joined_earlier + m.projected_joined_this_month);
  const maxV = Math.max(1, ...months.map((m) => Math.max(total(m), projected(m) ?? 0)));
  const ticks = niceTicks(0, maxV);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  while (ticks[ticks.length - 1] < maxV) ticks.push(ticks[ticks.length - 1] + step);
  const top = ticks[ticks.length - 1] || 1;
  const h = (v: number) => (v / top) * plotH;
  const hm = hover !== null ? months[hover] : null;

  return (
    <div>
      <div className="mb-1 text-center text-sm font-semibold text-zinc-700">Children who completed at least one 5-minute lesson in the month</div>
      <div className="mb-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-brand-ink" />
          Joined in an earlier month
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-brand-mute" />
          Joined this month
        </span>
        {months.some((m) => projected(m) !== null) && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-dashed border-zinc-600" />
            Projected by month end
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" data-testid="traction-monthly" onMouseLeave={() => setHover(null)}>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={PAD.left} y1={y0 - h(tk)} x2={W - PAD.right} y2={y0 - h(tk)} stroke={tk === 0 ? "#a1a1aa" : "#e4e4e7"} strokeWidth={tk === 0 ? 1 : 0.5} />
            <text x={PAD.left - 6} y={y0 - h(tk) + 3} textAnchor="end" fontSize={12} className="fill-zinc-500">
              {Math.abs(tk) >= 1000 ? `${Number((tk / 1000).toFixed(1))}k` : tk}
            </text>
          </g>
        ))}
        <text x={14} y={y0 - plotH / 2} textAnchor="middle" fontSize={12} className="fill-zinc-500" transform={`rotate(-90 14 ${y0 - plotH / 2})`}>
          Students
        </text>
        {months.map((m, i) => {
          const cx = PAD.left + slot * (i + 0.5);
          const x = cx - barW / 2;
          const hE = h(m.joined_earlier);
          const hT = h(m.joined_this_month);
          const p = projected(m);
          const label = p !== null ? `${total(m)} → ~${p}` : String(total(m));
          const labelTop = Math.max(h(total(m)), p !== null ? h(p) : 0);
          return (
            <g key={m.month} data-testid="traction-bar">
              {p !== null && (
                <rect x={x} y={y0 - h(p)} width={barW} height={h(p)} fill="#f4f4f5" stroke="#52525b" strokeWidth={1.2} strokeDasharray="4,3" data-testid="traction-projection" />
              )}
              <rect x={x} y={y0 - hE} width={barW} height={hE} className="fill-brand-ink" />
              <rect x={x} y={y0 - hE - hT} width={barW} height={hT} className="fill-brand-mute" />
              <text x={cx} y={y0 - labelTop - 5} textAnchor="middle" fontSize={12} fontWeight={700} className="fill-zinc-700">
                {label}
              </text>
              <text x={cx} y={y0 + 14} textAnchor="middle" fontSize={12} className="fill-zinc-500">
                {monthLabel(m.month).slice(0, 3)}
              </text>
              <rect x={cx - slot / 2} y={top0} width={slot} height={y0 - top0} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            </g>
          );
        })}
        {hm && hover !== null && (
          <g pointerEvents="none">
            {(() => {
              const p = projected(hm);
              const lines = [`${hm.joined_earlier} joined earlier`, `${hm.joined_this_month} joined this month`];
              if (p !== null) lines.push(`~${p} projected by month end`);
              const boxW = 200;
              const boxH = 20 + lines.length * 15;
              const cx = PAD.left + slot * (hover + 0.5);
              const bx = Math.min(Math.max(cx - boxW / 2, PAD.left), W - PAD.right - boxW);
              return (
                <>
                  <rect x={bx} y={top0 + PAD.top} width={boxW} height={boxH} rx={4} fill="#18181b" opacity={0.92} />
                  <text x={bx + 8} y={top0 + PAD.top + 13} fontSize={12} fill="#d4d4d8">
                    {monthLabel(hm.month)}
                  </text>
                  {lines.map((l, k) => (
                    <text key={l} x={bx + 8} y={top0 + PAD.top + 30 + k * 15} fontSize={12} fontWeight={600} fill="#fafafa">
                      {l}
                    </text>
                  ))}
                </>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}
