"use client";

// The donor page's Traction chart: one series at a time from 1 August,
// one point per IST day (no averaging), its units on the y-axis. Above it
// the /d page's pill toggle picks the series. A cohort series (`dots`) is
// drawn as one dot per day, with a note that a missing dot is a day nobody
// was onboarded. Data: GET users/dashboard/traction (public proxy) —
// aggregates only, computed once a day by pp-sketch.

import { useEffect, useMemo, useState } from "react";
import { MvpMetricToggle } from "@/app/d/[user_id]/mvp-widgets";
import { niceTicks } from "@/app/dashboard/metrics-charts";
import { useIsMobile } from "@/app/d/[user_id]/use-is-mobile";
import {
  seriesOf,
  shortDate,
  TRACTION_METRICS,
  TRACTION_URL,
  type TractionKey,
  type TractionResponse,
} from "./traction-data";

// the /d toggle's selected pill (bg-blue-600)
const LINE = "#2563eb";

// drawing size: a narrower viewBox on phones keeps the type readable
const SIZE = { desktop: { W: 720, H: 300 }, mobile: { W: 420, H: 320 } };
const PAD = { top: 14, right: 16, bottom: 34, left: 52 };

export function TractionChart() {
  const [data, setData] = useState<TractionResponse | null>(null);
  const [error, setError] = useState(false);
  const [metric, setMetric] = useState<TractionKey>("users_over_5min");
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
  const values = useMemo(() => seriesOf(daily, metric), [daily, metric]);

  return (
    <div data-testid="traction-chart">
      <div className="mb-4 flex justify-center">
        <MvpMetricToggle metric={metric} setMetric={setMetric} options={TRACTION_METRICS} />
      </div>
      {error && <p className="py-16 text-center text-sm text-zinc-400">Traction figures are unavailable right now.</p>}
      {!error && !data && <p className="py-16 text-center text-sm text-zinc-400">Loading…</p>}
      {data && daily.length === 0 && <p className="py-16 text-center text-sm text-zinc-400">No data yet.</p>}
      {data && daily.length > 0 && (
        <Plot size={mobile ? SIZE.mobile : SIZE.desktop} dates={daily.map((d) => d.date)} values={values} dots={!!cfg.dots} unit={cfg.unit} format={cfg.format} hover={hover} setHover={setHover} />
      )}
      {data && daily.length > 0 && cfg.note && (
        <p className="mt-2 text-center text-xs text-zinc-500" data-testid="traction-note">
          {cfg.note}
        </p>
      )}
      {data && (
        <div className="mt-1 text-right text-[10px] text-zinc-400">
          Daily, India time · updated {shortDate(data.computed_at.slice(0, 10))}
        </div>
      )}
    </div>
  );
}

function Plot({
  size: { W, H },
  dates,
  values: sel,
  dots,
  unit,
  format,
  hover,
  setHover,
}: {
  size: { W: number; H: number };
  dates: string[];
  values: (number | null)[];
  dots: boolean;
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
          <text x={PAD.left - 6} y={yOf(tk, top) + 3} textAnchor="end" fontSize={10} className="fill-zinc-400">
            {Math.abs(tk) >= 1000 ? `${Number((tk / 1000).toFixed(1))}k` : Number(tk.toFixed(2))}
          </text>
        </g>
      ))}
      {dates.map((d, i) =>
        labelIdx.has(i) ? (
          <text key={d} x={x(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={10} className="fill-zinc-400">
            {shortDate(d)}
          </text>
        ) : null,
      )}
      <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" fontSize={10} className="fill-zinc-500" transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}>
        {unit}
      </text>

      {dots ? (
        sel.map((v, i) => (v === null ? null : <circle key={dates[i]} cx={x(i)} cy={yOf(v, top)} r={3} fill={LINE} data-testid="traction-dot" />))
      ) : (
        <path d={path(sel, top)} fill="none" stroke={LINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" data-testid="traction-line" />
      )}

      {hover !== null && (
        <>
          <line x1={x(hover)} y1={PAD.top} x2={x(hover)} y2={PAD.top + plotH} stroke="#a1a1aa" strokeWidth={0.5} strokeDasharray="2,2" />
          {hv !== null && <circle cx={x(hover)} cy={yOf(hv, top)} r={dots ? 5 : 4} fill={LINE} />}
        </>
      )}
      {dates.map((d, i) => {
        const half = n === 1 ? plotW / 2 : plotW / (n - 1) / 2;
        return <rect key={`hit-${d}`} x={x(i) - half} y={PAD.top} width={half * 2} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />;
      })}
      {hover !== null && (
        <g pointerEvents="none">
          {(() => {
            const boxW = 150;
            const bx = Math.min(Math.max(x(hover) - boxW / 2, PAD.left), W - PAD.right - boxW);
            return (
              <>
                <rect x={bx} y={PAD.top} width={boxW} height={34} rx={4} fill="#18181b" opacity={0.92} />
                <text x={bx + 8} y={PAD.top + 13} fontSize={10} fill="#d4d4d8">
                  {shortDate(dates[hover])}
                </text>
                <text x={bx + 8} y={PAD.top + 27} fontSize={11} fontWeight={600} fill="#fafafa">
                  {hv === null ? (dots ? "No one onboarded" : "—") : `${format(hv)} ${unit.toLowerCase()}`}
                </text>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
