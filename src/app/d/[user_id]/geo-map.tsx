"use client";

// d3 + SVG choropleth for the public dashboard (no tiles, no external hosts).
// Boundaries come from /public/boundaries/{type}/{code}.geojson, fetched on
// demand per drill level and cached for the page's lifetime.
//
// Level → what is drawn
//   country  : every child state polygon (state/{code}); incomplete states black
//   state    : state outline + child district polygons; districts without a
//              boundary file (has_boundary false) render as labels at lat/lng
//   district : district outline + one label per block at its lat/lng (no polygon)
//   block    : parent district outline + one dot per school at lat/lng; schools
//              with null coords sit at the block's point + deterministic jitter
//   school   : no map (the student table replaces it)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { T } from "./i18n";
import {
  childFill,
  INCOMPLETE_FILL,
  INCOMPLETE_TOOLTIP,
  UNCOVERED,
  fmtPct,
  type Child,
  type ChildType,
  type GeoRef,
} from "./dashboard-types";
import {
  bboxOf,
  boundaryUrl,
  exteriorRings,
  fitMercator,
  jitterLatLng,
  largestRing,
  pointsFeature,
  ringsToPath,
  stripClose,
  centroidOf,
  type Feature,
  type FeatureCollection,
} from "./map-helpers";

export type GeoMapProps = {
  entity: GeoRef;
  parentDistrict: GeoRef | null;
  childType: Exclude<ChildType, "student">;
  childrenRows: Child[];
  incompleteStates: Set<string>;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selectedId: string | null;
  onSelect: (c: Child) => void;
  onDrill: (c: Child) => void;
  metricLabel: string;
  t?: T;
};

const same: T = (s) => s;

type BoundaryCache = Map<string, Feature | null>;
const cache: BoundaryCache = new Map();
const inflight = new Map<string, Promise<Feature | null>>();

async function loadBoundary(url: string): Promise<Feature | null> {
  if (cache.has(url)) return cache.get(url) ?? null;
  const p = inflight.get(url);
  if (p) return p;
  const q = fetch(url)
    .then(async (r) => {
      if (!r.ok) return null;
      const fc = (await r.json()) as FeatureCollection | Feature;
      const f = fc.type === "FeatureCollection" ? (fc.features[0] ?? null) : fc;
      return f && f.geometry ? f : null;
    })
    .catch(() => null)
    .then((f) => {
      cache.set(url, f);
      inflight.delete(url);
      return f;
    });
  inflight.set(url, q);
  return q;
}

// "+" marker at an area's centroid (kept from mvp2): the area has no Lifteracy
// user yet. Greyscale, constant screen size, no border; the <title> is the hint.
export function PlusButton({ c, k, geo }: { c: [number, number] | null; k: number; geo: string }) {
  if (!c || isNaN(c[0])) return null;
  const r = 8.8 / k,
    sw = 1.8 / k,
    len = 4.4 / k;
  return (
    <g transform={`translate(${c[0]},${c[1]})`} pointerEvents="none" data-testid="plus-button">
      <title>This {geo} has no Lifteracy user yet</title>
      <circle r={r} fill="#71717a" />
      <line x1={-len} y1={0} x2={len} y2={0} stroke="#fff" strokeWidth={sw} strokeLinecap="round" />
      <line x1={0} y1={-len} x2={0} y2={len} stroke="#fff" strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
}

// Solid area fill: grey when the area has no Lifteracy user, otherwise the
// score colour. Interactions live on the outline path drawn on top.
export function areaFill(d: string, child: Child, incomplete: boolean) {
  if (!d) return null;
  return <path d={d} fill={incomplete ? INCOMPLETE_FILL : childFill(child)} fillOpacity={1} pointerEvents="none" />;
}

type Tip = { x: number; y: number; title: string; sub: string | null };

export function GeoMap(props: GeoMapProps) {
  const { entity, parentDistrict, childType, childrenRows, incompleteStates, hoverId, setHoverId, selectedId, onSelect, onDrill, metricLabel, t = same } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [geo, setGeo] = useState<{ key: string; outline: Feature | null; byCode: Map<string, Feature> } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [tf, setTf] = useState({ k: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const moved = useRef(false);

  // measure the wrapper (falls back to defaults where ResizeObserver is missing, e.g. jsdom)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(300, Math.round(r.width)), h: Math.max(280, Math.round(r.height)) });
    };
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- which boundary files this level needs ----
  const wants = useMemo(() => {
    const outline: string | null =
      childType === "district"
        ? boundaryUrl("state", entity.code)
        : childType === "block"
          ? boundaryUrl("district", entity.code)
          : childType === "school"
            ? parentDistrict
              ? boundaryUrl("district", parentDistrict.code)
              : null
            : entity.type === "country"
              ? boundaryUrl("country", entity.code)
              : null;
    const kids: { code: string; url: string }[] = [];
    if (childType === "state" || childType === "district") {
      for (const c of childrenRows) {
        if (!c.has_boundary) continue;
        if (childType === "state" && incompleteStates.has(c.code)) {
          kids.push({ code: c.code, url: boundaryUrl("state", c.code) });
          continue;
        }
        kids.push({ code: c.code, url: boundaryUrl(childType, c.code) });
      }
    }
    return { outline, kids, key: `${entity.id}|${childType}|${kids.map((k) => k.code).join(",")}` };
  }, [entity, parentDistrict, childType, childrenRows, incompleteStates]);

  useEffect(() => {
    let cancelled = false;
    const all = [wants.outline ? loadBoundary(wants.outline) : Promise.resolve(null), ...wants.kids.map((k) => loadBoundary(k.url))];
    Promise.all(all).then(([outline, ...kids]) => {
      if (cancelled) return;
      const byCode = new Map<string, Feature>();
      kids.forEach((f, i) => {
        if (f) byCode.set(wants.kids[i].code, f);
      });
      setGeo({ key: wants.key, outline, byCode });
      setTf({ k: 1, x: 0, y: 0 }); // new level → reset pan/zoom
    });
    return () => {
      cancelled = true;
    };
  }, [wants]);

  const ready = geo && geo.key === wants.key ? geo : null;

  // ---- points (blocks as labels, schools as dots) ----
  const points = useMemo(() => {
    const out: { child: Child; lat: number; lng: number; jittered: boolean }[] = [];
    if (childType === "block" || childType === "district") {
      for (const c of childrenRows) {
        if (childType === "district" && ready && ready.byCode.has(c.code)) continue;
        if (c.lat == null || c.lng == null) continue;
        out.push({ child: c, lat: c.lat, lng: c.lng, jittered: false });
      }
    } else if (childType === "school") {
      for (const c of childrenRows) {
        if (c.lat != null && c.lng != null) out.push({ child: c, lat: c.lat, lng: c.lng, jittered: false });
        else if (entity.lat != null && entity.lng != null) {
          const [lat, lng] = jitterLatLng(c.code, entity.lat, entity.lng);
          out.push({ child: c, lat, lng, jittered: true });
        }
      }
    }
    return out;
  }, [childType, childrenRows, entity, ready]);

  // ---- projection: fit the outline + child polygons, else the points ----
  const proj = useMemo(() => {
    const feats: Feature[] = [];
    if (ready) {
      if (ready.outline) feats.push(ready.outline);
      for (const f of ready.byCode.values()) feats.push(f);
    }
    if (!feats.length) {
      const pf = pointsFeature(points.map((p) => [p.lng, p.lat]));
      if (pf) feats.push(pf);
    }
    if (!feats.length) return null;
    return fitMercator(feats, size.w, size.h, 14);
  }, [ready, points, size]);

  const project = useCallback(
    (c: [number, number]) => {
      if (!proj) return null;
      const p = proj(c);
      return p ? ([p[0], p[1]] as [number, number]) : null;
    },
    [proj],
  );

  const areas = useMemo(() => {
    if (!ready || !proj) return [];
    return childrenRows
      .map((c) => {
        const f = ready.byCode.get(c.code);
        if (!f) return null;
        const rings = exteriorRings(f, project);
        const ring = stripClose(largestRing(f, project));
        if (!rings.length) return null;
        return { child: c, d: ringsToPath(rings), c: centroidOf(ring), bbox: bboxOf(ring), incomplete: childType === "state" && incompleteStates.has(c.code) };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
  }, [ready, proj, project, childrenRows, childType, incompleteStates]);

  const outlineD = useMemo(() => (ready && ready.outline && proj ? ringsToPath(exteriorRings(ready.outline, project)) : ""), [ready, proj, project]);

  const projected = useMemo(
    () =>
      points
        .map((p) => {
          const xy = project([p.lng, p.lat]);
          return xy ? { ...p, xy } : null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [points, project],
  );

  // ---- interactions ----
  const showTip = (e: React.MouseEvent, title: string, sub: string | null) => {
    const r = wrapRef.current?.getBoundingClientRect();
    setTip({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0), title, sub });
  };
  const hideTip = () => setTip(null);
  const tipFor = (c: Child, incomplete: boolean): [string, string | null] =>
    incomplete
      ? [c.name, INCOMPLETE_TOOLTIP]
      : [c.name, c.using_lifteracy ? `${fmtPct(c.pass_rate)} · n=${c.n}` : t("Not using Lifteracy")];

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, tx: tf.x, ty: tf.y };
    moved.current = false;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x,
      dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
    setTf((t) => ({ ...t, x: drag.current!.tx + dx, y: drag.current!.ty + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const k = tf.k;
  const noun = { state: "state", district: "district", block: "block", school: "school" }[childType];

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#eaf0f6]" data-testid="geo-map" data-level={entity.type}>
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">{t("Loading boundaries…")}</div>}
      <svg
        width={size.w}
        height={size.h}
        className="block select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: dragging ? "grabbing" : "default" }}
      >
        <g transform={`translate(${tf.x},${tf.y}) scale(${k})`} style={{ transition: dragging ? "none" : "transform .25s ease" }}>
          {outlineD && <path d={outlineD} fill="#ffffff" fillOpacity={0.6} stroke="#334155" strokeWidth={1.4 / k} pointerEvents="none" />}

          {areas.map((a) => {
            const on = hoverId === a.child.id || selectedId === a.child.id;
            const [t1, t2] = tipFor(a.child, a.incomplete);
            return (
              <g key={a.child.id}>
                {areaFill(a.d, a.child, a.incomplete)}
                <path
                  d={a.d}
                  fill="none"
                  pointerEvents="all"
                  data-code={a.child.code}
                  data-id={a.child.id}
                  data-incomplete={a.incomplete ? "true" : undefined}
                  stroke={on ? "#0f172a" : "#ffffff"}
                  strokeWidth={(on ? 1.6 : 0.6) / k}
                  style={{ cursor: a.incomplete ? "not-allowed" : "pointer" }}
                  onMouseEnter={(e) => {
                    setHoverId(a.child.id);
                    showTip(e, t1, t2);
                  }}
                  onMouseMove={(e) => showTip(e, t1, t2)}
                  onMouseLeave={() => {
                    setHoverId(null);
                    hideTip();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (moved.current || a.incomplete) return;
                    onSelect(a.child);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (a.incomplete) return;
                    onDrill(a.child);
                  }}
                />
                {!a.incomplete && !a.child.using_lifteracy && <PlusButton c={a.c} k={k} geo={noun} />}
              </g>
            );
          })}

          {/* labels (blocks; districts without a boundary file) */}
          {childType !== "school" &&
            projected.map((p) => {
              const on = hoverId === p.child.id || selectedId === p.child.id;
              const fs = 12 / k;
              const [t1, t2] = tipFor(p.child, false);
              return (
                <text
                  key={p.child.id}
                  x={p.xy[0]}
                  y={p.xy[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fs}
                  fontWeight="700"
                  fill={childFill(p.child)}
                  stroke={on ? "#0f172a" : "#ffffff"}
                  strokeWidth={fs / (on ? 10 : 8)}
                  paintOrder="stroke"
                  data-id={p.child.id}
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onMouseEnter={(e) => {
                    setHoverId(p.child.id);
                    showTip(e, t1, t2);
                  }}
                  onMouseLeave={() => {
                    setHoverId(null);
                    hideTip();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!moved.current) onSelect(p.child);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDrill(p.child);
                  }}
                >
                  {p.child.name}
                </text>
              );
            })}

          {/* schools as dots */}
          {childType === "school" &&
            projected.map((p) => {
              const on = hoverId === p.child.id || selectedId === p.child.id;
              const [t1, t2] = tipFor(p.child, false);
              return (
                <circle
                  key={p.child.id}
                  cx={p.xy[0]}
                  cy={p.xy[1]}
                  r={(on ? 9 : 6) / k}
                  fill={childFill(p.child)}
                  stroke={selectedId === p.child.id ? "#2563eb" : on ? "#0f172a" : "#ffffff"}
                  strokeWidth={(on ? 2 : 1.2) / k}
                  data-id={p.child.id}
                  data-jittered={p.jittered ? "true" : undefined}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    setHoverId(p.child.id);
                    showTip(e, t1, p.jittered ? `${t2 ?? ""} · approximate location` : t2);
                  }}
                  onMouseLeave={() => {
                    setHoverId(null);
                    hideTip();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!moved.current) onSelect(p.child);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDrill(p.child);
                  }}
                />
              );
            })}
        </g>
      </svg>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg bg-zinc-900/90 px-2 py-1.5 text-[11px] leading-snug text-white shadow-lg"
          style={{ left: Math.min(tip.x + 12, Math.max(0, size.w - 230)), top: Math.max(0, tip.y - 44) }}
        >
          <div className="font-semibold">{tip.title}</div>
          {tip.sub && <div>{tip.sub}</div>}
        </div>
      )}

      {/* small NIPUN dot legend (mvp2: bottom-left; the up-a-level button sits bottom-right, in the card) */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-zinc-200 bg-white/95 px-2.5 py-2 text-[10px] leading-tight text-zinc-600 shadow">
        <div className="mb-1 font-semibold text-zinc-700">
          {t("Latest")} {metricLabel}
        </div>
        {[
          ["≥80", "#16a34a"],
          ["50–79", "#f59e0b"],
          ["<50", "#dc2626"],
          [t("Not using Lifteracy"), UNCOVERED],
        ].map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            {l}
          </div>
        ))}
        {childType === "state" && incompleteStates.size > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: INCOMPLETE_FILL }} />
            {t("Boundaries pending")}
          </div>
        )}
      </div>
    </div>
  );
}
