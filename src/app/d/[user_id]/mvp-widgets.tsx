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
  testScoresUrl,
  type Child,
  type ChildType,
  type LiteracyTestScores,
  type MediaRow,
  type Metric,
  type ModalMetric,
  type Range,
  type ScoresResponse,
  type SeriesPoint,
  type StudentChild,
  type UserMedia,
  UNNAMED,
} from "./dashboard-types";
import { LANGS, type Lang, type T } from "./i18n";
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
    <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 bg-white text-xs font-semibold shadow-sm" role="group" aria-label="Metric">
      {opts.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => setMetric(m.key)}
          aria-pressed={metric === m.key}
          className={"px-3 py-1.5 transition " + (metric === m.key ? "bg-blue-600 text-white" : "text-zinc-600 hover:bg-zinc-50")}
        >
          {t(m.label)}
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
  t = same,
}: {
  range: Range;
  setRange: (r: Range) => void;
  entityId: string | null;
  metric: Metric;
  t?: T;
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
            {rangeLabel(r, t)}
          </button>
        ))}
      </div>
      {entityId && (
        <a
          href={csvUrl(entityId, metric, range)}
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
      const res = await fetch(profileUrl(studentId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: value }) });
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

// "▶ audio" — plays the note through the proxy; one <audio> per button, created on first click.
function AudioButton({ mediaId, t }: { mediaId: string; t: T }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(
    () => () => {
      ref.current?.pause();
    },
    [],
  );
  const toggle = () => {
    if (!ref.current) {
      const a = new Audio(audioUrl(mediaId));
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

// Practice activity for the last 7 IST days from the voice notes: n = notes that day.
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
  const [data, setData] = useState<{ key: string; scores: ScoresResponse | null; error: string | null } | null>(null);
  const [student, setStudent] = useState<{ id: string; tests: LiteracyTestScores | null; media: MediaRow[] | null; error: string | null } | null>(null);
  const childId = subject.kind === "child" ? subject.child.id : null;
  const studentId = subject.kind === "student" ? subject.student.student_id : null;
  const key = `${childId}|${testMetric}|${mRange}`;

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    fetch(scoresUrl(childId, testMetric, mRange))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ScoresResponse;
      })
      .then((scores) => {
        if (!cancelled) setData({ key: `${childId}|${testMetric}|${mRange}`, scores, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setData({ key: `${childId}|${testMetric}|${mRange}`, scores: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [childId, testMetric, mRange]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    const getJson = async <J,>(url: string): Promise<J> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as J;
    };
    Promise.all([getJson<LiteracyTestScores>(testScoresUrl(studentId)).catch(() => null), getJson<UserMedia>(mediaUrl(studentId)).catch(() => null)]).then(([tests, media]) => {
      if (cancelled) return;
      setStudent({ id: studentId, tests, media: media ? media.media : null, error: !tests && !media ? "Could not load this student" : null });
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scores = data && data.key === key ? data.scores : null;
  const error = data && data.key === key ? data.error : null;
  const st = student && student.id === studentId ? student : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/60 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-zinc-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {subject.kind === "child" ? (
              <>
                {subject.child.official && <AvatarImg seed={subject.child.official.avatar_seed} size={56} className="h-14 w-14" ring={binColor(subject.child.bin)} />}
                <div className="min-w-0">
                  <div className="text-2xl font-bold text-zinc-900">
                    {subject.child.name} <span className="font-normal text-zinc-400">· {subject.child.official?.role_title ?? t(CHILD_OFFICER[subject.childType])}</span>
                  </div>
                  {subject.child.official?.name && subject.child.type !== "teacher" && <div className="text-sm text-zinc-500">{subject.child.official.name}</div>}
                </div>
                {scores && <MvpStudentActivity series={scores.series} />}
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-zinc-900" data-testid="student-modal-title">
                  <EditableStudentName
                    studentId={subject.student.student_id}
                    name={subject.student.name}
                    fallback={UNNAMED}
                    onSaved={(name) => onRename?.(subject.student.student_id, name)}
                    t={t}
                  />{" "}
                  <span className="font-normal text-zinc-400">· {t("Student")}</span>
                </div>
                {st?.media && <MvpStudentActivity series={activitySeries(st.media)} />}
              </>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
            ✕ {t("Close")}
          </button>
        </div>

        <div className="bg-white">
          {/* chart with its own picker: letter scores (students, default) or a metric + range */}
          <div className="border-b border-zinc-100 px-6 py-5">
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
                {!scores && !error && <p className="text-sm text-zinc-400">{t("Loading…")}</p>}
                {scores && <MvpStudentTrend series={scores.series} label={`${METRIC_BY[testMetric].label}`} />}
              </>
            ) : mMetric === "letters" ? (
              <ScoreChart userId={subject.student.student_id} t={t} />
            ) : (
              <>
                {st?.error && <p className="text-sm text-red-600">{st.error}</p>}
                {!st && <p className="text-sm text-zinc-400">{t("Loading…")}</p>}
                {st && <MvpStudentTrend series={historySeries(st.tests, mMetric, mRange)} label={METRIC_BY[mMetric].label} />}
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
            /* every recent voice note as one friendly sentence — fixed-height scroll pane so the chart stays visible */
            <div className="max-h-80 divide-y divide-zinc-100 overflow-y-auto px-6" data-testid="student-sentences">
              {st?.media && st.media.length === 0 && <p className="py-3 text-sm text-zinc-400">{t("No voice notes yet.")}</p>}
              {(st?.media ?? []).map((row) => {
                const w = whenParts(row.created_at);
                const ans = row.answer ? (row.answer.length > MAX_ANSWER_CHARS ? row.answer.slice(0, MAX_ANSWER_CHARS) + "…" : row.answer) : "—";
                return (
                  <div key={row.id} className="py-3 text-sm leading-relaxed text-zinc-700">
                    {t("At")} <span className="font-semibold">{w.time}</span> {t("on")} <span className="font-semibold">{w.day}</span> {t(w.week)} {t("the student said")}{" "}
                    {row.has_audio ? <AudioButton mediaId={row.id} t={t} /> : <span className="italic text-zinc-400">{t("nothing (no recording)")}</span>} {t("and the correct answer was")}{" "}
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
