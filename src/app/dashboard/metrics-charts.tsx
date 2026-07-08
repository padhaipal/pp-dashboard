"use client";

import { useState, useEffect, useMemo } from "react";

interface SummaryDay {
  date: string; // IST YYYY-MM-DD
  users_over_5min: number;
  active_ms: number;
  letters_learnt: number; // stock at end of day (can go down)
}

type View = "increment" | "accumulated";
type Period = "day" | "week" | "month" | "year" | "all";

const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "day", label: "Day", days: 2 }, // yesterday + today (partial)
  { key: "week", label: "Week", days: 7 },
  { key: "month", label: "Month", days: 30 },
  { key: "year", label: "Year", days: 365 },
  { key: "all", label: "All time", days: null },
];

const NEGATIVE_COLOR = "#ef4444";

interface MetricSeries {
  title: string;
  yLabel: string;
  color: string;
  // aligned with dates[]; increments and running totals over full history
  increments: number[];
  accumulated: number[];
  format: (v: number) => string;
}

function cumsum(values: number[]): number[] {
  let acc = 0;
  return values.map((v) => (acc += v));
}

function buildSeries(daily: SummaryDay[]): MetricSeries[] {
  const users = daily.map((d) => d.users_over_5min);
  const minutes = daily.map((d) => d.active_ms / 60000);
  const lettersStock = daily.map((d) => d.letters_learnt);
  const lettersInc = lettersStock.map((v, i) =>
    i === 0 ? v : v - lettersStock[i - 1],
  );
  const fmtInt = (v: number) => Math.round(v).toLocaleString();
  return [
    {
      title: "Users >5 min",
      yLabel: "Users",
      color: "#10b981",
      increments: users,
      accumulated: cumsum(users),
      format: fmtInt,
    },
    {
      title: "Minutes spent",
      yLabel: "Minutes",
      color: "#3b82f6",
      increments: minutes,
      accumulated: cumsum(minutes),
      format: fmtInt,
    },
    {
      title: "Letters learnt",
      yLabel: "Letters",
      color: "#f59e0b",
      increments: lettersInc,
      accumulated: lettersStock,
      format: fmtInt,
    },
  ];
}

// Recessive y-axis ticks: ~4 "nice" values spanning [min, max], 0 included.
function niceTicks(min: number, max: number): number[] {
  const span = max - min || 1;
  const rawStep = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step =
    [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? rawStep;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + 1e-9; v += step) {
    ticks.push(Math.abs(v) < 1e-9 ? 0 : v);
  }
  if (!ticks.includes(0) && min <= 0 && max >= 0) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }
  return ticks;
}

function downloadCsv(
  dates: string[],
  series: MetricSeries[],
  view: View,
  from: number,
  period: Period,
) {
  const header = ["date", ...series.map((s) => s.title)];
  const rows = dates.map((d, i) => [
    d,
    ...series.map((s) => {
      const full = view === "increment" ? s.increments : s.accumulated;
      return String(Math.round(full[from + i] * 100) / 100);
    }),
  ]);
  const escape = (cell: string) =>
    /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  const csv = [header, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-metrics-${view}-${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const W = 320;
const H = 190;
const PAD = { top: 10, right: 10, bottom: 34, left: 40 };

function MetricChart({
  dates,
  values,
  view,
  color,
  yLabel,
  todayIso,
  format,
}: {
  dates: string[];
  values: number[];
  view: View;
  color: string;
  yLabel: string;
  todayIso: string;
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const vMin = Math.min(0, ...values);
  const vMax = Math.max(0, ...values);
  const ticks = niceTicks(vMin, vMax);
  const yLow = Math.min(vMin, ticks[0]);
  const yHigh = Math.max(vMax, ticks[ticks.length - 1]);
  const yRange = yHigh - yLow || 1;

  const y = (v: number) => PAD.top + plotH - ((v - yLow) / yRange) * plotH;
  const n = values.length;
  const band = plotW / n;
  const xMid = (i: number) => PAD.left + band * (i + 0.5);
  // 2px surface gap between bars where there's room
  const barW = Math.max(1, Math.min(16, band - 2));

  // ~5 evenly spaced x-axis date labels
  const labelCount = Math.min(5, n);
  const labelIdx = new Set(
    Array.from({ length: labelCount }, (_, k) =>
      Math.round((k * (n - 1)) / Math.max(1, labelCount - 1)),
    ),
  );

  const linePath = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${xMid(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");

  const hoverV = hover !== null ? values[hover] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* grid + y tick labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            y1={y(t)}
            x2={W - PAD.right}
            y2={y(t)}
            stroke={t === 0 ? "#a1a1aa" : "#e4e4e7"}
            strokeWidth={t === 0 ? 1 : 0.5}
          />
          <text
            x={PAD.left - 6}
            y={y(t) + 3}
            textAnchor="end"
            fontSize={9}
            className="fill-zinc-400"
          >
            {Math.abs(t) >= 1000
              ? `${Number((t / 1000).toFixed(1))}k`
              : Number(t.toFixed(2))}
          </text>
        </g>
      ))}

      {/* x tick labels */}
      {dates.map((d, i) =>
        labelIdx.has(i) ? (
          <text
            key={d}
            x={xMid(i)}
            y={H - PAD.bottom + 12}
            textAnchor="middle"
            fontSize={8}
            className="fill-zinc-400"
          >
            {d.slice(5)}
          </text>
        ) : null,
      )}

      {/* axis titles */}
      <text
        x={PAD.left + plotW / 2}
        y={H - 2}
        textAnchor="middle"
        fontSize={9}
        className="fill-zinc-500"
      >
        Date (IST)
      </text>
      <text
        x={10}
        y={PAD.top + plotH / 2}
        textAnchor="middle"
        fontSize={9}
        className="fill-zinc-500"
        transform={`rotate(-90 10 ${PAD.top + plotH / 2})`}
      >
        {yLabel}
      </text>

      {/* marks */}
      {view === "increment" ? (
        values.map((v, i) => {
          const top = Math.min(y(v), y(0));
          const h = Math.abs(y(v) - y(0));
          return (
            <rect
              key={dates[i]}
              x={xMid(i) - barW / 2}
              y={top}
              width={barW}
              height={Math.max(h, v === 0 ? 0 : 1)}
              rx={barW >= 4 ? 2 : 0}
              fill={v < 0 ? NEGATIVE_COLOR : color}
              opacity={dates[i] === todayIso ? 0.45 : hover === i ? 1 : 0.85}
            />
          );
        })
      ) : (
        <>
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
          {n > 0 && (
            <circle
              cx={xMid(n - 1)}
              cy={y(values[n - 1])}
              r={3}
              fill={color}
              opacity={dates[n - 1] === todayIso ? 0.45 : 1}
            />
          )}
          {hover !== null && (
            <circle cx={xMid(hover)} cy={y(values[hover])} r={4} fill={color} />
          )}
        </>
      )}

      {/* hover crosshair + hit targets */}
      {hover !== null && (
        <line
          x1={xMid(hover)}
          y1={PAD.top}
          x2={xMid(hover)}
          y2={PAD.top + plotH}
          stroke="#a1a1aa"
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
      )}
      {dates.map((d, i) => (
        <rect
          key={`hit-${d}`}
          x={PAD.left + band * i}
          y={PAD.top}
          width={band}
          height={plotH}
          fill="transparent"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        />
      ))}

      {/* tooltip */}
      {hover !== null && hoverV !== null && (
        <g pointerEvents="none">
          {(() => {
            const boxW = 92;
            const bx = Math.min(
              Math.max(xMid(hover) - boxW / 2, PAD.left),
              W - PAD.right - boxW,
            );
            return (
              <>
                <rect
                  x={bx}
                  y={PAD.top}
                  width={boxW}
                  height={26}
                  rx={3}
                  fill="#18181b"
                  opacity={0.92}
                />
                <text x={bx + 6} y={PAD.top + 11} fontSize={8} fill="#d4d4d8">
                  {dates[hover]}
                  {dates[hover] === todayIso ? " (partial)" : ""}
                </text>
                <text
                  x={bx + 6}
                  y={PAD.top + 21}
                  fontSize={9}
                  fontWeight={600}
                  fill="#fafafa"
                >
                  {format(hoverV)} {yLabel.toLowerCase()}
                </text>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

export function MetricsCharts() {
  const [daily, setDaily] = useState<SummaryDay[] | null>(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState<View>("increment");
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/proxy/users/dashboard/summary");
        if (!res.ok) {
          setError(true);
          return;
        }
        const data: { daily: SummaryDay[] } = await res.json();
        setDaily(data.daily);
      } catch {
        setError(true);
      }
    })();
  }, []);

  const series = useMemo(() => (daily ? buildSeries(daily) : []), [daily]);

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6">
        <p className="text-zinc-400 text-sm text-center">
          Failed to load metrics
        </p>
      </div>
    );
  }
  if (daily === null) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6">
        <p className="text-zinc-400 text-sm text-center">Loading metrics...</p>
      </div>
    );
  }
  if (daily.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6">
        <p className="text-zinc-400 text-sm text-center">No data yet</p>
      </div>
    );
  }

  // The series always ends on the server's IST "today" (a partial day); the
  // bucket before it is the last complete day.
  const todayIso = daily[daily.length - 1].date;
  const yesterdayIdx = daily.length - 2;

  const periodDays = PERIODS.find((p) => p.key === period)!.days;
  const from = periodDays === null ? 0 : Math.max(0, daily.length - periodDays);
  const dates = daily.slice(from).map((d) => d.date);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex rounded-md border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {(["increment", "accumulated"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium ${
                view === v
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {v === "increment" ? "Increment" : "Accumulated"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-zinc-200 bg-white shadow-sm overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-xs font-medium ${
                  period === p.key
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => downloadCsv(dates, series, view, from, period)}
            className="rounded-md border border-zinc-200 bg-white shadow-sm px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {series.map((s) => {
          const full = view === "increment" ? s.increments : s.accumulated;
          const values = full.slice(from);
          const headline =
            yesterdayIdx >= 0 ? full[yesterdayIdx] : full[full.length - 1];
          return (
            <div
              key={s.title}
              className="bg-white rounded-lg border border-zinc-200 shadow-sm p-4"
            >
              <h2 className="text-sm font-medium text-zinc-500">{s.title}</h2>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-semibold text-zinc-900">
                  {s.format(headline)}
                </span>
                <span className="text-xs text-zinc-400">
                  {view === "increment" ? "yesterday" : "as of yesterday"}
                </span>
              </div>
              <MetricChart
                dates={dates}
                values={values}
                view={view}
                color={s.color}
                yLabel={s.yLabel}
                todayIso={todayIso}
                format={s.format}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-400 mt-1.5">
        IST midnight-to-midnight buckets. Today (faded) is a partial day.
        Letters learnt can decrease when a child regresses.
      </p>
    </div>
  );
}
