"use client";

// Public teacher/official dashboard (/d/[user_id]) — the mvp2.html "report"
// layout (sandbox-global-map/mvp2.html) ported to Next, section for section:
// sticky header (logo · nav · EN/हिं · Generate report), location title, metric
// toggle, headline KPI card(s), the 460 px map card with the up-a-level button
// — geo levels draw the map, a school lists its TEACHERS as row cards, a
// teacher (the class view) shows STUDENT tiles —, "{Noun} Detail",
// "{Noun} Performance" (trend + range bar + most improved), "{Officer}
// Spotlight", "Your Profile", footer. In the class view Detail and Spotlight
// are hidden (mvp2's `inClass`). All numbers come from pp-sketch via
// /api/proxy (public allowlist, no session). The only deliberate departure
// from mvp2 is the plant avatar.
//
// Who is looking: the link's user id rides on every proxy call as `?viewer=`
// (viewer-url.ts / ViewerProvider) and pp-sketch masks names, phones and
// recordings the viewer is not directly above. Rows say so in `pii`.

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { randomSeed, seedFor } from "./avatar";
import {
  ACCENT,
  CHILD_NOUN,
  CHILD_OFFICER,
  DEFAULT_METRIC,
    DEFAULT_TIME_WINDOW,
  displayName,
  EMPTY_ROOT_TEXT,
  fmtDelta,
  fmtDuration,
  fmtMinutes,
  fmtPct,
  fmtPctInt,
  geoChildrenOf,
  isTimeMode,
  ageBandOf,
  METRIC_BY,
  timeDeltaSuffix,
  windowColor,
  windowFill,
  timeWindowSuffix,
  type TimeWindow,
  usageColor,
  nipColor,
  binColor,
  profileUrl,
  scoresUrl,
  spotlightUrl,
  studentChildrenOf,
  UNCOVERED,
  type Child,
  type ChildType,
  type GeoRef,
  type Metric,
  type PublicProfile,
  type Range,
  type ScoresResponse,
  type SpotlightResponse,
  type StudentChild,
  UNNAMED,
  isPiiFull,
  rangeForWindow,
  lastDays,
  WINDOW_DAYS,
  csvUrl,
  fmtDurationParts,
  fmtRatio,
  levelsBelow,
  rankingsUrl,
  RANK_LEVEL_LABEL,
  type RankLevel,
  type RankRow,
  type RankingsResponse,
} from "./dashboard-types";
import { withViewer } from "./viewer-url";
import { ViewerProvider } from "./viewer-context";
import { BarStrip, type BarItem } from "./bar-strip";
import { DrillHint, GeoMap } from "./geo-map";
import { isLang, LANG_STORAGE_KEY, makeT, type Lang, type T } from "./i18n";
import { AvatarImg, EditableStudentName, MvpLangToggle, MvpMetricToggle, MvpShareBar, MvpTeacherModal, MvpTimeWindowToggle, MvpTrend, type ModalSubject } from "./mvp-widgets";
import { ReportCardModal, RepKpis, RepQuote, RepTrend, type ImprovedRow, type ReportData } from "./report-card-modal";

export type TeacherDashboardProps = {
  profile: PublicProfile;
  incompleteStates: string[];
};

// `entityId` / `metric` / `range` / `timeWindow` = what this answer was fetched
// for: while the next selection loads, the page keeps showing it as it was.
type Loaded = { key: string; entityId: string; metric: Metric; range: Range; timeWindow: TimeWindow; scores: ScoresResponse | null; spotlight: SpotlightResponse | null; error: string | null };

// Nest error body: { statusCode, message: string | string[], error }.
async function serverMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join("; ");
    if (typeof body.message === "string") return body.message;
  } catch {
    // non-JSON body
  }
  return `HTTP ${res.status}`;
}

// "{name} · {phone}" — the student's WhatsApp number follows the name
// everywhere it is shown (and stands in for one on an unnamed student), so a
// teacher can tell students apart. Deliberately uncensored.
const withPhone = (name: string, phone: string | undefined) => (phone ? `${name} · ${phone}` : name);
const studentSub = (s: StudentChild, t: T) => (s.phone ? `${t("Student")} · ${s.phone}` : t("Student"));

// localStorage: the first-visit drill-down callout was dismissed.
const DRILL_HINT_KEY = "pp-drill-hint-dismissed";

const toRef = (c: GeoRef): GeoRef => ({ id: c.id, type: c.type, code: c.code, name: c.name, has_boundary: c.has_boundary, lat: c.lat, lng: c.lng });

// Where the page opens. A block / district / state official opens one level
// UP — every block in the district, district in the state, state in India —
// with their own entity selected, so they see how they rank against their
// peers (as a teacher does among the school's teachers). Teachers (school)
// and country users open on their own entity.
const startsAtParent = (p: PublicProfile): boolean =>
  !!p.geo_entity && (p.geo_entity.type === "block" || p.geo_entity.type === "district" || p.geo_entity.type === "state") && p.ancestors.length > 0;
const homeStack = (p: PublicProfile): GeoRef[] => {
  if (startsAtParent(p)) {
    const a = p.ancestors[p.ancestors.length - 1];
    return [{ id: a.id, type: a.type, code: a.code, name: a.name, has_boundary: true, lat: null, lng: null }];
  }
  return p.geo_entity ? [toRef(p.geo_entity)] : [];
};

// mvp2's report constants: section heading, card, input.
const H = "text-center text-3xl font-extrabold tracking-tight sm:text-4xl";
const CARD = "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8";
const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

// The level below an entity before its scores arrive (mvp2's REP_NOUN keys).
const nextChildType = (t: GeoRef["type"]): ChildType =>
  t === "country" ? "state" : t === "state" ? "district" : t === "district" ? "block" : t === "block" ? "school" : t === "school" ? "teacher" : "student";

export function TeacherDashboard({ profile: initialProfile, incompleteStates }: TeacherDashboardProps) {
  const [profile, setProfile] = useState<PublicProfile>(initialProfile);
  // What the toggles are on. The page body renders `metric` / `range` /
  // `timeWindow` below — the same, except while a new selection is loading.
  const [pickedMetric, setMetric] = useState<Metric>(DEFAULT_METRIC);
  // The trend's own window (same toggle as the Time window): its x-axis.
  // The data range follows it (all time → the full history, else 30 days).
  const [trendWindow, setTrendWindow] = useState<TimeWindow>("30d");
  const pickedRange: Range = rangeForWindow(trendWindow);
  // The window of the Time metric (its own toggle, shown only while Time is selected).
  const [pickedWindow, setTimeWindow] = useState<TimeWindow>(DEFAULT_TIME_WINDOW);
  const [stack, setStack] = useState<GeoRef[]>(() => homeStack(initialProfile));
  const [data, setData] = useState<Loaded | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Class view: a student line pinned on the trend chart (click to toggle).
  const [pinId, setPinId] = useState<string | null>(null);
  // Officials open among their peers with their own entity selected.
  const [selId, setSelId] = useState<string | null>(() => (startsAtParent(initialProfile) ? initialProfile.geo_entity!.id : null));
  const [modal, setModal] = useState<ModalSubject | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");
  const incomplete = useMemo(() => new Set(incompleteStates), [incompleteStates]);
  const t: T = useMemo(() => makeT(lang), [lang]);

  // Language: English on the server, the viewer's saved choice once mounted
  // (deferred a tick so the effect never sets state synchronously).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const v = window.localStorage.getItem(LANG_STORAGE_KEY);
        if (isLang(v)) setLangState(v);
      } catch {
        // storage unavailable
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);
  // First-visit callout pointing at the viewer's own area: shown until dismissed.
  const [hintOpen, setHintOpen] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (window.localStorage.getItem(DRILL_HINT_KEY) !== "1") setHintOpen(true);
      } catch {
        setHintOpen(true);
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);
  const dismissHint = useCallback(() => {
    setHintOpen(false);
    try {
      window.localStorage.setItem(DRILL_HINT_KEY, "1");
    } catch {
      // storage unavailable
    }
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      // storage unavailable
    }
  }, []);

  const entity = stack.length ? stack[stack.length - 1] : null;
  // Only the Time metric depends on the window.
  const pickedWin = pickedMetric === "usage" ? pickedWindow : undefined;
  const key = entity ? `${entity.id}|${pickedMetric}|${pickedRange}|${pickedWin ?? ""}` : "";

  // ---- data: scores + spotlight for the current level ----
  useEffect(() => {
    if (!entity) return;
    const id = entity.id;
    const k = `${id}|${pickedMetric}|${pickedRange}|${pickedWin ?? ""}`;
    const meta = { key: k, entityId: id, metric: pickedMetric, range: pickedRange, timeWindow: pickedWindow };
    let cancelled = false;
    const getJson = async <T,>(url: string): Promise<T> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(await serverMessage(res));
      return (await res.json()) as T;
    };
    const viewer = profile.id;
    Promise.all([getJson<ScoresResponse>(withViewer(scoresUrl(id, pickedMetric, pickedRange, pickedWin), viewer)), getJson<SpotlightResponse>(withViewer(spotlightUrl(id, pickedMetric, pickedRange, pickedWin), viewer)).catch(() => null)])
      .then(([scores, spotlight]) => {
        if (!cancelled) setData({ ...meta, scores, spotlight, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setData({ ...meta, scores: null, spotlight: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [entity, pickedMetric, pickedRange, pickedWindow, pickedWin, profile.id]);

  const fresh = data && data.key === key ? data : null;
  // A toggle was clicked and its answer is on the way: keep the previous
  // answer for this entity on screen (rendered as it was fetched) instead of
  // blanking the page to a loading line and back — that made the layout jump.
  const stale = !fresh && entity && data?.scores && data.entityId === entity.id ? data : null;
  const loaded = fresh ?? stale;
  const metric = stale ? stale.metric : pickedMetric;
  const range = stale ? stale.range : pickedRange;
  const timeWindow = stale ? stale.timeWindow : pickedWindow;
  const scores = loaded?.scores ?? null;
  const spotlight = loaded?.spotlight ?? null;
  const loading = !!entity && !loaded;

  const childType: ChildType | null = scores ? scores.child_type : entity ? nextChildType(entity.type) : null;
  const geoChildren: Child[] = useMemo(() => (scores ? geoChildrenOf(scores) : []), [scores]);
  const students: StudentChild[] = useMemo(() => (scores ? studentChildrenOf(scores) : []), [scores]);
  const emptyRoot = !!scores && scores.root.n == null;
  const usingN = geoChildren.filter((c) => c.using_lifteracy).length;
  // mvp2's `inClass`: a drilled class (the children are students) hides Detail + Spotlight.
  const inClass = childType === "student";
  const isUsageMetric = metric === "usage";
  // Time mode: pp-sketch answered with the window's time figures (total +
  // minutes per day, no deltas). A pp-sketch that predates Time windows
  // answers without them — the page then falls back to the old "5+ min
  // yesterday" share.
  const timeMode = isTimeMode(scores);
  const timeSuffix = timeWindowSuffix(timeWindow, t);
  const [nounS, nounP] = childType ? CHILD_NOUN[childType] : ["Area", "areas"];
  const officer = childType ? CHILD_OFFICER[childType] : "Official";
  const metricLabel = timeMode
    ? `${t(METRIC_BY[metric].label)} · ${timeSuffix}`
    : metric === "usage"
      ? `${t(METRIC_BY[metric].label)} · ${t("5+ min yesterday")}`
      : t(METRIC_BY[metric].label);

  // ---- navigation ----
  const drill = useCallback((c: Child) => {
    setStack((s) => [...s, toRef(c)]);
    setHoverId(null);
    setSelId(null);
  }, []);
  const up = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    setHoverId(null);
    setSelId(null);
  }, []);
  const canUp = stack.length > 1;
  const select = useCallback((c: { id: string }) => setSelId((cur) => (cur === c.id ? null : c.id)), []);
  // An area's / teacher's details pop-up (was opened from the Detail card,
  // removed 2026-10): a single click on its bar, held back a moment so a
  // double-click (drill) does not also open it.
  const openChild = useCallback(
    (c: Child) => {
      if (!childType || childType === "student") return;
      setModal({ kind: "child", child: c, childType });
    },
    [childType],
  );
  const barClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openStudent = useCallback((s: StudentChild) => setModal({ kind: "student", student: s }), []);
  // A student renamed anywhere (tile, modal header) → every copy on the page follows.
  const renameStudent = useCallback((studentId: string, name: string) => {
    setData((d) => {
      if (!d || !d.scores || d.scores.child_type !== "student") return d;
      const children = (d.scores.children as StudentChild[]).map((s) => (s.student_id === studentId ? { ...s, name } : s));
      return { ...d, scores: { ...d.scores, children } };
    });
    setModal((m) => (m && m.kind === "student" && m.student.student_id === studentId ? { ...m, student: { ...m.student, name } } : m));
  }, []);

  // Smallest area first (school, block, district, state, country); the PDF
  // title reuses the joined string.
  // (the parent an official opens on is the last ancestor — not listed twice)
  const titleSegments = [...(startsAtParent(profile) ? profile.ancestors.slice(0, -1) : profile.ancestors), ...stack].reverse().map((a) => t(displayName(a.name, a.type)));
  const locationTitle = titleSegments.join("  -  ");

  // Bars under the map card: every child of this level (or every student in
  // the class) with its metric value — pass rate at geo levels, score % or
  // minutes per student in the class view.
  const barItems: BarItem[] = useMemo(
    () =>
      timeMode
        ? // Time: bars are total minutes (per student for an area).
          inClass
          ? students.map((s) => ({
              id: s.student_id,
              name: s.name ?? UNNAMED,
              sub: studentSub(s, t),
              value: s.time_total ?? null,
              display: fmtDuration(s.time_total, t),
              color: windowColor(s.time_total, timeWindow),
              extra: [[t("vs the window before"), s.delta == null ? "—" : fmtRatio(s.delta)]] as [string, string][],
            }))
          : geoChildren.map((c) => ({
              id: c.id,
              name: c.name,
              sub: c.official?.name ? `${c.official.role_title ?? t(CHILD_OFFICER[c.type as keyof typeof CHILD_OFFICER] ?? "")} · ${c.official.name}` : "",
              value: c.using_lifteracy ? (c.time_sum ?? null) : null,
              display: c.using_lifteracy ? fmtDuration(c.time_sum, t) : t("Not using Lifteracy"),
              color: windowFill(c, timeWindow),
              extra: [
                [t("Students"), String(c.students ?? c.n)],
                [t("Per student"), fmtDuration(c.time_total, t)],
                [t("vs the window before"), c.delta == null ? "—" : fmtRatio(c.delta)],
              ] as [string, string][],
            }))
        : inClass
        ? students.map((s) => {
            const pct = s.score == null ? null : s.score * 100;
            return {
              id: s.student_id,
              name: s.name ?? UNNAMED,
              sub: studentSub(s, t),
              value: isUsageMetric ? s.score : pct,
              display: isUsageMetric ? fmtMinutes(s.score) : fmtPctInt(pct),
              color: isUsageMetric ? usageColor(s.score) : nipColor(pct),
            };
          })
        : geoChildren.map((c) => ({
            id: c.id,
            name: c.name,
            sub: c.official?.name ? `${c.official.role_title ?? t(CHILD_OFFICER[c.type as keyof typeof CHILD_OFFICER] ?? "")} · ${c.official.name}` : "",
            value: c.using_lifteracy ? c.pass_rate : null,
            display: c.using_lifteracy ? fmtPctInt(c.pass_rate) : t("Not using Lifteracy"),
            color: binColor(c.bin),
          })),
    [inClass, students, geoChildren, isUsageMetric, timeMode, timeWindow, t],
  );
  const barMax = timeMode
    ? Math.max(10, Math.ceil(Math.max(0, ...(inClass ? students.map((s) => s.time_total ?? 0) : geoChildren.map((c) => c.time_sum ?? 0))) / 10) * 10)
    : inClass && isUsageMetric
      ? Math.max(30, Math.ceil(Math.max(0, ...students.map((s) => s.score ?? 0)) / 10) * 10)
      : 100;

  // Class view: rank the students by delta ourselves (the API's most_improved is for ChildRows).
  const improvedRows: ImprovedRow[] = useMemo(
    () =>
      inClass
        ? students
            // Time: only a rise in minutes is an improvement (as pp-sketch ranks areas)
            // Time: delta = this window ÷ the one before; only a rise (> 1) counts
            .filter((s) => s.delta != null && (!timeMode || s.delta > 1))
            .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
            .slice(0, 5)
            .map((s) => ({ id: s.student_id, name: withPhone(s.name ?? UNNAMED, s.phone), delta: s.delta }))
        : (scores?.most_improved ?? []),
    [inClass, students, scores, timeMode],
  );
  // "Top performing": the five best by the toggled metric (pass rate / score
  // / minutes), in the same bar format as most improved.
  const topRows: ImprovedRow[] = useMemo(() => {
    const rows: ImprovedRow[] = inClass
      ? students.map((s) => ({
          id: s.student_id,
          name: withPhone(s.name ?? UNNAMED, s.phone),
          delta: timeMode ? (s.time_total ?? null) : isUsageMetric ? s.score : s.score == null ? null : s.score * 100,
        }))
      : geoChildren.map((c) => ({ id: c.id, name: c.name, delta: c.using_lifteracy ? (timeMode ? (c.time_sum ?? null) : c.pass_rate) : null }));
    return rows
      .filter((r) => r.delta != null)
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
      .slice(0, 5);
  }, [inClass, students, geoChildren, timeMode, isUsageMetric]);
  // Rankings at another level (drilled in only): the toggle above them picks
  // any level below this entity; the nearest one is the children above.
  const rankOptions = stack.length > 1 && entity ? levelsBelow(entity.type) : [];
  const [rankPick, setRankPick] = useState<{ entityId: string; level: RankLevel } | null>(null);
  const rankLevel: RankLevel | null = rankOptions.length > 1 ? (rankPick && rankPick.entityId === entity?.id ? rankPick.level : rankOptions[0]) : null;
  const deeper = rankLevel !== null && rankLevel !== rankOptions[0];
  const [ranked, setRanked] = useState<{ key: string; data: RankingsResponse | null } | null>(null);
  const rankWin = metric === "usage" ? timeWindow : undefined;
  const rankKey = deeper && entity ? `${entity.id}|${rankLevel}|${metric}|${rankWin ?? ""}` : null;
  useEffect(() => {
    if (!rankKey || !entity || !rankLevel) return;
    let cancelled = false;
    fetch(withViewer(rankingsUrl(entity.id, rankLevel, metric, rankWin), profile.id))
      .then(async (r) => (r.ok ? ((await r.json()) as RankingsResponse) : null))
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setRanked({ key: rankKey, data });
      });
    return () => {
      cancelled = true;
    };
  }, [rankKey, entity, rankLevel, metric, rankWin, profile.id]);
  const rankedNow = deeper && ranked && ranked.key === rankKey ? ranked.data : null;
  // a teacher's number beside their name; students carry no number here
  const rankName = (r: RankRow) => (r.sub ? `${r.name} · ${r.sub}` : r.name);
  const shownImproved: ImprovedRow[] = deeper ? (rankedNow?.most_improved ?? []).map((r) => ({ id: r.id, name: rankName(r), delta: r.delta })) : improvedRows;
  const shownTop: ImprovedRow[] = deeper ? (rankedNow?.top ?? []).map((r) => ({ id: r.id, name: rankName(r), delta: r.value })) : topRows;
  // Figures after the ranking bars: minutes in Time mode, else % (or minutes for legacy usage).
  const fmtRank = (v: number) => (timeMode ? fmtDuration(v, t) : isUsageMetric ? fmtMinutes(v) : `${Math.round(v)}%`);
  const fmtDelta = (v: number) => (timeMode ? fmtRatio(v) : `${v >= 0 ? "+" : ""}${v.toFixed(1)}${isUsageMetric ? ` ${t("min")}` : "%"}`);
  // NIPUN / MPL-B changes are always against 7 days back (pp-sketch TEST_DELTA_DAYS).
  const deltaSuffix = timeMode ? timeDeltaSuffix(scores?.time_delta_days, t) : t("vs 7 days ago");

  const reportData: ReportData | null =
    scores && childType && entity
      ? {
          title: locationTitle || entity.name,
          shareLink: profile.share_link,
          metric,
          range,
          timeWindow: timeMode ? timeWindow : undefined,
          ageBand: scores.age_band ?? null,
          passMark: scores.pass_mark ?? null,
          asOf: scores.as_of,
          root: scores.root,
          series: scores.series,
          childType,
          childrenRows: geoChildren,
          mostImproved: scores.most_improved,
          spotlight,
        }
      : null;

  // Double-click on a ranking row: open the student, or drill into the area.
  const pickRow = (r: ImprovedRow) => {
    if (inClass) {
      const s = students.find((x) => x.student_id === r.id);
      if (s) openStudent(s);
    } else {
      const c = geoChildren.find((x) => x.id === r.id);
      if (c) drill(c);
    }
  };
  // The viewer's own entity, highlighted among its peers at the home level
  // only (a teacher's "entity" among the school's teachers is their user id).
  const ownId = stack.length === 1 && profile.geo_entity ? (profile.geo_entity.type === "school" ? profile.id : profile.geo_entity.id) : null;
  // The newest date of the root series: the trend's window ends there for every line.
  const newestDate = scores?.series.length ? scores.series[scores.series.length - 1].date : undefined;
  const closeModal = useCallback(() => setModal(null), []);
  const closeReport = useCallback(() => setReportOpen(false), []);

  return (
    <ViewerProvider id={profile.id}>
      <div className="min-h-screen scroll-smooth bg-zinc-50 text-zinc-900">
        {/* report header — logo + section shortcuts + language + Generate report */}
        <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/90 backdrop-blur">
          <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
            <Image src="/lifteracy-logo-only.svg" alt="Lifteracy" width={160} height={64} className="h-10 w-auto shrink-0 sm:h-14 md:h-16" priority />
            {/* nav centred in the bar, independent of logo width */}
            <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-6 text-sm font-semibold text-zinc-600 lg:flex">
              <a href="#rep-top" className="transition-colors hover:text-blue-600">
                {t("Top")}
              </a>
              <a href="#rep-perf" className="transition-colors hover:text-blue-600">
                {t(nounS)} {t("Performance")}
              </a>
              {!inClass && (
                <a href="#rep-spotlight" className="transition-colors hover:text-blue-600">
                  {t(officer)} {t("Spotlight")}
                </a>
              )}
              <a href="#rep-profile" className="transition-colors hover:text-blue-600">
                {t("Your Profile")}
              </a>
            </nav>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <MvpLangToggle lang={lang} setLang={setLang} />
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                disabled={!reportData}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40 sm:px-5 sm:text-sm md:text-base"
                style={{ background: ACCENT }}
              >
                {/* phones: just "Report" */}
                ⤓ <span className="sm:hidden">{t("Report")}</span>
                <span className="hidden sm:inline">{t("Generate report")}</span>
              </button>
            </div>
          </div>
        </header>
        <div id="rep-top" />

        {!entity ? (
          <div className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-zinc-500">{t("This user is not linked to a location yet.")}</div>
        ) : (
          <>
            {/* large location title */}
            <div className="mx-auto max-w-6xl px-6 pt-8">
              <h1 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl" data-testid="location-title">
                {titleSegments.map((s, i) => (
                  <span key={i} className={i === 0 ? "text-zinc-900" : "font-semibold text-zinc-400"}>
                    {i > 0 ? "  -  " : ""}
                    {s}
                  </span>
                ))}
              </h1>
            </div>

            {/* headline stats — narrower, with the shared metric tab */}
            <div className="mx-auto mt-6 max-w-5xl px-6">
              <div className="mb-3 flex flex-col items-center gap-2">
                <MvpMetricToggle metric={pickedMetric} setMetric={setMetric} t={t} />
                {/* Time only: yesterday / last seven days / all time */}
                {pickedMetric === "usage" && <MvpTimeWindowToggle window={pickedWindow} setWindow={setTimeWindow} t={t} />}
              </div>
              {loaded?.error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load results — {loaded.error}</p>}
              {loading && <p className="text-center text-sm text-zinc-400">{t("Loading your dashboard…")}</p>}
              {scores && emptyRoot && (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-lg font-semibold text-zinc-600" data-testid="empty-root">
                  {t(EMPTY_ROOT_TEXT)}
                </div>
              )}
              {/* the headline figures only after a drill: the home level is for ranking against peers */}
              {scores && !emptyRoot && stack.length > 1 && (
                <RepKpis
                  root={scores.root}
                  metricLabel={metricLabel}
                  nounP={nounP}
                  usingN={usingN}
                  totalN={geoChildren.length}
                  showUsing={childType !== "teacher" && childType !== "student"}
                  timeWindow={timeMode ? timeWindow : undefined}
                  // the teacher's own class: "of students pass …" (no age band)
                  ageBand={inClass ? null : ageBandOf(metric, scores.age_band)}
                  t={t}
                />
              )}
            </div>

            {/* bars: every child ranked — ABOVE the map (2026-10) */}
            {scores && (
              <div className="mx-auto mt-6 shrink-0" style={{ width: "min(calc(100% - 3rem), 69rem)" }} data-testid="bar-strip-wrap">
                <BarStrip
                  items={emptyRoot ? [] : barItems}
                  max={barMax}
                  hoverId={hoverId}
                  setHoverId={setHoverId}
                  selId={selId}
                  onClick={(b) => {
                    if (inClass) {
                      const st = students.find((x) => x.student_id === b.id);
                      if (st) openStudent(st);
                    } else {
                      const c = geoChildren.find((x) => x.id === b.id);
                      if (!c) return;
                      select(c);
                      if (barClickTimer.current) clearTimeout(barClickTimer.current);
                      barClickTimer.current = setTimeout(() => openChild(c), 260);
                    }
                  }}
                  onDoubleClick={(b) => {
                    if (barClickTimer.current) clearTimeout(barClickTimer.current);
                    if (inClass) return;
                    const c = geoChildren.find((x) => x.id === b.id);
                    if (c) drill(c);
                  }}
                  ownId={ownId}
                  t={t}
                />
              </div>
            )}

            {/* map card: the map (geo levels), teacher cards (school) or student tiles (class), + the up-a-level button */}
            <div
              className="relative mx-auto h-[460px] shrink-0 overflow-hidden rounded-b-2xl border border-zinc-200 bg-[#eaf0f6] shadow-sm"
              style={{ width: "min(calc(100% - 3rem), 69rem)" }}
              data-testid="map-card"
            >
              {entity.type === "school" ? (
                scores && <TeacherCards teachers={geoChildren} metric={metric} range={range} time={timeMode} timeWindow={timeWindow} timeCaption={timeSuffix} selId={selId} ownId={ownId} onOpen={openChild} drillHint={hintOpen && ownId ? t("This is you. Double-click your card to see your class.") : null} onDismissHint={dismissHint} onSelect={select} onDrill={drill} onClear={() => setSelId(null)} onUp={up} t={t} />
              ) : entity.type === "teacher" ? (
                scores && <StudentTiles students={students} metric={metric} time={timeMode} timeWindow={timeWindow} timeCaption={timeSuffix} onOpen={openStudent} onRename={renameStudent} onUp={up} t={t}
                    hoverId={hoverId}
                    setHoverId={setHoverId}
                  />
              ) : (
                <GeoMap
                  entity={entity}
                  childType={(childType && childType !== "student" && childType !== "teacher" ? childType : nextChildType(entity.type)) as Exclude<ChildType, "student" | "teacher">}
                  childrenRows={geoChildren}
                  incompleteStates={incomplete}
                  hoverId={hoverId}
                  setHoverId={setHoverId}
                  selectedId={selId}
                  onSelect={select}
                  onDrill={drill}
                  onUp={up}
                  ownId={ownId}
                  timeWindow={timeWindow}
                  drillHint={hintOpen && ownId ? `${t("This is you. Double-click your")} ${t(nounS).toLowerCase()} ${t("to see your own results.")}` : null}
                  onDismissHint={dismissHint}
                  metricLabel={metricLabel}
                  time={timeMode}
                  t={t}
                />
              )}
              {/* bottom-right: up-a-level button */}
              <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex items-end gap-2">
                <div className="pointer-events-auto overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-md">
                  <button
                    type="button"
                    onClick={up}
                    title={t("Go up a level")}
                    aria-label={t("Up a level")}
                    disabled={!canUp}
                    className={"flex h-9 w-9 items-center justify-center " + (canUp ? "text-zinc-700 hover:bg-zinc-100" : "cursor-default text-zinc-300")}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 16V5" />
                      <path d="M7 10l5-5 5 5" />
                      <path d="M5 20h14" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* teachers only: the referral link parents use to enrol under this teacher, right below the map card */}
            {profile.geo_entity?.type === "school" && <MvpShareBar shareLink={profile.share_link} t={t} />}

            {scores && !emptyRoot && childType && (
              <>
                {/* Performance — trend + most improved */}
                <section id="rep-perf" className="scroll-mt-16 bg-blue-50 py-10">
                  <div className="mx-auto max-w-6xl px-6">
                    <div className={"mb-6 " + H} style={{ color: ACCENT }}>
                      {t(nounS)} {t("Performance")}
                    </div>
                    {/* the Time window toggle lives under the title only — the trend has its own range */}
                    <div className="-mt-3 mb-5 flex justify-center">
                      <MvpMetricToggle metric={pickedMetric} setMetric={setMetric} t={t} />
                    </div>
                    <div className={CARD + " space-y-6"}>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-base font-semibold text-zinc-800">
                            {t("Trend")}
                            <HoverLabel child={hoverId ? geoChildren.find((c) => c.id === hoverId) ?? null : null} time={timeMode} t={t} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <MvpTimeWindowToggle window={trendWindow} setWindow={setTrendWindow} label="Trend window" testId="trend-window-toggle" t={t} />
                            <a
                              href={withViewer(csvUrl(entity.id, pickedMetric, pickedRange, pickedWin), profile.id)}
                              target="_blank"
                              rel="noreferrer"
                              data-testid="csv-link"
                              className="hidden rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50 sm:block"
                            >
                              {t("Download CSV")}
                            </a>
                          </div>
                        </div>
                        <RepTrend
                          series={lastDays(scores.series, WINDOW_DAYS[trendWindow])}
                          label={isUsageMetric ? t("Total minutes") : t(METRIC_BY[metric].short)}
                          metric={metric}
                          passMark={scores.pass_mark}
                          students={
                            inClass
                              ? (scores.students_series ?? []).map((ss) => ({
                                  id: ss.student_id,
                                  label: ((s) => withPhone(s?.name?.split(/\s+/)[0] ?? UNNAMED, s?.phone))(students.find((s) => s.student_id === ss.student_id)),
                                  points: lastDays(ss.points, WINDOW_DAYS[trendWindow], newestDate),
                                }))
                              : // one faint line per child (area, or a teacher's class) — hover a marker / card to light it up
                                (scores.children_series ?? []).map((cs) => ({
                                  id: cs.id,
                                  label: geoChildren.find((c) => c.id === cs.id)?.name ?? "",
                                  points: lastDays(cs.points, WINDOW_DAYS[trendWindow], newestDate),
                                }))
                          }
                          hoverId={hoverId}
                          setHoverId={setHoverId}
                          pinId={pinId}
                          setPinId={setPinId}
                          t={t}
                        />
                      </div>
                      {/* most improved (change vs the range / the Time window before) and top performing, side by side */}
                      {/* drilled in: which level to rank (the children by default, or any level below) */}
                      {rankOptions.length > 1 && entity && (
                        <div className="flex justify-center border-t border-zinc-100 pt-5">
                          <div className="inline-flex flex-wrap justify-center gap-1 rounded-full bg-zinc-100 p-1 text-xs font-semibold ring-1 ring-zinc-200" role="group" aria-label="Ranking level" data-testid="rank-level-toggle">
                            {rankOptions.map((l) => (
                              <button
                                key={l}
                                type="button"
                                aria-pressed={rankLevel === l}
                                onClick={() => setRankPick({ entityId: entity.id, level: l })}
                                className={"rounded-full px-3.5 py-1.5 transition " + (rankLevel === l ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:bg-white")}
                              >
                                {t(RANK_LEVEL_LABEL[l])}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* most improved (left) and top performing (right): both by the selected metric / Time window */}
                      <div className={"grid grid-cols-1 gap-6 md:grid-cols-2" + (rankOptions.length > 1 ? "" : " border-t border-zinc-100 pt-5")}>
                        <div data-testid="most-improved">
                          <div className="mb-3 text-base font-semibold text-zinc-800">{t("Most improved")}</div>
                          {shownImproved.length === 0 && <p className="py-2 text-sm text-zinc-400">{t("Nobody has improved yet.")}</p>}
                          <RankBars rows={shownImproved} kind="improved" format={fmtDelta} hoverId={hoverId} setHoverId={setHoverId} selId={selId} onSelect={select} onPick={pickRow} />
                        </div>
                        <div data-testid="top-performing">
                          <div className="mb-3 text-base font-semibold text-zinc-800">{t("Top performing")}</div>
                          {shownTop.length === 0 && <p className="py-2 text-sm text-zinc-400">{t("No results in this window")}</p>}
                          <RankBars rows={shownTop} kind="top" format={fmtRank} hoverId={hoverId} setHoverId={setHoverId} selId={selId} onSelect={select} onPick={pickRow} />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Spotlight — two testimonials inside a card; hidden in the class view */}
                {!inClass && (
                  <section id="rep-spotlight" className="scroll-mt-16 py-10">
                    <div className="mx-auto max-w-6xl px-6">
                      <div className={"mb-6 " + H} style={{ color: ACCENT }}>
                        {t(officer)} {t("Spotlight")}
                      </div>
                      <div className={CARD}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <RepQuote kind="top" entry={spotlight?.top ?? null} nounS={nounS} officer={officer} range={range} time={timeMode} t={t} />
                          <RepQuote kind="improved" entry={spotlight?.most_improved ?? null} nounS={nounS} officer={officer} range={range} time={timeMode} deltaSuffix={deltaSuffix} t={t} />
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* Personal details / profile settings */}
        <section id="rep-profile" className={"scroll-mt-16 py-10" + (inClass ? "" : " bg-blue-50")}>
          <div className="mx-auto max-w-6xl px-6">
            <div className={"mb-6 " + H} style={{ color: ACCENT }}>
              {t("Your Profile")}
            </div>
            <div className={CARD}>
              <ProfileEditor profile={profile} onSaved={setProfile} t={t} />
            </div>
          </div>
        </section>

        {/* shared footer */}
        <section className="pb-10">
          <div className="mx-auto max-w-6xl px-6">
            <SiteFooter t={t} />
          </div>
        </section>

        {modal && <MvpTeacherModal subject={modal} metric={metric} onClose={closeModal} onRename={renameStudent} t={t} />}
        {reportOpen && reportData && <ReportCardModal data={reportData} onClose={closeReport} />}
      </div>
    </ViewerProvider>
  );
}

// ------------------------------------------------------------------ pieces

function HoverLabel({ child, time = false, t }: { child: Child | null; time?: boolean; t: T }) {
  if (!child) return null;
  return (
    <span className="ml-2 text-[11px] font-normal text-zinc-500">
      · {child.name}
      {child.using_lifteracy
        ? time
          ? ` — ${fmtDuration(child.time_sum, t)}`
          : ` — ${fmtPct(child.pass_rate)} (${fmtDelta(child.delta)})`
        : ` — ${t("not using Lifteracy")}`}
    </span>
  );
}

// School level: mvp2's teacher row cards inside the map card — one tinted row
// per teacher (avatar ring, name, "Teacher · N students", score, trend).
// Single click pins the row into the Detail card; double-click opens the class.
function TeacherCards({
  onOpen,
  drillHint = null,
  onDismissHint,
  teachers,
  metric,
  time,
  timeWindow,
  timeCaption,
  ownId = null,
  selId,
  onSelect,
  onDrill,
  onClear,
  onUp,
  t,
}: {
  teachers: Child[];
  metric: Metric;
  range: Range;
  // Time mode: the class's active time per student over the window
  // (`timeCaption` names it), coloured by the per-day average; no trend arrow.
  time: boolean;
  timeWindow?: TimeWindow;
  timeCaption?: string;
  selId: string | null;
  // the viewer's own card (a teacher among the school's teachers)
  ownId?: string | null;
  drillHint?: string | null;
  onDismissHint?: () => void;
  // a single click also opens the teacher's details pop-up
  onOpen?: (c: Child) => void;
  onSelect: (c: Child) => void;
  onDrill: (c: Child) => void;
  onClear: () => void;
  // double-click on the grey background → up a level (the cards stop the event)
  onUp?: () => void;
  t: T;
}) {
  const short = t(METRIC_BY[metric].short);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[#eaf0f6] p-3 sm:p-5" onClick={onClear} onDoubleClick={() => onUp?.()} data-testid="teacher-cards">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {!teachers.length && <p className="py-10 text-center text-sm text-zinc-400">{t("No teachers yet.")}</p>}
        {teachers.map((c) => {
          const col = time ? windowColor(c.time_total, timeWindow) : nipColor(c.pass_rate);
          const parts = fmtDurationParts(c.time_sum, t);
          const big = time ? parts.value : fmtPctInt(c.pass_rate);
          const own = ownId === c.id;
          const caption = time ? `${parts.unit} ${timeCaption ?? ""}` : metric === "usage" ? t("5+ min yesterday") : short;
          const on = selId === c.id;
          return (
            <div
              key={c.id}
              className={"relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 shadow-sm transition hover:shadow-md sm:gap-4 sm:px-5 sm:py-4" + (own ? " ring-4 ring-blue-600" : on ? " ring-2 ring-blue-500" : "")}
              data-own={own ? "1" : undefined}
              style={{ background: col + "1f", border: "1px solid " + col + "55" }}
              title="Double-click for this teacher's class"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(c);
                if (clickTimer.current) clearTimeout(clickTimer.current);
                clickTimer.current = setTimeout(() => onOpen?.(c), 260);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (clickTimer.current) clearTimeout(clickTimer.current);
                onDrill(c);
              }}
              data-testid="teacher-card"
            >
              {own && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow" data-testid="own-card-tag">
                  {t("You")}
                </span>
              )}
              {own && drillHint && <DrillHint x="50%" y={-6} text={drillHint} onDismiss={onDismissHint} t={t} />}
              <AvatarImg seed={c.official?.avatar_seed ?? c.id} size={64} className="h-12 w-12 sm:h-16 sm:w-16" ring={col} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold leading-tight text-zinc-900 sm:text-lg">{c.name}</div>
                <div className="truncate text-[11px] text-zinc-500 sm:text-[12px]">
                  {t("Teacher")} · {c.students ?? c.n} {t("students")}
                </div>
                {/* phones: score + compact trend under the name so nothing is squeezed out */}
                <div className="mt-1 flex items-center gap-2 sm:hidden">
                  <span className="text-lg font-extrabold tabular-nums" style={{ color: col }}>
                    {big}
                  </span>
                  <span className={time ? "text-[12px] font-semibold leading-tight text-zinc-600" : "text-[10px] leading-tight text-zinc-500"}>{caption}</span>
                </div>
              </div>
              {/* ≥sm: score + zig-zag trend on the right */}
              <div className="hidden flex-shrink-0 items-center gap-4 sm:flex">
                <div className="text-right">
                  <div className="text-2xl font-extrabold tabular-nums" style={{ color: col }}>
                    {big}
                  </div>
                  <div className={time ? "text-[12px] font-semibold leading-tight text-zinc-600" : "text-[10px] leading-tight text-zinc-500"}>{caption}</div>
                </div>
                {!time && <MvpTrend delta={c.delta} suffix={t("vs 7 days ago")} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Class view: mvp2's student tiles — solid score colour, name (editable in
// place), score, metric, ▲/▼ delta. Click opens the student's dashboard modal.
function StudentTiles({
  students,
  metric,
  time,
  timeWindow,
  timeCaption,
  onOpen,
  onRename,
  onUp,
  hoverId,
  setHoverId,
  t,
}: {
  students: StudentChild[];
  metric: Metric;
  timeWindow?: TimeWindow;
  timeCaption?: string;
  // Time mode: the student's active time in the window (total + minutes per
  // day), coloured by the per-day average; no ▲/▼ change.
  time: boolean;
  onOpen: (s: StudentChild) => void;
  onRename: (studentId: string, name: string) => void;
  // double-click on the grey background → up a level (tiles stop the event)
  onUp?: () => void;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  t: T;
}) {
  const short = t(METRIC_BY[metric].short);
  const isUsage = metric === "usage"; // score = minutes, delta in minutes
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[#eaf0f6] p-3 sm:p-5" onDoubleClick={() => onUp?.()} data-testid="student-tiles">
      {!students.length && <p className="py-10 text-center text-sm text-zinc-400">{t("No students yet.")}</p>}
      <div className="mx-auto grid max-w-5xl gap-2.5 sm:gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
        {students.map((s) => {
          const pct = s.score == null ? null : s.score * 100;
          const col = time ? windowColor(s.time_total, timeWindow) : isUsage ? usageColor(s.score) : pct == null ? UNCOVERED : nipColor(pct);
          const fg = col === "#f59e0b" ? "#1c1917" : "#ffffff";
          const d = s.delta;
          return (
            <div
              key={s.student_id}
              className="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-3 text-center shadow-sm transition hover:shadow-md"
              style={{ background: col, color: fg }}
              title="Click for this student's dashboard"
              onClick={() => onOpen(s)}
              onDoubleClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setHoverId(s.student_id)}
              onMouseLeave={() => setHoverId(null)}
              data-testid="student-tile"
              data-hot={hoverId === s.student_id ? "1" : undefined}
            >
              <div className="flex w-full justify-center text-[13px] font-bold sm:text-sm">
                {/* only the student's own teacher (pii full) may rename; everyone else sees the masked name */}
                {isPiiFull(s.pii) ? (
                  <EditableStudentName studentId={s.student_id} name={s.name} fallback={UNNAMED} onSaved={(name) => onRename(s.student_id, name)} t={t} />
                ) : (
                  <span className={"truncate " + (s.name ? "" : "italic opacity-70")} data-testid="student-name-masked">
                    {s.name ?? UNNAMED}
                  </span>
                )}
              </div>
              {s.phone && (
                <div className="font-mono text-[10px] font-semibold tabular-nums opacity-90" data-testid="tile-phone">
                  {s.phone}
                </div>
              )}
              <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">{time ? fmtDurationParts(s.time_total, t).value : isUsage ? fmtMinutes(s.score) : fmtPctInt(pct)}</div>
              {time ? (
                <div className="text-[10px] font-semibold opacity-90">
                  {fmtDurationParts(s.time_total, t).unit} {timeCaption}
                </div>
              ) : (
                <>
                  <div className="text-[9px] font-semibold opacity-90">{isUsage ? t("min yesterday") : short}</div>
                  <div className="text-[11px] font-bold tabular-nums">{d == null ? "—" : `${Math.abs(d) < 0.5 ? "→" : d > 0 ? "▲" : "▼"} ${(d >= 0 ? "+" : "") + d.toFixed(1)}${isUsage ? ` ${t("min")}` : "%"}`}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ profile

const SPOTLIGHT_MAX = 300;
const NAME_MAX = 80;

function ProfileEditor({ profile, onSaved, t }: { profile: PublicProfile; onSaved: (p: PublicProfile) => void; t: T }) {
  const [name, setName] = useState(profile.name ?? "");
  const [spot, setSpot] = useState(profile.spotlight_message ?? "");
  const [previewSeed, setPreviewSeed] = useState<string>(seedFor(profile.avatar_seed, profile.id));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = async (body: Record<string, string>) => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(withViewer(profileUrl(profile.id), profile.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        setStatus({ ok: false, text: `Not saved — ${await serverMessage(res)}` });
        return false;
      }
      const next = (await res.json()) as PublicProfile;
      onSaved(next);
      setStatus({ ok: true, text: t("Saved") });
      return true;
    } catch (err) {
      setStatus({ ok: false, text: `Not saved — ${(err as Error).message}` });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const shuffle = async () => {
    const seed = randomSeed();
    setPreviewSeed(seed);
    const ok = await patch({ avatar_seed: seed });
    if (!ok) setPreviewSeed(seedFor(profile.avatar_seed, profile.id));
  };

  const pending: Record<string, string> = {};
  if (name.trim() !== (profile.name ?? "")) pending.name = name.trim();
  if (spot !== (profile.spotlight_message ?? "")) pending.spotlight_message = spot;
  const hasChanges = Object.keys(pending).length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <div className="flex flex-col items-center justify-center gap-4">
        <AvatarImg seed={previewSeed} size={144} className="h-36 w-36" ring={ACCENT} ringWidth={4} shadow="0 8px 20px -8px rgba(0,0,0,0.25)" />
        <div className="flex w-full max-w-[12rem] flex-col items-center gap-1.5">
          {/* the plant avatar is the one deliberate departure from mvp2 ("Upload profile photo") */}
          <button
            type="button"
            onClick={shuffle}
            disabled={busy}
            className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {t("Shuffle avatar")}
          </button>
        </div>
      </div>
      <form
        className="space-y-4 sm:col-span-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (hasChanges) patch(pending);
        }}
      >
        <div>
          <label htmlFor="pf-name" className="mb-1 block text-xl font-extrabold tracking-tight" style={{ color: ACCENT }}>
            {t("Display name")}
          </label>
          <input id="pf-name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder={t("Your name")} className={inputCls} />
        </div>
        <div>
          <label htmlFor="pf-spot" className="mb-1 block text-xl font-extrabold tracking-tight" style={{ color: ACCENT }}>
            {t("Spotlight message")} <span className="text-xs font-normal text-zinc-400">· {t("shown when you're top or most-improved in your cohort")}</span>
          </label>
          <textarea id="pf-spot" value={spot} maxLength={SPOTLIGHT_MAX} onChange={(e) => setSpot(e.target.value.slice(0, SPOTLIGHT_MAX))} rows={3} className={inputCls + " resize-y"} />
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">{t("Preview · top of your cohort")}</div>
          <div className="flex items-start gap-3">
            <AvatarImg seed={previewSeed} size={48} className="h-12 w-12" ring="#16a34a" ringWidth={2} />
            <div className="min-w-0">
              <div className="text-sm font-bold text-zinc-900">{name || t("Your name")}</div>
              <div className="text-[12px] italic text-zinc-700">“{spot || t("Your spotlight message will appear here.")}”</div>
            </div>
          </div>
        </div>
        {/* mvp2 has no save step (demo state); the real profile needs one */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || !hasChanges}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40"
          >
            {busy ? "…" : t("Save")}
          </button>
          {status && <span className={"text-sm " + (status.ok ? "text-emerald-700" : "text-red-600")}>{status.text}</span>}
        </div>
      </form>
    </div>
  );
}

// mvp2's DonorFooter.
function SiteFooter({ t }: { t: T }) {
  const SITE = "https://www.lifteracy.ai";
  const cols = [
    { h: "Lifteracy", links: [["About", SITE + "/#founders"], ["How it works", SITE + "/#video"], ["Contact", SITE + "/#traction-2"]] },
    {
      h: "Safety",
      links: [
        ["Child protection policy", "https://drive.google.com/file/d/1imqEMVpaPaERlr6RZrhtcYTf_cxe-sNV/view"],
        ["Privacy policy", "https://drive.google.com/file/d/1U1eMbmRu1NUVKAcSXsJzFhMUkaZTsXVE/view?usp=drive_link"],
        ["Terms and Conditions", "https://drive.google.com/file/d/1U1eMbmRu1NUVKAcSXsJzFhMUkaZTsXVE/view?usp=drive_link"],
      ],
    },
  ];
  return (
    <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Image src="/lifteracy-logo-only.svg" alt="Lifteracy" width={107} height={40} className="h-10 w-auto" />
          <div className="mt-2 text-[11px] text-zinc-500">{t("Teaching every child to read, over WhatsApp.")}</div>
          <a href={SITE} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-semibold text-blue-600 hover:underline">
            www.lifteracy.ai
          </a>
        </div>
        {cols.map((col) => (
          <div key={col.h}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{t(col.h)}</div>
            <div className="mt-2 space-y-1">
              {col.links.map(([n, u]) => (
                <a key={n} href={u} target="_blank" rel="noreferrer" className="block text-xs text-zinc-600 hover:text-blue-600">
                  {t(n)}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Most improved / top performing: up to five rows — rank, name, a rounded
// gradient bar on a track, the figure in a pill. Hover lights the row (and
// the area on the map), click selects, double-click opens / drills.
function RankBars({
  rows,
  kind,
  format,
  hoverId,
  setHoverId,
  selId,
  onSelect,
  onPick,
}: {
  rows: ImprovedRow[];
  kind: "improved" | "top";
  format: (v: number) => string;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selId: string | null;
  onSelect: (r: ImprovedRow) => void;
  onPick: (r: ImprovedRow) => void;
}) {
  const arr = rows.filter((r) => r.delta != null).slice(0, 5);
  if (!arr.length) return null;
  const max = Math.max(1e-9, ...arr.map((r) => Math.abs(r.delta!)));
  return (
    <ol className="space-y-2" data-testid={`rank-bars-${kind}`}>
      {arr.map((r, i) => {
        const v = r.delta!;
        const neg = v < 0;
        const hot = hoverId === r.id || selId === r.id;
        const fill = neg ? "linear-gradient(90deg,#fca5a5,#dc2626)" : kind === "top" ? "linear-gradient(90deg,#93c5fd,#2563eb)" : "linear-gradient(90deg,#86efac,#16a34a)";
        const pill = neg ? "bg-red-50 text-red-700" : kind === "top" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700";
        return (
          <li
            key={r.id}
            data-id={r.id}
            data-testid="rank-row"
            className={"flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 transition " + (hot ? "bg-zinc-100" : "hover:bg-zinc-50")}
            onMouseEnter={() => setHoverId(r.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onSelect(r)}
            onDoubleClick={() => onPick(r)}
          >
            <span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " + (i === 0 ? "bg-amber-400 text-white" : "bg-zinc-200 text-zinc-600")}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-800" title={r.name}>
                {r.name}
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full" style={{ width: `${Math.max(4, (Math.abs(v) / max) * 100)}%`, background: fill }} />
              </div>
            </div>
            <span className={"shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums " + pill}>{format(v)}</span>
          </li>
        );
      })}
    </ol>
  );
}
