"use client";

// Public teacher/official dashboard (/d/[user_id]) — the mvp2.html "report"
// layout (sandbox-global-map/mvp2.html) ported to Next, section for section:
// sticky header (logo · nav · EN/हिं · Generate report), location title, metric
// toggle, headline KPI card(s), the 460 px map card (student cards at school
// level) with the up-a-level button, "{Noun} Detail", "{Noun} Performance"
// (trend + range bar + most improved), "{Officer} Spotlight", "Your Profile",
// footer. All numbers come from pp-sketch via /api/proxy (public allowlist, no
// session). The only deliberate departure from mvp2 is the plant avatar.

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { randomSeed, seedFor } from "./avatar";
import {
  ACCENT,
  CHILD_NOUN,
  CHILD_OFFICER,
  DEFAULT_METRIC,
  DEFAULT_RANGE,
  displayName,
  EMPTY_ROOT_TEXT,
  fmtDelta,
  fmtPct,
  fmtPctInt,
  geoChildrenOf,
  METRIC_BY,
  nipColor,
  profileUrl,
  scoresUrl,
  spotlightUrl,
  studentChildrenOf,
  type Child,
  type ChildType,
  type GeoRef,
  type Metric,
  type PublicProfile,
  type Range,
  type ScoresResponse,
  type SpotlightResponse,
  type StudentChild,
} from "./dashboard-types";
import { GeoMap } from "./geo-map";
import { isLang, LANG_STORAGE_KEY, makeT, type Lang, type T } from "./i18n";
import { AvatarImg, MvpLangToggle, MvpMetricToggle, MvpRangeBar, MvpTeacherModal, MvpTrend, type ModalSubject } from "./mvp-widgets";
import { ReportCardModal, RepImproved, RepKpis, RepMeta, RepQuote, RepTrend, type ReportData } from "./report-card-modal";

export type TeacherDashboardProps = {
  profile: PublicProfile;
  incompleteStates: string[];
};

type Loaded = { key: string; scores: ScoresResponse | null; spotlight: SpotlightResponse | null; error: string | null };

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

const toRef = (c: GeoRef): GeoRef => ({ id: c.id, type: c.type, code: c.code, name: c.name, has_boundary: c.has_boundary, lat: c.lat, lng: c.lng });

// mvp2's report constants: section heading, card, input.
const H = "text-center text-3xl font-extrabold tracking-tight sm:text-4xl";
const CARD = "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8";
const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export function TeacherDashboard({ profile: initialProfile, incompleteStates }: TeacherDashboardProps) {
  const [profile, setProfile] = useState<PublicProfile>(initialProfile);
  const [metric, setMetric] = useState<Metric>(DEFAULT_METRIC);
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [stack, setStack] = useState<GeoRef[]>(() => (initialProfile.geo_entity ? [toRef(initialProfile.geo_entity)] : []));
  const [data, setData] = useState<Loaded | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
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
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      // storage unavailable
    }
  }, []);

  const entity = stack.length ? stack[stack.length - 1] : null;
  const key = entity ? `${entity.id}|${metric}|${range}` : "";

  // ---- data: scores + spotlight for the current level ----
  useEffect(() => {
    if (!entity) return;
    const id = entity.id;
    const k = `${id}|${metric}|${range}`;
    let cancelled = false;
    const getJson = async <T,>(url: string): Promise<T> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(await serverMessage(res));
      return (await res.json()) as T;
    };
    Promise.all([getJson<ScoresResponse>(scoresUrl(id, metric, range)), getJson<SpotlightResponse>(spotlightUrl(id, metric, range)).catch(() => null)])
      .then(([scores, spotlight]) => {
        if (!cancelled) setData({ key: k, scores, spotlight, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setData({ key: k, scores: null, spotlight: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [entity, metric, range]);

  const loaded = data && data.key === key ? data : null;
  const scores = loaded?.scores ?? null;
  const spotlight = loaded?.spotlight ?? null;
  const loading = !!entity && !loaded;

  const childType: ChildType | null = scores ? scores.child_type : null;
  const geoChildren: Child[] = useMemo(() => (scores ? geoChildrenOf(scores) : []), [scores]);
  const students: StudentChild[] = useMemo(() => (scores ? studentChildrenOf(scores) : []), [scores]);
  const emptyRoot = !!scores && scores.root.n == null;
  const usingN = geoChildren.filter((c) => c.using_lifteracy).length;
  const atSchool = !!entity && entity.type === "school";
  const [nounS, nounP] = childType ? CHILD_NOUN[childType] : atSchool ? CHILD_NOUN.student : ["Area", "areas"];
  const officer = childType ? CHILD_OFFICER[childType] : atSchool ? CHILD_OFFICER.student : "Official";
  const metricLabel = METRIC_BY[metric].label;

  // parent district for the block-level outline: previous stack entry, else the profile's ancestors
  const parentDistrict = useMemo<GeoRef | null>(() => {
    if (!entity || entity.type !== "block") return null;
    const prev = stack.length >= 2 ? stack[stack.length - 2] : null;
    if (prev && prev.type === "district") return prev;
    const a = profile.ancestors.find((x) => x.type === "district");
    return a ? { id: a.id, type: a.type, code: a.code, name: a.name, has_boundary: true, lat: null, lng: null } : null;
  }, [entity, stack, profile.ancestors]);

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
  const select = useCallback((c: Child) => setSelId((cur) => (cur === c.id ? null : c.id)), []);
  const selectStudent = useCallback((s: StudentChild) => setSelId((cur) => (cur === s.student_id ? null : s.student_id)), []);
  const openChild = useCallback(
    (c: Child) => {
      if (!childType || childType === "student") return;
      setModal({ kind: "child", child: c, childType });
    },
    [childType],
  );
  const openStudent = useCallback((s: StudentChild) => setModal({ kind: "student", student: s }), []);

  const locationTitle = [...profile.ancestors, ...stack].map((a) => t(displayName(a.name, a.type))).join("  -  ");
  const detailChild = useMemo(() => {
    const pick = (id: string | null) => (id ? geoChildren.find((c) => c.id === id) ?? null : null);
    return pick(hoverId) ?? pick(selId) ?? (spotlight?.top?.child ?? null) ?? geoChildren[0] ?? null;
  }, [hoverId, selId, geoChildren, spotlight]);
  const detailStudent = useMemo(() => {
    const pick = (id: string | null) => (id ? students.find((s) => s.student_id === id) ?? null : null);
    return pick(hoverId) ?? pick(selId) ?? students[0] ?? null;
  }, [hoverId, selId, students]);

  const reportData: ReportData | null =
    scores && childType && entity
      ? {
          title: locationTitle || entity.name,
          shareLink: profile.share_link,
          metric,
          range,
          asOf: scores.as_of,
          root: scores.root,
          series: scores.series,
          childType,
          childrenRows: geoChildren,
          mostImproved: scores.most_improved,
          spotlight,
        }
      : null;

  const closeModal = useCallback(() => setModal(null), []);
  const closeReport = useCallback(() => setReportOpen(false), []);

  return (
    <div className="min-h-screen scroll-smooth bg-zinc-50 text-zinc-900">
      {/* report header — logo + section shortcuts + language + Generate report */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/90 backdrop-blur">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          <Image src="/lifteracy-logo-only.svg" alt="Lifteracy" width={160} height={64} className="h-14 w-auto shrink-0 sm:h-16" priority />
          {/* nav centred in the bar, independent of logo width */}
          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-6 text-sm font-semibold text-zinc-600 md:flex">
            <a href="#rep-top" className="transition-colors hover:text-blue-600">
              {t("Top")}
            </a>
            <a href="#rep-perf" className="transition-colors hover:text-blue-600">
              {t(nounS)} {t("Performance")}
            </a>
            <a href="#rep-spotlight" className="transition-colors hover:text-blue-600">
              {t(officer)} {t("Spotlight")}
            </a>
            <a href="#rep-profile" className="transition-colors hover:text-blue-600">
              {t("Your Profile")}
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <MvpLangToggle lang={lang} setLang={setLang} />
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              disabled={!reportData}
              className="rounded-lg px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40 sm:text-base"
              style={{ background: ACCENT }}
            >
              ⤓ {t("Generate report")}
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
            <h1 className="text-center text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl" data-testid="location-title">
              {locationTitle}
            </h1>
          </div>

          {/* headline stats — narrower, with the shared metric tab */}
          <div className="mx-auto mt-6 max-w-5xl px-6">
            <div className="mb-3 flex justify-center">
              <MvpMetricToggle metric={metric} setMetric={setMetric} />
            </div>
            {loaded?.error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load results — {loaded.error}</p>}
            {loading && <p className="text-center text-sm text-zinc-400">{t("Loading your dashboard…")}</p>}
            {scores && emptyRoot && (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-lg font-semibold text-zinc-600" data-testid="empty-root">
                {t(EMPTY_ROOT_TEXT)}
              </div>
            )}
            {scores && !emptyRoot && (
              <RepKpis root={scores.root} metricLabel={metricLabel} nounP={nounP} usingN={usingN} totalN={geoChildren.length} showUsing={childType !== "student"} t={t} />
            )}
          </div>

          {/* map card (every level except school) or the student cards, with the up-a-level button */}
          <div
            className="relative mx-auto mt-6 h-[460px] shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-[#eaf0f6] shadow-sm"
            style={{ width: "min(calc(100% - 3rem), 69rem)" }}
            data-testid="map-card"
          >
            {entity.type !== "school" ? (
              <GeoMap
                entity={entity}
                parentDistrict={parentDistrict}
                childType={(childType && childType !== "student" ? childType : nextChildType(entity.type)) as Exclude<ChildType, "student">}
                childrenRows={geoChildren}
                incompleteStates={incomplete}
                hoverId={hoverId}
                setHoverId={setHoverId}
                selectedId={selId}
                onSelect={select}
                onDrill={drill}
                metricLabel={metricLabel}
                t={t}
              />
            ) : (
              scores && <StudentCards students={students} metric={metric} range={range} selId={selId} onSelect={selectStudent} onOpen={openStudent} onClear={() => setSelId(null)} t={t} />
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

          {scores && !emptyRoot && childType && (
            <>
              {/* metadata card — between the map and the trend graph */}
              <section className="py-10">
                <div className="mx-auto max-w-6xl px-6">
                  <div className={"mb-6 " + H} style={{ color: ACCENT }}>
                    {t(nounS)} {t("Detail")}
                  </div>
                  <div
                    className={CARD + " cursor-pointer"}
                    title={childType === "student" ? `Click for this ${nounS.toLowerCase()}'s dashboard` : `Click for details · double-click to open this ${nounS.toLowerCase()}`}
                    onDoubleClick={() => childType !== "student" && detailChild && drill(detailChild)}
                    onClick={() => (childType === "student" ? detailStudent && openStudent(detailStudent) : detailChild && openChild(detailChild))}
                  >
                    {childType === "student" ? (
                      <RepMeta student={detailStudent} metricLabel={metricLabel} officer={officer} range={range} t={t} />
                    ) : (
                      <RepMeta child={detailChild} metricLabel={metricLabel} officer={officer} range={range} t={t} />
                    )}
                  </div>
                </div>
              </section>

              {/* Performance — trend + most improved */}
              <section id="rep-perf" className="scroll-mt-16 bg-blue-50 py-10">
                <div className="mx-auto max-w-6xl px-6">
                  <div className={"mb-6 " + H} style={{ color: ACCENT }}>
                    {t(nounS)} {t("Performance")}
                  </div>
                  <div className="-mt-3 mb-5 flex justify-center">
                    <MvpMetricToggle metric={metric} setMetric={setMetric} />
                  </div>
                  <div className={CARD + " space-y-6"}>
                    {/* headline share of areas not on Lifteracy at all — hidden at school level */}
                    {childType !== "student" && (
                      <div className="text-center text-base font-medium text-zinc-700">
                        <span className="text-xl font-extrabold tabular-nums text-red-600">
                          {Math.round(((geoChildren.length - usingN) / Math.max(1, geoChildren.length)) * 100)}%
                        </span>{" "}
                        {t("of")} {t(nounP)} {t("in")} {t(displayName(entity.name, entity.type))} {t("are not using Lifteracy at all")}
                        <span className="ml-1 text-zinc-400">
                          ({geoChildren.length - usingN} {t("of")} {geoChildren.length})
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-base font-semibold text-zinc-800">
                          {t("Trend")}
                          <HoverLabel child={hoverId ? geoChildren.find((c) => c.id === hoverId) ?? null : null} t={t} />
                        </div>
                        <MvpRangeBar range={range} setRange={setRange} entityId={entity.id} metric={metric} t={t} />
                      </div>
                      <RepTrend series={scores.series} t={t} />
                    </div>
                    <div className="border-t border-zinc-100 pt-5">
                      <div className="mb-1 text-base font-semibold text-zinc-800">
                        {t("Most improved")} · {t("last")} {range} {t("days")}
                        <HoverLabel child={hoverId ? geoChildren.find((c) => c.id === hoverId) ?? null : null} t={t} />
                      </div>
                      <RepImproved mostImproved={scores.most_improved} hoverId={hoverId} setHoverId={setHoverId} selId={selId} onSelect={select} onPick={drill} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Spotlight — two testimonials inside a card */}
              <section id="rep-spotlight" className="scroll-mt-16 py-10">
                <div className="mx-auto max-w-6xl px-6">
                  <div className={"mb-6 " + H} style={{ color: ACCENT }}>
                    {t(officer)} {t("Spotlight")}
                  </div>
                  <div className={CARD}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <RepQuote kind="top" entry={spotlight?.top ?? null} nounS={nounS} officer={officer} range={range} t={t} />
                      <RepQuote kind="improved" entry={spotlight?.most_improved ?? null} nounS={nounS} officer={officer} range={range} t={t} />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* Personal details / profile settings */}
      <section id="rep-profile" className="scroll-mt-16 bg-blue-50 py-10">
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

      {modal && <MvpTeacherModal subject={modal} metric={metric} onClose={closeModal} />}
      {reportOpen && reportData && <ReportCardModal data={reportData} onClose={closeReport} />}
    </div>
  );
}

const nextChildType = (t: GeoRef["type"]): ChildType =>
  t === "country" ? "state" : t === "state" ? "district" : t === "district" ? "block" : t === "block" ? "school" : "student";

// ------------------------------------------------------------------ pieces

function HoverLabel({ child, t }: { child: Child | null; t: T }) {
  if (!child) return null;
  return (
    <span className="ml-2 text-[11px] font-normal text-zinc-500">
      · {child.name}
      {child.using_lifteracy ? ` — ${fmtPct(child.pass_rate)} (${fmtDelta(child.delta)})` : ` — ${t("not using Lifteracy")}`}
    </span>
  );
}

// School level: mvp2's card list inside the map card — one tinted row per
// student (avatar ring, name, "Student · N attempts", score, trend). Single
// click pins the row into the Detail card; double-click opens the student modal.
function StudentCards({
  students,
  metric,
  range,
  selId,
  onSelect,
  onOpen,
  onClear,
  t,
}: {
  students: StudentChild[];
  metric: Metric;
  range: Range;
  selId: string | null;
  onSelect: (s: StudentChild) => void;
  onOpen: (s: StudentChild) => void;
  onClear: () => void;
  t: T;
}) {
  const short = METRIC_BY[metric].short;
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-[#eaf0f6] p-3 sm:p-5" onClick={onClear} data-testid="student-cards">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {!students.length && <p className="py-10 text-center text-sm text-zinc-400">{t("No students yet.")}</p>}
        {students.map((s) => {
          const pct = s.score == null ? null : s.score * 100;
          const col = nipColor(pct);
          const on = selId === s.student_id;
          return (
            <div
              key={s.student_id}
              className={"flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 shadow-sm transition hover:shadow-md sm:gap-4 sm:px-5 sm:py-4" + (on ? " ring-2 ring-blue-500" : "")}
              style={{ background: col + "1f", border: "1px solid " + col + "55" }}
              title="Click for details · double-click for this student's dashboard"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(s);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onOpen(s);
              }}
              data-testid="student-card"
            >
              <AvatarImg seed={s.student_id} size={64} className="h-12 w-12 sm:h-16 sm:w-16" ring={col} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold leading-tight text-zinc-900 sm:text-lg">{s.label}</div>
                <div className="truncate text-[11px] text-zinc-500 sm:text-[12px]">
                  {t("Student")} · {s.attempts} {t("attempts")}
                </div>
                {/* phones: score + compact label under the name so nothing is squeezed out */}
                <div className="mt-1 flex items-center gap-2 sm:hidden">
                  <span className="text-lg font-extrabold tabular-nums" style={{ color: col }}>
                    {fmtPctInt(pct)}
                  </span>
                  <span className="text-[10px] leading-tight text-zinc-500">{short}</span>
                </div>
              </div>
              {/* ≥sm: score + zig-zag trend on the right */}
              <div className="hidden flex-shrink-0 items-center gap-4 sm:flex">
                <div className="text-right">
                  <div className="text-2xl font-extrabold tabular-nums" style={{ color: col }}>
                    {fmtPctInt(pct)}
                  </div>
                  <div className="text-[10px] leading-tight text-zinc-500">{short}</div>
                </div>
                <MvpTrend delta={null} suffix={`${t("last")} ${range} ${t("days")}`} />
              </div>
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
      const res = await fetch(profileUrl(profile.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
