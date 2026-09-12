"use client";

// Small widgets ported from mvp2.html's /mvp dashboard: share bar, metric and
// range toggles, trend arrow, per-entity trend/activity charts and the modal
// that opens from a child row. Every number comes from the pp-sketch API.

import Image from "next/image";
import { useEffect, useState } from "react";
import { avatarUrl, seedFor } from "./avatar";
import {
  CHILD_OFFICER,
  csvUrl,
  DEFAULT_RANGE,
  fmtPct,
  METRIC_BY,
  METRICS,
  RANGES,
  scoresUrl,
  UNCOVERED,
  binColor,
  binOf,
  type Child,
  type ChildType,
  type Metric,
  type Range,
  type ScoresResponse,
  type SeriesPoint,
  type StudentChild,
} from "./dashboard-types";
import { IconClose, IconCopy, IconDownload, IconQuestion } from "./icons";

// ------------------------------------------------------------------ avatar

export function AvatarImg({
  seed,
  size,
  className,
  ring,
}: {
  seed: string | null | undefined;
  size: number;
  className?: string;
  ring?: string;
}) {
  const s = seedFor(seed, "lifteracy");
  return (
    <Image
      src={avatarUrl(s)}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={"flex-shrink-0 rounded-full bg-white object-cover " + (className ?? "")}
      style={ring ? { boxShadow: `0 0 0 3px ${ring}` } : undefined}
    />
  );
}

// ------------------------------------------------------------------ trend arrow

// stock-style zig-zag trend arrow — up (green) / down (red) / flat (grey) when
// |Δ| < 0.5; null → "no change data".
export function MvpTrend({ delta, suffix = "" }: { delta: number | null; suffix?: string }) {
  const flat = delta == null || Math.abs(delta) < 0.5;
  const up = (delta ?? 0) > 0;
  const color = flat ? "#71717a" : up ? "#16a34a" : "#dc2626";
  const stroke = { fill: "none", stroke: color, strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <span className="inline-flex items-center gap-1 align-middle" data-testid="mvp-trend">
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        {flat ? (
          <g {...stroke}>
            <path d="M3 15 L8 10.5 L11 13.5 L19.5 12" />
            <path d="M15.6 8.6 L20.5 12 L15.6 15.4" />
          </g>
        ) : (
          <g {...stroke} transform={up ? undefined : "scale(1,-1) translate(0,-24)"}>
            <path d="M3 17 L9 11 L12 14 L19 7" />
            <path d="M13.8 7 L19 7 L19 12.2" />
          </g>
        )}
      </svg>
      <span className="text-lg font-bold tabular-nums" style={{ color }}>
        {delta == null ? "—" : (delta >= 0 ? "+" : "") + delta.toFixed(1) + " pts"}
        {suffix ? <span className="ml-1 text-xs font-medium text-zinc-500">{suffix}</span> : null}
      </span>
    </span>
  );
}

// ------------------------------------------------------------------ toggles

export function MvpMetricToggle({ metric, setMetric }: { metric: Metric; setMetric: (m: Metric) => void }) {
  return (
    <div className="inline-flex max-w-full flex-wrap overflow-hidden rounded-lg border border-zinc-300 bg-white text-xs font-semibold shadow-sm" role="group" aria-label="Metric">
      {METRICS.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => setMetric(m.key)}
          aria-pressed={metric === m.key}
          className={"px-3 py-1.5 transition " + (metric === m.key ? "bg-blue-600 text-white" : "text-zinc-600 hover:bg-zinc-50")}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// 30 / 90 day window + "Download CSV" (link built from the CURRENT metric + range).
export function MvpRangeBar({
  range,
  setRange,
  entityId,
  metric,
}: {
  range: Range;
  setRange: (r: Range) => void;
  entityId: string | null;
  metric: Metric;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 bg-white text-xs font-semibold shadow-sm" role="group" aria-label="Range">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            aria-pressed={range === r}
            className={"px-3 py-1.5 transition " + (range === r ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50")}
          >
            {r} days
          </button>
        ))}
      </div>
      {entityId && (
        <a
          href={csvUrl(entityId, metric, range)}
          target="_blank"
          rel="noreferrer"
          data-testid="csv-link"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50"
        >
          <IconDownload /> Download CSV
        </a>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ share bar

// Unmissable share link: rendered UNDER the header, black URL, wraps on mobile.
export function MvpShareBar({ shareLink, explainerUrl }: { shareLink: string; explainerUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  const copyLink = () => {
    const done = () => setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareLink).then(done, done);
    } else done();
  };
  const display = shareLink.replace(/^https?:\/\//, "");
  return (
    <div className="border-b border-zinc-200 bg-white px-4 py-4">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3">
        <div className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">Share your dashboard link</div>
        <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a
            href={shareLink}
            className="min-w-0 select-all break-all text-center font-mono text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl"
            data-testid="share-link"
          >
            {display}
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            <IconCopy /> {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        {explainerUrl && (
          <a
            href={explainerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
          >
            <IconQuestion /> What is Lifteracy?
          </a>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ charts

const fmtDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
};

// pass-rate-over-time line for one entity (inline styles so it rasterises for the PDF).
export function MvpStudentTrend({ series, label }: { series: SeriesPoint[]; label?: string }) {
  const W = 860,
    H = 220,
    mL = 40,
    mR = 12,
    mT = 14,
    mB = 30,
    iw = W - mL - mR,
    ih = H - mT - mB;
  const pts = series.filter((s) => s.pass_rate != null);
  const n = series.length;
  const x = (i: number) => mL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw),
    y = (v: number) => mT + ih - (v / 100) * ih;
  let d = "";
  let pen = false;
  series.forEach((s, i) => {
    if (s.pass_rate == null) {
      pen = false;
      return;
    }
    d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(s.pass_rate).toFixed(1);
    pen = true;
  });
  const last = pts.length ? pts[pts.length - 1] : null;
  const lastIdx = last ? series.lastIndexOf(last) : -1;
  return (
    <svg viewBox={"0 0 " + W + " " + H} className="w-full" style={{ maxHeight: 240 }} data-rep-chart="entity-trend">
      {[0, 20, 40, 60, 80, 100].map((g) => (
        <g key={g}>
          <line x1={mL} x2={W - mR} y1={y(g)} y2={y(g)} stroke="#f1f5f9" />
          <text x={mL - 5} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
            {g}
          </text>
        </g>
      ))}
      <line x1={mL} x2={W - mR} y1={y(80)} y2={y(80)} stroke="#ef4444" strokeWidth={1.3} strokeDasharray="5 3" />
      {label && (
        <text transform={`translate(12 ${mT + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize="8.5" fill="#64748b">
          {label}
        </text>
      )}
      {pts.length === 0 ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="14" fill="#94a3b8">
          No results in this window
        </text>
      ) : (
        <>
          <path d={d} fill="none" stroke="#2563eb" strokeWidth="2.6" />
          {series.map((s, i) => (s.pass_rate == null ? null : <circle key={i} cx={x(i)} cy={y(s.pass_rate)} r="3" fill="#2563eb" />))}
          {last && last.pass_rate != null && (
            <text x={x(lastIdx) - 4} y={y(last.pass_rate) - 8} textAnchor="end" fontSize="11" fontWeight="800" fill="#2563eb">
              {last.pass_rate.toFixed(1)}%
            </text>
          )}
        </>
      )}
      {series.map((s, i) => (n <= 6 || i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
        <text key={"l" + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">
          {fmtDay(s.date)}
        </text>
      ) : null))}
    </svg>
  );
}

// 7-day activity mini-chart from the tail of the series — green bars sized by
// the day's n (attempts), pink stubs on days with none.
export function MvpStudentActivity({ series }: { series: SeriesPoint[] }) {
  const W = 190,
    H = 64,
    base = 44,
    bw = 18,
    gap = 8;
  const tail = series.slice(-7);
  const max = Math.max(1, ...tail.map((s) => s.n));
  const x = (i: number) => 4 + i * (bw + gap);
  return (
    <svg viewBox={"0 0 " + W + " " + H} className="h-14 w-auto" aria-label="activity, last 7 days">
      {tail.map((s, i) => {
        const practised = s.n > 0;
        const v = practised ? 8 + Math.round((s.n / max) * 30) : 0;
        return practised ? (
          <rect key={i} x={x(i)} y={base - 6 - v} width={bw} height={v + 12} rx={9} fill="#34d399" />
        ) : (
          <rect key={i} x={x(i)} y={base + 2} width={bw} height={7} rx={3.5} fill="#fda4af" />
        );
      })}
      <line x1={0} x2={W} y1={base} y2={base} stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="5 4" />
    </svg>
  );
}

// ------------------------------------------------------------------ modal

export type ModalSubject =
  | { kind: "child"; child: Child; childType: Exclude<ChildType, "student"> }
  | { kind: "student"; student: StudentChild };

const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—");

// Opens from any child row. Geo children: the official (name / role / avatar /
// spotlight message) + that entity's own trend, fetched on demand. Students: the
// row's fields only (there is no per-student series endpoint).
export function MvpTeacherModal({ subject, metric, onClose }: { subject: ModalSubject; metric: Metric; onClose: () => void }) {
  const [mMetric, setMMetric] = useState<Metric>(metric);
  const [mRange, setMRange] = useState<Range>(DEFAULT_RANGE);
  const [data, setData] = useState<{ key: string; scores: ScoresResponse | null; error: string | null } | null>(null);
  const childId = subject.kind === "child" ? subject.child.id : null;
  const key = `${childId}|${mMetric}|${mRange}`;

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    fetch(scoresUrl(childId, mMetric, mRange))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ScoresResponse;
      })
      .then((scores) => {
        if (!cancelled) setData({ key: `${childId}|${mMetric}|${mRange}`, scores, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setData({ key: `${childId}|${mMetric}|${mRange}`, scores: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [childId, mMetric, mRange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scores = data && data.key === key ? data.scores : null;
  const error = data && data.key === key ? data.error : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/60 p-2 sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-zinc-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
          {subject.kind === "child" ? (
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              {subject.child.official && <AvatarImg seed={subject.child.official.avatar_seed} size={56} ring={binColor(subject.child.bin)} />}
              <div className="min-w-0">
                <div className="text-xl font-bold leading-tight text-zinc-900 sm:text-2xl">{subject.child.name}</div>
                <div className="text-sm text-zinc-500">
                  {subject.child.official?.name ?? "No Lifteracy user yet"}
                  {subject.child.official?.role_title ? ` · ${subject.child.official.role_title}` : ` · ${CHILD_OFFICER[subject.childType]}`}
                </div>
              </div>
              {scores && <MvpStudentActivity series={scores.series} />}
            </div>
          ) : (
            <div className="min-w-0">
              <div className="text-xl font-bold leading-tight text-zinc-900 sm:text-2xl">
                {subject.student.label} <span className="font-normal text-zinc-400">· Student</span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            <IconClose /> Close
          </button>
        </div>

        {subject.kind === "child" ? (
          <div className="bg-white">
            <div className="grid grid-cols-2 gap-3 border-b border-zinc-100 px-4 py-4 text-center sm:grid-cols-4 sm:px-6">
              <Stat big={fmtPct(subject.child.pass_rate)} label={`${METRIC_BY[metric].short} · n=${subject.child.n}`} color={binColor(subject.child.bin)} />
              <Stat big={String(subject.child.students_active)} label="students active" />
              <Stat big={<MvpTrend delta={subject.child.delta} />} label="change over range" />
              <Stat big={subject.child.using_lifteracy ? "Yes" : "No"} label="using Lifteracy" color={subject.child.using_lifteracy ? "#16a34a" : UNCOVERED} />
            </div>
            <div className="border-b border-zinc-100 px-4 py-5 sm:px-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <MvpMetricToggle metric={mMetric} setMetric={setMMetric} />
                <MvpRangeBar range={mRange} setRange={setMRange} entityId={childId} metric={mMetric} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {!scores && !error && <p className="text-sm text-zinc-400">Loading…</p>}
              {scores && <MvpStudentTrend series={scores.series} label={`${METRIC_BY[mMetric].label} pass rate`} />}
            </div>
            {subject.child.official?.spotlight_message && (
              <div className="px-4 py-4 sm:px-6">
                <div className="rounded-lg border border-emerald-200 bg-emerald-100/80 px-4 py-3 text-sm italic text-zinc-700">“{subject.child.official.spotlight_message}”</div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 bg-white px-4 py-4 text-center sm:grid-cols-3 sm:px-6">
            <Stat
              big={subject.student.score == null ? "—" : `${Math.round(subject.student.score * 100)}%`}
              label={METRIC_BY[metric].short}
              color={binColor(binOf(subject.student.score == null ? null : subject.student.score * 100))}
            />
            <Stat big={subject.student.passed == null ? "—" : subject.student.passed ? "Passed" : "Not yet"} label="result" color={subject.student.passed ? "#16a34a" : "#dc2626"} />
            <Stat big={String(subject.student.attempts)} label="attempts" />
            <Stat big={subject.student.in_band ? "Yes" : "No"} label="in grade band" />
            <Stat big={subject.student.active ? "Active" : "Inactive"} label="status" color={subject.student.active ? "#16a34a" : UNCOVERED} />
            <Stat big={<span className="text-sm">{fmtWhen(subject.student.last_active_at)}</span>} label="last active (IST)" />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ big, label, color }: { big: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-2 py-3">
      <div className="text-2xl font-extrabold tracking-tight" style={color ? { color } : undefined}>
        {big}
      </div>
      <div className="mt-1 text-xs font-medium leading-tight text-zinc-500">{label}</div>
    </div>
  );
}
