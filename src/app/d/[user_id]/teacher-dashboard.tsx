"use client";

// Public teacher/official dashboard (/d/[user_id]) — the mvp2.html "report"
// layout ported to Next: header + share bar, metric/range toggles, root KPIs,
// d3 map with drill-down, trend + latest + most-improved charts, sortable
// children table, spotlight, profile editor, report-card PDF. All numbers come
// from pp-sketch via /api/proxy (public allowlist, no session).

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { randomSeed, seedFor } from "./avatar";
import {
  ACCENT,
  binColor,
  CHILD_NOUN,
  CHILD_OFFICER,
  DEFAULT_METRIC,
  DEFAULT_RANGE,
  EMPTY_ROOT_TEXT,
  fmtDelta,
  fmtPct,
  geoChildrenOf,
  METRIC_BY,
  profileUrl,
  scoresUrl,
  spotlightUrl,
  studentChildrenOf,
  UNCOVERED,
  type Ancestor,
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
import { IconArrowUp, IconPdf, IconShuffle } from "./icons";
import { AvatarImg, MvpMetricToggle, MvpRangeBar, MvpShareBar, MvpTeacherModal, type ModalSubject } from "./mvp-widgets";
import { ReportCardModal, RepImproved, RepKpis, RepLatest, RepMeta, RepQuote, RepTrend, type ReportData } from "./report-card-modal";

export type TeacherDashboardProps = {
  profile: PublicProfile;
  incompleteStates: string[];
  explainerUrl: string | null;
  // server-rendered SVG for the profile's current seed (header only)
  avatarSvg?: string | null;
};

type Loaded = { key: string; scores: ScoresResponse | null; spotlight: SpotlightResponse | null; error: string | null };
type SortCol = "pass_rate" | "delta" | "n";

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

const H = "text-center text-2xl font-extrabold tracking-tight sm:text-4xl";
const CARD = "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8";
const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export function TeacherDashboard({ profile: initialProfile, incompleteStates, explainerUrl, avatarSvg }: TeacherDashboardProps) {
  const [profile, setProfile] = useState<PublicProfile>(initialProfile);
  const [metric, setMetric] = useState<Metric>(DEFAULT_METRIC);
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [stack, setStack] = useState<GeoRef[]>(() => (initialProfile.geo_entity ? [toRef(initialProfile.geo_entity)] : []));
  const [data, setData] = useState<Loaded | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalSubject | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" }>({ col: "pass_rate", dir: "desc" });
  const incomplete = useMemo(() => new Set(incompleteStates), [incompleteStates]);

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
  const [nounS, nounP] = childType ? CHILD_NOUN[childType] : ["Area", "areas"];
  const officer = childType ? CHILD_OFFICER[childType] : "Official";
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
  const goTo = useCallback((idx: number) => {
    setStack((s) => s.slice(0, idx + 1));
    setHoverId(null);
    setSelId(null);
  }, []);
  const up = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    setHoverId(null);
    setSelId(null);
  }, []);
  const select = useCallback((c: Child) => setSelId((cur) => (cur === c.id ? null : c.id)), []);
  const openChild = useCallback(
    (c: Child) => {
      if (!childType || childType === "student") return;
      setModal({ kind: "child", child: c, childType });
    },
    [childType],
  );

  const locationTitle = [...profile.ancestors.map((a) => a.name), ...stack.map((s) => s.name)].join("  -  ");
  const detailChild = useMemo(() => {
    const pick = (id: string | null) => (id ? geoChildren.find((c) => c.id === id) ?? null : null);
    return pick(hoverId) ?? pick(selId) ?? (spotlight?.top?.child ?? null) ?? geoChildren[0] ?? null;
  }, [hoverId, selId, geoChildren, spotlight]);

  const sortedChildren = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (c: Child) => (sort.col === "n" ? c.n : sort.col === "delta" ? c.delta : c.pass_rate);
    return geoChildren.slice().sort((a, b) => {
      const va = val(a),
        vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * dir;
    });
  }, [geoChildren, sort]);
  const toggleSort = (col: SortCol) => setSort((s) => (s.col === col ? { col, dir: s.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }));

  const reportData: ReportData | null =
    scores && childType && childType !== "student" && entity
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* sticky top bar: logo · section shortcuts · report */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-6">
          <Image src="/lifteracy-logo-only.svg" alt="Lifteracy" width={120} height={45} className="h-10 w-auto shrink-0 sm:h-14" priority />
          <nav className="hidden items-center gap-6 text-sm font-semibold text-zinc-600 md:flex">
            <a href="#rep-top" className="hover:text-blue-600">
              Top
            </a>
            <a href="#rep-perf" className="hover:text-blue-600">
              {nounS} Performance
            </a>
            <a href="#rep-spotlight" className="hover:text-blue-600">
              {officer} Spotlight
            </a>
            <a href="#rep-profile" className="hover:text-blue-600">
              Your Profile
            </a>
          </nav>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            disabled={!reportData}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40 sm:px-5 sm:text-base"
            style={{ background: ACCENT }}
          >
            <IconPdf /> Generate report
          </button>
        </div>
      </header>
      <div id="rep-top" />

      {/* profile header */}
      <div className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-3 py-5 sm:px-6" data-testid="profile-header">
          <HeaderAvatar profile={profile} initialSeed={initialProfile.avatar_seed} avatarSvg={avatarSvg ?? null} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{profile.name ?? "Lifteracy user"}</h1>
            <div className="text-sm font-semibold text-zinc-600">
              {profile.role_title ?? "—"}
              {profile.geo_entity ? <span className="text-zinc-400"> · {profile.geo_entity.name}</span> : null}
            </div>
            <Breadcrumb ancestors={profile.ancestors} />
          </div>
        </div>
      </div>

      <MvpShareBar shareLink={profile.share_link} explainerUrl={explainerUrl} />

      {!entity ? (
        <div className="mx-auto max-w-6xl px-3 py-10 text-center text-sm text-zinc-500 sm:px-6">This user is not linked to a location yet.</div>
      ) : (
        <>
          {/* location title + drill breadcrumb */}
          <div className="mx-auto max-w-6xl px-3 pt-6 sm:px-6">
            <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-4xl" data-testid="location-title">
              {locationTitle}
            </h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-sm">
              {stack.map((s, i) => (
                <span key={s.id} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-zinc-300">›</span>}
                  {i < stack.length - 1 ? (
                    <button type="button" onClick={() => goTo(i)} className="text-blue-600 hover:underline">
                      {s.name}
                    </button>
                  ) : (
                    <span className="font-semibold text-zinc-900">{s.name}</span>
                  )}
                </span>
              ))}
              {stack.length > 1 && (
                <button
                  type="button"
                  onClick={up}
                  className="ml-2 inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  <IconArrowUp /> Up a level
                </button>
              )}
            </div>
          </div>

          {/* controls */}
          <div className="mx-auto mt-5 flex max-w-5xl flex-col items-center gap-3 px-3 sm:px-6">
            <MvpMetricToggle metric={metric} setMetric={setMetric} />
            <MvpRangeBar range={range} setRange={setRange} entityId={entity.id} metric={metric} />
          </div>

          {/* root card */}
          <div className="mx-auto mt-5 max-w-5xl px-3 sm:px-6">
            {loaded?.error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load results — {loaded.error}</p>}
            {loading && <p className="text-center text-sm text-zinc-400">Loading your dashboard…</p>}
            {scores && emptyRoot && (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-lg font-semibold text-zinc-600" data-testid="empty-root">
                {EMPTY_ROOT_TEXT}
              </div>
            )}
            {scores && !emptyRoot && (
              <RepKpis
                root={scores.root}
                metricLabel={metricLabel}
                nounP={nounP}
                usingN={usingN}
                totalN={geoChildren.length}
                asOf={scores.as_of}
                range={range}
                showUsing={childType !== "student"}
              />
            )}
          </div>

          {/* map (every level except school) or the student table */}
          <div className="mx-auto mt-6 max-w-6xl px-3 sm:px-6">
            {entity.type !== "school" ? (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-sm">
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
                />
              </div>
            ) : (
              scores && <StudentTable students={students} metric={metric} onOpen={(s) => setModal({ kind: "student", student: s })} />
            )}
          </div>

          {scores && !emptyRoot && childType && childType !== "student" && (
            <>
              {/* detail card */}
              <section className="py-8 sm:py-10">
                <div className="mx-auto max-w-6xl px-3 sm:px-6">
                  <div className={"mb-5 " + H} style={{ color: ACCENT }}>
                    {nounS} Detail
                  </div>
                  <div
                    className={CARD + " cursor-pointer"}
                    title={`Double-click to open this ${nounS.toLowerCase()}`}
                    onDoubleClick={() => detailChild && drill(detailChild)}
                    onClick={() => detailChild && openChild(detailChild)}
                  >
                    <RepMeta child={detailChild} metricLabel={metricLabel} officer={officer} />
                  </div>
                </div>
              </section>

              {/* performance */}
              <section id="rep-perf" className="scroll-mt-16 bg-blue-50 py-8 sm:py-10">
                <div className="mx-auto max-w-6xl px-3 sm:px-6">
                  <div className={"mb-5 " + H} style={{ color: ACCENT }}>
                    {nounS} Performance
                  </div>
                  <div className={CARD + " space-y-6"}>
                    <div className="text-center text-base font-medium text-zinc-700">
                      <span className="text-xl font-extrabold tabular-nums text-red-600">
                        {Math.round(((geoChildren.length - usingN) / Math.max(1, geoChildren.length)) * 100)}%
                      </span>{" "}
                      of {nounP} in {entity.name} are not using Lifteracy at all
                      <span className="ml-1 text-zinc-400">
                        ({geoChildren.length - usingN} of {geoChildren.length})
                      </span>
                    </div>
                    <div>
                      <div className="mb-1 text-base font-semibold text-zinc-800">
                        Trend · {entity.name}
                        <HoverLabel child={hoverId ? geoChildren.find((c) => c.id === hoverId) ?? null : null} />
                      </div>
                      <RepTrend series={scores.series} label={`${metricLabel} pass rate`} />
                    </div>
                    <div className="border-t border-zinc-100 pt-5">
                      <div className="mb-1 text-base font-semibold text-zinc-800">Latest {metricLabel} — all {nounP}</div>
                      <RepLatest childrenRows={geoChildren} hoverId={hoverId} setHoverId={setHoverId} selId={selId} onSelect={select} onPick={drill} label={`${metricLabel} pass rate`} />
                    </div>
                    <div className="border-t border-zinc-100 pt-5">
                      <div className="mb-2 text-base font-semibold text-zinc-800">All {nounP}</div>
                      <ChildrenTable
                        rows={sortedChildren}
                        sort={sort}
                        onSort={toggleSort}
                        hoverId={hoverId}
                        setHoverId={setHoverId}
                        selId={selId}
                        onOpen={openChild}
                        onDrill={drill}
                        officer={officer}
                      />
                    </div>
                    <div className="border-t border-zinc-100 pt-5">
                      <div className="mb-1 text-base font-semibold text-zinc-800">Most improved · last {range} days</div>
                      <RepImproved mostImproved={scores.most_improved} hoverId={hoverId} setHoverId={setHoverId} selId={selId} onSelect={select} onPick={drill} />
                    </div>
                  </div>
                </div>
              </section>

              {/* spotlight */}
              <section id="rep-spotlight" className="scroll-mt-16 py-8 sm:py-10">
                <div className="mx-auto max-w-6xl px-3 sm:px-6">
                  <div className={"mb-5 " + H} style={{ color: ACCENT }}>
                    {officer} Spotlight
                  </div>
                  <div className={CARD}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <RepQuote kind="top" entry={spotlight?.top ?? null} nounS={nounS} officer={officer} />
                      <RepQuote kind="improved" entry={spotlight?.most_improved ?? null} nounS={nounS} officer={officer} />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* profile editor */}
      <section id="rep-profile" className="scroll-mt-16 bg-blue-50 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-3 sm:px-6">
          <div className={"mb-5 " + H} style={{ color: ACCENT }}>
            Your Profile
          </div>
          <div className={CARD}>
            <ProfileEditor profile={profile} onSaved={setProfile} />
          </div>
        </div>
      </section>

      <SiteFooter />

      {modal && <MvpTeacherModal subject={modal} metric={metric} onClose={closeModal} />}
      {reportOpen && reportData && <ReportCardModal data={reportData} onClose={closeReport} />}
    </div>
  );
}

const nextChildType = (t: GeoRef["type"]): ChildType =>
  t === "country" ? "state" : t === "state" ? "district" : t === "district" ? "block" : t === "block" ? "school" : "student";

// ------------------------------------------------------------------ pieces

function HeaderAvatar({ profile, initialSeed, avatarSvg }: { profile: PublicProfile; initialSeed: string | null; avatarSvg: string | null }) {
  const unchanged = profile.avatar_seed === initialSeed;
  if (unchanged && avatarSvg) {
    return (
      <div
        className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-white sm:h-24 sm:w-24 [&>svg]:h-full [&>svg]:w-full"
        style={{ boxShadow: `0 0 0 4px ${ACCENT}` }}
        data-testid="header-avatar"
        dangerouslySetInnerHTML={{ __html: avatarSvg }}
      />
    );
  }
  return (
    <div data-testid="header-avatar">
      <AvatarImg seed={seedFor(profile.avatar_seed, profile.id)} size={96} className="h-20 w-20 sm:h-24 sm:w-24" ring={ACCENT} />
    </div>
  );
}

function Breadcrumb({ ancestors }: { ancestors: Ancestor[] }) {
  if (!ancestors.length) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500" data-testid="ancestors">
      {ancestors.map((a, i) => (
        <span key={a.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300">›</span>}
          <span>{a.name}</span>
        </span>
      ))}
    </div>
  );
}

function HoverLabel({ child }: { child: Child | null }) {
  if (!child) return null;
  return (
    <span className="ml-2 text-[11px] font-normal text-zinc-500">
      · {child.name}
      {child.using_lifteracy ? ` — ${fmtPct(child.pass_rate)} (${fmtDelta(child.delta)})` : " — not using Lifteracy"}
    </span>
  );
}

function ChildrenTable({
  rows,
  sort,
  onSort,
  hoverId,
  setHoverId,
  selId,
  onOpen,
  onDrill,
  officer,
}: {
  rows: Child[];
  sort: { col: SortCol; dir: "asc" | "desc" };
  onSort: (c: SortCol) => void;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selId: string | null;
  onOpen: (c: Child) => void;
  onDrill: (c: Child) => void;
  officer: string;
}) {
  const th = (label: string, col?: SortCol) => (
    <th
      className={"whitespace-nowrap px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 " + (col ? "cursor-pointer select-none hover:text-zinc-800" : "")}
      onClick={col ? () => onSort(col) : undefined}
      aria-sort={col && sort.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {label}
      {col && sort.col === col ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
  if (!rows.length) return <p className="text-sm text-zinc-400">No rows yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full min-w-[520px] text-sm" data-testid="children-table">
        <thead className="bg-zinc-50">
          <tr>
            {th("Name")}
            {th(officer)}
            {th("Pass rate", "pass_rate")}
            {th("Δ", "delta")}
            {th("n", "n")}
            {th("Active")}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((c) => {
            const on = hoverId === c.id || selId === c.id;
            return (
              <tr
                key={c.id}
                className={"cursor-pointer " + (on ? "bg-blue-50" : "hover:bg-zinc-50")}
                onMouseEnter={() => setHoverId(c.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => onOpen(c)}
                onDoubleClick={() => onDrill(c)}
                title="Click for details · double-click to drill in"
              >
                <td className="px-2 py-2 font-medium text-zinc-900">{c.name}</td>
                <td className="px-2 py-2 text-zinc-600">{c.official?.name ?? <span className="text-zinc-400">—</span>}</td>
                <td className="whitespace-nowrap px-2 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.using_lifteracy ? binColor(c.bin) : UNCOVERED }} />
                    <span className="tabular-nums">{c.using_lifteracy ? fmtPct(c.pass_rate) : "not using"}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 tabular-nums" style={{ color: c.delta == null ? "#71717a" : c.delta >= 0.5 ? "#16a34a" : c.delta <= -0.5 ? "#dc2626" : "#71717a" }}>
                  {fmtDelta(c.delta)}
                </td>
                <td className="px-2 py-2 tabular-nums text-zinc-600">{c.n}</td>
                <td className="px-2 py-2 tabular-nums text-zinc-600">{c.students_active}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StudentTable({ students, metric, onOpen }: { students: StudentChild[]; metric: Metric; onOpen: (s: StudentChild) => void }) {
  if (!students.length) return <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-400">No students yet.</p>;
  const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—");
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full min-w-[520px] text-sm" data-testid="student-table">
        <thead className="bg-zinc-50">
          <tr>
            {["Student", METRIC_BY[metric].short, "Result", "Attempts", "In band", "Active", "Last active"].map((h) => (
              <th key={h} className="whitespace-nowrap px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {students.map((s) => {
            const pct = s.score == null ? null : s.score * 100;
            const col = pct == null ? UNCOVERED : pct >= 80 ? "rgb(34,197,94)" : pct >= 50 ? "rgb(234,179,8)" : "rgb(239,68,68)";
            return (
              <tr key={s.student_id} className="cursor-pointer hover:bg-zinc-50" onClick={() => onOpen(s)}>
                <td className="px-2 py-2 font-medium text-zinc-900">{s.label}</td>
                <td className="whitespace-nowrap px-2 py-2 font-bold tabular-nums" style={{ color: col }}>
                  {pct == null ? "—" : `${Math.round(pct)}%`}
                </td>
                <td className="px-2 py-2">{s.passed == null ? "—" : s.passed ? <span className="font-semibold text-emerald-600">passed</span> : <span className="font-semibold text-red-500">not yet</span>}</td>
                <td className="px-2 py-2 tabular-nums">{s.attempts}</td>
                <td className="px-2 py-2">{s.in_band ? "Yes" : "No"}</td>
                <td className="px-2 py-2">{s.active ? "Yes" : "No"}</td>
                <td className="whitespace-nowrap px-2 py-2 text-zinc-500">{fmtWhen(s.last_active_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ profile

const SPOTLIGHT_MAX = 300;
const NAME_MAX = 80;

function ProfileEditor({ profile, onSaved }: { profile: PublicProfile; onSaved: (p: PublicProfile) => void }) {
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
      setStatus({ ok: true, text: "Saved" });
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
        <AvatarImg seed={previewSeed} size={144} className="h-36 w-36" ring={ACCENT} />
        <button
          type="button"
          onClick={shuffle}
          disabled={busy}
          className="inline-flex w-full max-w-[12rem] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          <IconShuffle /> Shuffle avatar
        </button>
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
            Display name
          </label>
          <input id="pf-name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={inputCls} />
        </div>
        <div>
          <label htmlFor="pf-spot" className="mb-1 block text-xl font-extrabold tracking-tight" style={{ color: ACCENT }}>
            Spotlight message <span className="text-xs font-normal text-zinc-400">· shown when you&apos;re top or most-improved in your cohort</span>
          </label>
          <textarea id="pf-spot" value={spot} maxLength={SPOTLIGHT_MAX} onChange={(e) => setSpot(e.target.value.slice(0, SPOTLIGHT_MAX))} rows={3} className={inputCls + " resize-y"} />
          <div className={"mt-1 text-right text-xs tabular-nums " + (spot.length >= SPOTLIGHT_MAX ? "text-red-600" : "text-zinc-400")} data-testid="spotlight-counter">
            {spot.length}/{SPOTLIGHT_MAX}
          </div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Preview · top of your cohort</div>
          <div className="flex items-start gap-3">
            <AvatarImg seed={previewSeed} size={48} ring="#16a34a" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-zinc-900">{name || "Your name"}</div>
              <div className="text-[12px] italic text-zinc-700">“{spot || "Your spotlight message will appear here."}”</div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !hasChanges} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40">
            {busy ? "…" : "Save"}
          </button>
          {status && <span className={"text-sm " + (status.ok ? "text-emerald-700" : "text-red-600")}>{status.text}</span>}
        </div>
      </form>
    </div>
  );
}

function SiteFooter() {
  const SITE = "https://www.lifteracy.ai";
  const cols = [
    { h: "Lifteracy", links: [["About", SITE + "/#founders"], ["How it works", SITE + "/#video"], ["Contact", SITE + "/#traction-2"]] },
    {
      h: "Safety",
      links: [
        ["Child protection policy", "https://drive.google.com/file/d/1imqEMVpaPaERlr6RZrhtcYTf_cxe-sNV/view"],
        ["Privacy policy", "https://drive.google.com/file/d/1U1eMbmRu1NUZSAsXSJzFhMUkaZTsXVE/view?usp=drive_link"],
      ],
    },
  ];
  return (
    <section className="pb-10">
      <div className="mx-auto max-w-6xl px-3 sm:px-6">
        <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <Image src="/lifteracy-logo-only.svg" alt="Lifteracy" width={107} height={40} className="h-10 w-auto" />
              <div className="mt-2 text-[11px] text-zinc-500">Teaching every child to read, over WhatsApp.</div>
              <a href={SITE} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-semibold text-blue-600 hover:underline">
                www.lifteracy.ai
              </a>
            </div>
            {cols.map((col) => (
              <div key={col.h}>
                <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{col.h}</div>
                <div className="mt-2 space-y-1">
                  {col.links.map(([n, u]) => (
                    <a key={n} href={u} target="_blank" rel="noreferrer" className="block text-xs text-zinc-600 hover:text-blue-600">
                      {n}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
