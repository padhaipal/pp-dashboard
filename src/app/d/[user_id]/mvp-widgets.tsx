"use client";

// Small widgets ported from mvp2.html's /mvp dashboard: metric / range / language
// toggles, trend arrow, per-entity trend/activity charts and the modal that
// opens from a child row. Every number comes from the pp-sketch API.

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { avatarUrl, seedFor } from "./avatar";
import {
  ACCENT,
  audioUrl,
  binColor,
  CHILD_OFFICER,
  csvUrl,
  DEFAULT_RANGE,
  EXPLAINER_SHARE_URL,
  MODAL_METRICS,
  rangeLabel,
  EXPLAINER_VIDEO_URL,
  mediaUrl,
  METRIC_BY,
  METRICS,
  profileUrl,
  RANGES,
  scoresUrl,
  TEST_KEY_OF,
  TEST_QUESTION_COUNT,
  MEDIA_PAGE,
  MEDIA_MAX_PAGES,
  PASS_MARK_PCT,
  testScoresUrl,
  type Child,
  type ChildType,
  type LiteracyTestScores,
  type MediaRow,
  studentModalRows,
  TIME_WINDOWS,
  usageHistoryUrl,
  type TimeWindow,
  type UsageHistory,
  type Metric,
  type ModalMetric,
  type Range,
  type ScoresResponse,
  type SeriesPoint,
  type StudentChild,
  type UserMedia,
  UNNAMED,
  isPiiFull,
  type PiiVisibility,
} from "./dashboard-types";
import { useViewerId } from "./viewer-context";
import { withViewer } from "./viewer-url";
import { MaskedAudio, SampleAudioModal } from "./masked-audio";
import { LANGS, type Lang, type T } from "./i18n";
import { useIsMobile } from "./use-is-mobile";
import { IconCopy } from "./icons";
import { ScoreChart } from "../../user/[id]/score-chart";

const same: T = (s) => s;

// ------------------------------------------------------------------ avatar

export function AvatarImg({
  seed,
  size,
  className,
  ring,
  ringWidth = 3,
  shadow,
}: {
  seed: string | null | undefined;
  size: number;
  className?: string;
  ring?: string;
  ringWidth?: number;
  // extra box-shadow appended after the ring (mvp2's profile photo drop shadow)
  shadow?: string;
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
      style={ring ? { boxShadow: `0 0 0 ${ringWidth}px ${ring}` + (shadow ? `, ${shadow}` : "") } : undefined}
    />
  );
}

// ------------------------------------------------------------------ trend arrow

// stock-style zig-zag trend arrow — up (green) / down (red) / flat (grey) when
// |Δ| < 0.5; null → "—". Text is mvp2's "+1.8% last week" shape with the real
// window as the suffix ("+1.8% last 30 days").
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
        {delta == null ? "—" : (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%"}
        {suffix ? " " + suffix : ""}
      </span>
    </span>
  );
}

// ------------------------------------------------------------------ toggles

// `options` defaults to the dashboard METRICS; the student modal passes
// MODAL_METRICS (letter scores first).
export function MvpMetricToggle<M extends string = Metric>({
  metric,
  setMetric,
  options,
  t = same,
}: {
  metric: M;
  setMetric: (m: M) => void;
  options?: { key: M; label: string }[];
  t?: T;
}) {
  const opts = (options ?? METRICS) as { key: M; label: string }[];
  return (
    <div className="inline-flex flex-wrap justify-center gap-1 rounded-full bg-zinc-100 p-1 text-xs font-semibold ring-1 ring-zinc-200" role="group" aria-label="Metric">
      {opts.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => setMetric(m.key)}
          aria-pressed={metric === m.key}
          className={"rounded-full px-3.5 py-1.5 transition " + (metric === m.key ? "bg-blue-600 text-white shadow-sm" : "text-zinc-600 hover:bg-white")}
        >
          {t(m.label)}
        </button>
      ))}
    </div>
  );
}

// Shown under the metric toggle while Time is selected: Yesterday · Last
// seven days · All time (the window of the Time figures).
export function MvpTimeWindowToggle({
  window,
  setWindow,
  label = "Time window",
  testId = "time-window-toggle",
  t = same,
}: {
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  // the trend's own copy (same look) passes its own label / test id
  label?: string;
  testId?: string;
  t?: T;
}) {
  return (
    <div className="inline-flex flex-wrap justify-center gap-1 rounded-full bg-zinc-100 p-1 text-xs font-semibold ring-1 ring-zinc-200" role="group" aria-label={label} data-testid={testId}>
      {TIME_WINDOWS.map((w) => (
        <button
          key={w.key}
          type="button"
          onClick={() => setWindow(w.key)}
          aria-pressed={window === w.key}
          className={"rounded-full px-3.5 py-1.5 transition " + (window === w.key ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:bg-white")}
        >
          {t(w.label)}
        </button>
      ))}
    </div>
  );
}

// 30 days / all time window + "Download CSV" (link built from the CURRENT metric +
// range; desktop-only like mvp2 — hidden below the sm breakpoint).
export function MvpRangeBar({
  range,
  setRange,
  entityId,
  metric,
  timeWindow,
  t = same,
}: {
  range: Range;
  setRange: (r: Range) => void;
  entityId: string | null;
  metric: Metric;
  // Time metric: the window the CSV is exported for
  timeWindow?: TimeWindow;
  t?: T;
}) {
  const viewerId = useViewerId();
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
            {rangeLabel(r, t)}
          </button>
        ))}
      </div>
      {entityId && (
        <a
          href={withViewer(csvUrl(entityId, metric, range, timeWindow), viewerId)}
          target="_blank"
          rel="noreferrer"
          data-testid="csv-link"
          className="hidden rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50 sm:block"
        >
          {t("Download CSV")}
        </a>
      )}
    </div>
  );
}

// EN / हिं switch in the header (mvp2's language toggle).
export function MvpLangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-zinc-300 text-xs font-semibold" role="group" aria-label="Language">
      {LANGS.map(([code, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={"px-2.5 py-1.5 transition " + (lang === code ? "text-white" : "bg-white text-zinc-600 hover:bg-zinc-50")}
          style={lang === code ? { background: ACCENT } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ share bar

// Copies `text` to the clipboard; "Copied!" for 1.6 s. Shared by the two
// share controls below.
function useCopy(text: string): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = () => {
    const done = () => setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else done();
  };
  return { copied, copy };
}

// Teachers only, rendered just below the map card: the /r/<phone> referral
// link parents message to enrol under this teacher, in large mono text with
// a Copy button; then the "See Lifteracy in Action" clip from
// www.lifteracy.ai (inline <video>) with a deliberately quiet
// "Share this video · Copy link" row under it.
export function MvpShareBar({ shareLink, t = same }: { shareLink: string; t?: T }) {
  const link = useCopy(shareLink);
  const video = useCopy(EXPLAINER_SHARE_URL);
  const display = shareLink.replace(/^https?:\/\//, "");
  return (
    <div className="mx-auto mt-6 max-w-6xl px-6" data-testid="share-bar">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
        <div className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("Share your dashboard link")}</div>
        <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a href={shareLink} className="min-w-0 select-all break-all text-center font-mono text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl" data-testid="share-link">
            {display}
          </a>
          <button type="button" onClick={link.copy} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
            <IconCopy /> {link.copied ? t("Copied!") : t("Copy")}
          </button>
        </div>
        {/* poster = a frame of the clip (public/explainer-poster.jpg) so the
            player never shows a black box before play */}
        <video src={EXPLAINER_VIDEO_URL} poster="/explainer-poster.jpg" controls preload="metadata" playsInline className="mt-1 w-full max-w-2xl rounded-xl bg-black" data-testid="explainer-video" />
        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span>{t("Share this video")}</span>
          <a href={EXPLAINER_SHARE_URL} target="_blank" rel="noreferrer" className="select-all font-mono text-zinc-500 hover:text-zinc-700" data-testid="video-share-link">
            {EXPLAINER_SHARE_URL.replace(/^https?:\/\//, "")}
          </a>
          <button type="button" onClick={video.copy} className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 hover:bg-zinc-50">
            {video.copied ? t("Copied!") : t("Copy link")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ charts

const fmtDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
};
const shiftDay = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

// pass-rate-over-time line for one entity (inline styles so it rasterises for the PDF).
// `passMark` = the dotted line (%). Areas: the 80 % NIPUN target; a
// student's own score chart: the test's pass mark (PASS_MARK_PCT).
export function MvpStudentTrend({ series, label, passMark = 80 }: { series: SeriesPoint[]; label?: string; passMark?: number }) {
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
      <line x1={mL} x2={W - mR} y1={y(passMark)} y2={y(passMark)} stroke="#ef4444" strokeWidth={1.3} strokeDasharray="5 3" data-testid="student-pass-mark" />
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

// Active minutes per day as bars (the Time chart of the modal): y = minutes,
// one bar per day, labelled by the day the minutes were spent. The axis grows
// with the data (multiples of 10, at least 10). Inline styles like the trend.
export function MvpMinutesChart({ points, label, t = same }: { points: { date: string; minutes: number | null }[]; label: string; t?: T }) {
  // Phones get a narrower viewBox so the axis text stays legible.
  const mobile = useIsMobile();
  const W = mobile ? 440 : 860,
    H = mobile ? 260 : 220,
    mL = mobile ? 36 : 40,
    mR = 12,
    mT = 14,
    mB = mobile ? 36 : 30,
    iw = W - mL - mR,
    ih = H - mT - mB,
    fs = mobile ? 1.4 : 1;
  const n = points.length;
  const yMax = Math.max(10, Math.ceil(Math.max(0, ...points.map((p) => p.minutes ?? 0)) / 10) * 10);
  const step = yMax <= 50 ? 10 : yMax <= 100 ? 20 : Math.ceil(yMax / 50) * 10;
  const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => mT + ih - (v / yMax) * ih;
  const slot = iw / Math.max(1, n);
  const bw = Math.max(1.5, Math.min(26, slot * 0.7));
  const every = Math.max(1, Math.ceil(n / (mobile ? 4 : 8)));
  // Date under every `every`-th bar and under the last one; a regular tick
  // that would crowd the last label is dropped.
  const labelled = (i: number) => i === n - 1 || (i % every === 0 && n - 1 - i >= every / 2);
  return (
    <svg viewBox={"0 0 " + W + " " + H} className="w-full" style={{ maxHeight: mobile ? 300 : 240 }} data-rep-chart="minutes" data-testid="minutes-chart">
      {ticks.map((g) => (
        <g key={g}>
          <line x1={mL} x2={W - mR} y1={y(g)} y2={y(g)} stroke="#f1f5f9" />
          <text x={mL - 5} y={y(g) + 3} textAnchor="end" fontSize={9 * fs} fill="#94a3b8">
            {g}
          </text>
        </g>
      ))}
      <text transform={`translate(12 ${mT + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11 * fs} fontWeight="600" fill="#475569">
        {label}
      </text>
      {n === 0 ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={14 * fs} fill="#94a3b8">
          {t("No results in this window")}
        </text>
      ) : (
        points.map((p, i) => {
          const v = p.minutes ?? 0;
          const cx = mL + slot * (i + 0.5);
          return (
            <g key={p.date}>
              {v > 0 && (
                <rect x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(1, mT + ih - y(v))} rx={Math.min(3, bw / 2)} fill="#2563eb" data-testid="minutes-bar">
                  <title>{`${fmtDay(p.date)} — ${Number(v.toFixed(1))} min`}</title>
                </rect>
              )}
              {labelled(i) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize={8 * fs} fill="#94a3b8">
                  {fmtDay(p.date)}
                </text>
              )}
            </g>
          );
        })
      )}
      <line x1={mL} x2={W - mR} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
    </svg>
  );
}

// Stands in for a modal chart while its data loads, at the chart's own size —
// a one-line "Loading…" made the modal collapse and spring back.
function ChartLoading({ t = same }: { t?: T }) {
  return (
    <div className="flex w-full items-center justify-center text-sm text-zinc-400" style={{ aspectRatio: "860 / 220", maxHeight: 240 }} data-testid="chart-loading">
      {t("Loading…")}
    </div>
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

// ------------------------------------------------------------------ student name

// Wherever a student's name appears the teacher can edit it: click the name
// (or "+ add name" when there is none) → input; Enter / blur saves through
// PATCH users/:id/profile { name } (pp-sketch accepts name-only for a student);
// Esc cancels. `onSaved` lets the page update every other copy of the name.
export function EditableStudentName({
  studentId,
  name,
  fallback,
  onSaved,
  className,
  t = same,
}: {
  studentId: string;
  name: string | null;
  fallback: string; // shown (muted) while there is no name, e.g. "Student 3"
  onSaved: (name: string) => void;
  className?: string;
  t?: T;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewerId = useViewerId();
  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(name ?? "");
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    const value = draft.trim();
    if (!value || value === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(withViewer(profileUrl(studentId), viewerId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: value }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { name?: string };
      onSaved(body.name ?? value);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={draft}
          maxLength={80}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder={t("Student's name")}
          aria-label={t("Student's name")}
          className="w-36 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-sm font-semibold text-zinc-900 focus:border-blue-500 focus:outline-none"
          data-testid="student-name-input"
        />
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={start}
      onDoubleClick={(e) => e.stopPropagation()}
      title={t("Rename")}
      className={"group inline-flex max-w-full items-center gap-1 text-left " + (className ?? "")}
      data-testid="student-name"
    >
      <span className={"truncate " + (name ? "" : "italic opacity-70")}>{name ?? fallback}</span>
      <span aria-hidden className="ml-0.5 inline-flex items-center rounded border border-current px-1 text-[0.65em] font-semibold leading-4 opacity-75 group-hover:opacity-100">
        ✎ {t("Rename")}
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ modal

export type ModalSubject =
  | { kind: "child"; child: Child; childType: Exclude<ChildType, "student"> }
  | { kind: "student"; student: StudentChild };

// mvp2's `mvpWhen`: "At 7:29pm on Thursday this week …" (IST).
export function whenParts(iso: string, now = Date.now()): { time: string; day: string; week: string } {
  const dt = new Date(iso);
  const time = dt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).replace(" ", "").toLowerCase();
  const day = dt.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
  const days = Math.floor((now - dt.getTime()) / 86400000);
  const week = days < 7 ? "this week" : days < 14 ? "last week" : `${Math.floor(days / 7)} weeks ago`;
  return { time, day, week };
}

const MAX_ANSWER_CHARS = 14;
// A comprehension question / option is a sentence, not a word.
const MAX_TAP_CHARS = 80;
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) + "…" : s);

// "▶ audio" — plays the note through the proxy; one <audio> per button, created on first click.
function AudioButton({ mediaId, t }: { mediaId: string; t: T }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const viewerId = useViewerId();
  useEffect(
    () => () => {
      ref.current?.pause();
    },
    [],
  );
  const toggle = () => {
    if (!ref.current) {
      const a = new Audio(withViewer(audioUrl(mediaId), viewerId));
      a.onended = () => setPlaying(false);
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      ref.current = a;
    }
    if (ref.current.paused) ref.current.play().catch(() => setPlaying(false));
    else ref.current.pause();
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="mx-0.5 inline-flex items-center rounded-md border border-zinc-200 px-2 py-0.5 align-middle text-xs text-zinc-600 hover:bg-zinc-50"
      data-testid="audio-button"
    >
      {playing ? "❚❚" : "▶"} {t("audio")}
    </button>
  );
}

// Practice activity for the last 7 IST days from the interactions (voice
// notes + answered flow taps): n = interactions that day.
export function activitySeries(media: MediaRow[], now = Date.now()): SeriesPoint[] {
  const dayOf = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const counts = new Map<string, number>();
  for (const m of media) {
    const d = dayOf(new Date(m.created_at).getTime());
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const out: SeriesPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = dayOf(now - i * 86400000);
    out.push({ date: d, pass_rate: null, n: counts.get(d) ?? 0, mean: null });
  }
  return out;
}

// Per-test history → the trend line's series, within the range window (score 0-1 → %).
export function historySeries(scores: LiteracyTestScores | null, metric: Metric, range: Range, now = Date.now()): SeriesPoint[] {
  const key = TEST_KEY_OF[metric];
  const test = scores && key ? scores[key] : null;
  const since = range === "all" ? -Infinity : now - range * 86400000;
  return (test?.history ?? [])
    .filter((h) => new Date(h.at).getTime() >= since)
    .map((h) => ({ date: h.at.slice(0, 10), pass_rate: Math.round(h.score * 1000) / 10, n: 1, mean: null }));
}

// Opens from the Detail card (geo child / teacher) or a student tile.
// Geo children: the official (name / role / avatar / spotlight message) + that
// entity's own trend, fetched on demand. Students (mvp2's student dashboard):
// name · Student + 7-day activity, a chart picker — the letter-score chart
// (/user/[id]'s ScoreChart, the default; GET users/:id/scores +
// scores/letter-bins) or a metric with a range toggle over the student's
// score history (GET users/:id/literacy-test-scores) —, then every recent
// voice note as one sentence with a playable "▶ audio" (GET users/:id/media).
export function MvpTeacherModal({
  subject,
  metric,
  onClose,
  onRename,
  t = same,
}: {
  subject: ModalSubject;
  metric: Metric;
  onClose: () => void;
  // student mode: the name was edited in the header → update the page's copy
  onRename?: (studentId: string, name: string) => void;
  t?: T;
}) {
  // Students open on the letter chart; geo children have no letter scores.
  const [mMetric, setMMetric] = useState<ModalMetric>(subject.kind === "student" ? "letters" : metric);
  const [mRange, setMRange] = useState<Range>(DEFAULT_RANGE);
  // The dashboard metric the trend uses when the letter chart is showing.
  const testMetric: Metric = mMetric === "letters" ? metric : mMetric;
  // `metric` = the metric this answer was fetched for (drawn as such while the next one loads).
  const [data, setData] = useState<{ key: string; childId: string; metric: Metric; scores: ScoresResponse | null; error: string | null } | null>(null);
  // `pii` = whether this viewer may play the recordings (pp-sketch, per
  // users/:id/media); masked until the feed says otherwise.
  const [student, setStudent] = useState<{ id: string; tests: LiteracyTestScores | null; media: MediaRow[] | null; pii: PiiVisibility; error: string | null } | null>(null);
  // A masked recording was pressed → the sample-clip explainer.
  const [sampleOpen, setSampleOpen] = useState(false);
  const viewerId = useViewerId();
  // Student + Time: the student's active minutes per day for the chosen range.
  const [usage, setUsage] = useState<{ key: string; history: UsageHistory | null; error: string | null } | null>(null);
  const childId = subject.kind === "child" ? subject.child.id : null;
  const studentId = subject.kind === "student" ? subject.student.student_id : null;
  const key = `${childId}|${testMetric}|${mRange}`;

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    fetch(withViewer(scoresUrl(childId, testMetric, mRange), viewerId))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ScoresResponse;
      })
      .then((scores) => {
        if (!cancelled) setData({ key: `${childId}|${testMetric}|${mRange}`, childId, metric: testMetric, scores, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setData({ key: `${childId}|${testMetric}|${mRange}`, childId, metric: testMetric, scores: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [childId, testMetric, mRange, viewerId]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    const getJson = async <J,>(url: string): Promise<J> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as J;
    };
    Promise.all([getJson<LiteracyTestScores>(withViewer(testScoresUrl(studentId), viewerId)).catch(() => null), getJson<UserMedia>(withViewer(mediaUrl(studentId), viewerId)).catch(() => null)]).then(async ([tests, media]) => {
      if (cancelled) return;
      setStudent({ id: studentId, tests, media: media ? media.media : null, pii: media?.user.pii ?? "masked", error: !tests && !media ? "Could not load this student" : null });
      // A test's answers can be older than the newest page: walk older pages
      // (up to MEDIA_MAX_PAGES) until every answer in every test's bin is loaded.
      if (!tests || !media) return;
      const wanted = new Set(Object.values(tests).flatMap((s) => s?.bin_message_ids ?? []));
      let rows = media.media;
      let page = media.media;
      for (let p = 1; p < MEDIA_MAX_PAGES && page.length >= MEDIA_PAGE; p++) {
        const have = new Set(rows.map((r) => r.id));
        if ([...wanted].every((id) => have.has(id))) break;
        const next = await getJson<UserMedia>(withViewer(mediaUrl(studentId, p * MEDIA_PAGE), viewerId)).catch(() => null);
        if (cancelled || !next) return;
        page = next.media;
        rows = [...rows, ...page];
        setStudent((cur) => (cur && cur.id === studentId ? { ...cur, media: rows } : cur));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, viewerId]);

  // Fetched as soon as the student modal opens (not on the first click on
  // Time), so picking Time draws the chart straight away.
  const usageKey = studentId ? `${studentId}|${mRange}` : null;
  useEffect(() => {
    if (!studentId || !usageKey) return;
    let cancelled = false;
    fetch(withViewer(usageHistoryUrl(studentId, mRange), viewerId))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as UsageHistory;
      })
      .then((history) => {
        if (!cancelled) setUsage({ key: usageKey, history, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setUsage({ key: usageKey, history: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, usageKey, mRange, viewerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // While a newly picked metric / range loads, the previous chart stays up
  // (no collapse to a loading line and back).
  const usageNow = usage && usage.key === usageKey ? usage : usage?.history && studentId && usage.key.startsWith(`${studentId}|`) ? usage : null;
  const dataNow = data && data.key === key ? data : data?.scores && data.childId === childId ? data : null;
  const scores = dataNow?.scores ?? null;
  const error = dataNow?.error ?? null;
  const shownMetric = dataNow?.metric ?? testMetric;
  const st = student && student.id === studentId ? student : null;
  // The interaction list: everything for the letter chart and Time; for a
  // test, only the answers that count toward the student's current and
  // previous score (pp-sketch's counted_message_ids), with a note while
  // there are not enough yet / none at all.
  const testMetric2 = mMetric !== "letters" && mMetric !== "usage" ? mMetric : null;
  const testScore = testMetric2 && st?.tests ? st.tests[TEST_KEY_OF[testMetric2]!] : null;
  // A test tab lists EVERY answer in the test's bin (bin_message_ids; an
  // older pp-sketch only sends counted_message_ids) and marks the ones behind
  // the current / previous score. null = no filter (letters / Time).
  const counted = testScore?.counted_message_ids ? new Set(testScore.counted_message_ids) : null;
  const bin = testScore?.bin_message_ids ? new Set(testScore.bin_message_ids) : counted;
  const allRows = studentModalRows(st?.media ?? []);
  const rows = bin ? allRows.filter((r) => bin.has(r.id)) : allRows;
  const testNote = (() => {
    if (!testMetric2 || !testScore || !bin) return null;
    const label = t(METRIC_BY[testMetric2].label);
    if (bin.size === 0) return `${t("No questions counting toward")} ${label} ${t("answered yet.")}`;
    if (testScore.status === "insufficient_data") {
      const need = `${testMetric2 === "mpl_b" ? t("at least") + " " : ""}${TEST_QUESTION_COUNT[testMetric2]}`;
      return `${t("These answers count toward")} ${label}${t(", but")} ${need} ${t("are needed before a score can be calculated.")}`;
    }
    return `${bin.size} ${t("answers count toward")} ${label}${t("; the ones marked are behind this student's current and previous score.")}`;
  })();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/60 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-zinc-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
            {subject.kind === "child" ? (
              <>
                {subject.child.official && <AvatarImg seed={subject.child.official.avatar_seed} size={56} className="h-14 w-14" ring={binColor(subject.child.bin)} />}
                <div className="min-w-0">
                  <div className="text-2xl font-bold text-zinc-900">
                    {subject.child.name} <span className="font-normal text-zinc-400">· {subject.child.official?.role_title ?? t(CHILD_OFFICER[subject.childType])}</span>
                  </div>
                  {subject.child.official?.name && subject.child.type !== "teacher" && <div className="text-sm text-zinc-500">{subject.child.official.name}</div>}
                  {/* the official's number: in full only for the viewer directly above them, masked otherwise */}
                  {subject.child.official?.phone && (
                    <div className="font-mono text-sm text-zinc-500" data-testid="official-phone">
                      {subject.child.official.phone}
                    </div>
                  )}
                </div>
                {scores && <MvpStudentActivity series={scores.series} />}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-2 text-2xl font-bold text-zinc-900" data-testid="student-modal-title">
                  {isPiiFull(subject.student.pii) ? (
                    <EditableStudentName
                      studentId={subject.student.student_id}
                      name={subject.student.name}
                      fallback={UNNAMED}
                      onSaved={(name) => onRename?.(subject.student.student_id, name)}
                      t={t}
                    />
                  ) : (
                    <span className={subject.student.name ? "" : "italic opacity-70"} data-testid="student-name-masked">
                      {subject.student.name ?? UNNAMED}
                    </span>
                  )}
                  <span className="whitespace-nowrap font-normal text-zinc-400">
                    · {t("Student")}
                    {subject.student.phone && (
                      <span className="ml-2 font-mono text-base font-semibold text-zinc-500" data-testid="student-modal-phone">
                        {subject.student.phone}
                      </span>
                    )}
                  </span>
                </div>
                {st?.media && <MvpStudentActivity series={activitySeries(studentModalRows(st.media))} />}
              </>
            )}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 whitespace-nowrap rounded-md border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
            ✕ {t("Close")}
          </button>
        </div>
        {sampleOpen && <SampleAudioModal onClose={() => setSampleOpen(false)} t={t} />}

        <div className="bg-white">
          {/* chart with its own picker: letter scores (students, default) or a metric + range */}
          <div className="border-b border-zinc-100 px-3 py-5 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {subject.kind === "student" ? (
                  <MvpMetricToggle<ModalMetric> metric={mMetric} setMetric={setMMetric} options={MODAL_METRICS} t={t} />
                ) : (
                  <MvpMetricToggle metric={testMetric} setMetric={setMMetric} t={t} />
                )}
                {/* the letter chart is per interaction, not per day — no range */}
                {mMetric !== "letters" && <MvpRangeBar range={mRange} setRange={setMRange} entityId={childId} metric={testMetric} t={t} />}
              </div>
            </div>
            {subject.kind === "child" ? (
              <>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {!scores && !error && <ChartLoading t={t} />}
                {/* Time: minutes per student per day (a row dated D holds the day before) */}
                {scores &&
                  (shownMetric === "usage" ? (
                    <MvpMinutesChart points={scores.series.map((p) => ({ date: shiftDay(p.date, -1), minutes: p.mean }))} label={t("Active minutes per student")} t={t} />
                  ) : (
                    <MvpStudentTrend series={scores.series} label={`${METRIC_BY[shownMetric].label}`} />
                  ))}
              </>
            ) : (
              <>
                {/* the letter chart stays mounted (hidden) behind the other charts, so coming back to it never reloads */}
                <div className={mMetric === "letters" ? "" : "hidden"} data-testid="letter-chart-pane">
                  <ScoreChart userId={subject.student.student_id} t={t} />
                </div>
                {mMetric === "usage" ? (
                  /* Time: the student's active minutes each day */
                  <>
                    {usageNow?.error && <p className="text-sm text-red-600">{usageNow.error}</p>}
                    {!usageNow && <ChartLoading t={t} />}
                    {usageNow?.history && <MvpMinutesChart points={usageNow.history.points} label={t("Active minutes")} t={t} />}
                  </>
                ) : mMetric !== "letters" ? (
                  <>
                    {st?.error && <p className="text-sm text-red-600">{st.error}</p>}
                    {!st && <ChartLoading t={t} />}
                    {st && <MvpStudentTrend series={historySeries(st.tests, mMetric, mRange)} label={METRIC_BY[mMetric].label} passMark={PASS_MARK_PCT[mMetric]} />}
                  </>
                ) : null}
              </>
            )}
          </div>

          {subject.kind === "child" ? (
            subject.child.official?.spotlight_message && (
              <div className="px-6 py-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-100/80 px-4 py-3 text-sm italic text-zinc-700">“{subject.child.official.spotlight_message}”</div>
              </div>
            )
          ) : (
            /* every recent interaction (voice note or flow tap) as one friendly sentence — fixed-height scroll pane so the chart stays visible */
            <div className="max-h-80 divide-y divide-zinc-100 overflow-y-auto px-6" data-testid="student-sentences">
              {testNote && (
                <p className="py-3 text-sm text-zinc-500" data-testid="test-interactions-note">
                  {testNote}
                </p>
              )}
              {st?.media && !counted && allRows.length === 0 && <p className="py-3 text-sm text-zinc-400">{t("No voice notes yet.")}</p>}
              {rows.map((row) => {
                const w = whenParts(row.created_at);
                if (row.kind === "tap") {
                  // a comprehension flow answer: no recording, the question and the option chosen instead
                  return (
                    <div key={row.id} className="py-3 text-sm leading-relaxed text-zinc-700" data-testid="tap-sentence" data-counted={testScore?.status === "ok" && counted?.has(row.id) ? "1" : undefined}>
                      {testScore?.status === "ok" && counted?.has(row.id) && (
                        <span className="mr-2 inline-block rounded-full bg-blue-50 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-blue-700" data-testid="counted-tag">
                          {t("in score")}
                        </span>
                      )}
                      {t("At")} <span className="font-semibold">{w.time}</span> {t("on")} <span className="font-semibold">{w.day}</span> {t(w.week)} {t("the student was asked")}{" "}
                      <span className="font-semibold text-zinc-900">“{row.tap?.question ? clip(row.tap.question, MAX_TAP_CHARS) : "—"}”</span> {t("and chose")}{" "}
                      <span className="font-semibold text-zinc-900">“{row.tap?.chosen ? clip(row.tap.chosen, MAX_TAP_CHARS) : "—"}”</span> {t("and the correct answer was")}{" "}
                      <span className="font-semibold text-zinc-900">“{row.answer ? clip(row.answer, MAX_TAP_CHARS) : "—"}”</span> {t("and so was marked as")}{" "}
                      {row.answer_correct ? <span className="font-semibold text-emerald-600">{t("correct")}</span> : <span className="font-semibold text-red-500">{t("incorrect")}</span>}.
                    </div>
                  );
                }
                const ans = row.answer ? clip(row.answer, MAX_ANSWER_CHARS) : "—";
                return (
                  <div key={row.id} className="py-3 text-sm leading-relaxed text-zinc-700">
                    {t("At")} <span className="font-semibold">{w.time}</span> {t("on")} <span className="font-semibold">{w.day}</span> {t(w.week)} {t("the student said")}{" "}
                    {row.has_audio ? (
                      isPiiFull(st?.pii) ? (
                        <AudioButton mediaId={row.id} t={t} />
                      ) : (
                        <MaskedAudio mediaId={row.id} durationMs={row.duration_ms} onRequest={() => setSampleOpen(true)} t={t} />
                      )
                    ) : (
                      <span className="italic text-zinc-400">{t("nothing (no recording)")}</span>
                    )}{" "}
                    {t("and the correct answer was")}{" "}
                    <span className="font-semibold text-zinc-900">{ans}</span> {t("and so was marked as")}{" "}
                    {row.answer_correct === true && <span className="font-semibold text-emerald-600">{t("correct")}</span>}
                    {row.answer_correct === false && <span className="font-semibold text-red-500">{t("incorrect")}</span>}
                    {row.answer_correct === null && <span className="italic text-zinc-400">{t("not assessed")}</span>}.
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
