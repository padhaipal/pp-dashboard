"use client";

// d3 + SVG choropleth for the public dashboard. Boundaries come from
// /public/boundaries/{type}/{code}.geojson, fetched on demand per drill level
// and cached for the page's lifetime. The district and block views sit on
// mvp2's CARTO Positron street underlay (the one external host).
//
// Level → what is drawn
//   country  : every child state polygon (state/{code}); incomplete states black
//   state    : state outline + child district polygons; districts without a
//              boundary file (has_boundary false) render as labels at lat/lng
//   district : tiles + district border + one label per block at its lat/lng
//   block    : tiles, NO border, one dot per school at lat/lng; schools with
//              null coords sit at the block's point + deterministic jitter
//   school   : no map (teacher cards, then student tiles, replace it)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { T } from "./i18n";
import {
  childFill,
  INCOMPLETE_FILL,
  INCOMPLETE_TOOLTIP,
  isPrivateSchool,
  UNCOVERED,
  fmtDuration,
  fmtPct,
  timeMarkLabels,
  type TimeWindow,
  windowFill,
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
  parentDistrict?: GeoRef | null; // no longer read: the block level draws no district border
  childType: Exclude<ChildType, "student" | "teacher">;
  childrenRows: Child[];
  incompleteStates: Set<string>;
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selectedId: string | null;
  onSelect: (c: Child) => void;
  onDrill: (c: Child) => void;
  // double-click on the map background (no area / marker) → up a level
  onUp?: () => void;
  // The viewer's own area among its peers: thick blue outline + "You" tag.
  ownId?: string | null;
  // Time mode: the window the colours are marked for (windowColor).
  timeWindow?: TimeWindow;
  // First visit: a callout pointing at the viewer's own area, asking them to
  // drill in; null hides it.
  drillHint?: string | null;
  onDismissHint?: () => void;
  metricLabel: string;
  // Time mode: areas / labels / dots are coloured by minutes per student per
  // day (green past 5, amber for some, red for none) and the tooltip shows
  // the active time, not a pass rate.
  time?: boolean;
  t?: T;
};

const same: T = (s) => s;

// mvp2's underlay provider: CARTO Positron without labels (swap freely).
// Since Aug 2026 CARTO watermarks keyless raster tiles "API KEY REQUIRED";
// NEXT_PUBLIC_CARTO_KEY (free key from carto.com/basemaps/apikey, inlined at
// build time) removes it. Attribution stays on the map — that is the deal.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY ?? "";
// 256 px tiles; on a HiDPI screen the 512 px "@2x" rendition so the underlay
// is not upscaled (it looked pixelated at 2×).
const hiDpi = () => typeof window !== "undefined" && (window.devicePixelRatio ?? 1) > 1.5;
const tileUrl = (z: number, x: number, y: number) =>
  `https://${"abc"[(x + y) % 3]}.basemaps.cartocdn.com/light_nolabels/${z}/${x}/${y}${hiDpi() ? "@2x" : ""}.png` + (CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : "");
// A tile is drawn at most this wide (its native 256 px, so never upscaled).
const MAX_TILE_PX = 256;

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

// Solid area fill: grey when the area has no Lifteracy user, otherwise the
// score colour. Interactions live on the outline path drawn on top.
export function areaFill(d: string, child: Child, incomplete: boolean, fill: (c: Child) => string = childFill) {
  if (!d) return null;
  return <path d={d} fill={incomplete ? INCOMPLETE_FILL : fill(child)} fillOpacity={1} pointerEvents="none" />;
}

type Tip = { x: number; y: number; title: string; sub: string | null };

export function GeoMap(props: GeoMapProps) {
  const { entity, childType, childrenRows, incompleteStates, hoverId, setHoverId, selectedId, onSelect, onDrill, onUp, ownId = null, timeWindow = "all", drillHint = null, onDismissHint, metricLabel, time = false, t = same } = props;
  const fillOf = time ? (c: Child) => windowFill(c, timeWindow) : childFill;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [geo, setGeo] = useState<{ key: string; outline: Feature | null; byCode: Map<string, Feature> } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  // A drill leaves the tooltip of the area that was double-clicked behind.
  useEffect(() => setTip(null), [entity.id]);
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
  // Block level (childType school) draws NO border — the schools sit straight
  // on the street underlay, as in mvp2.
  const wants = useMemo(() => {
    const outline: string | null =
      childType === "district"
        ? boundaryUrl("state", entity.code)
        : childType === "block"
          ? boundaryUrl("district", entity.code)
          : entity.type === "country"
            ? boundaryUrl("country", entity.code)
            : null;
    const kids: { code: string; url: string }[] = [];
    if (childType === "state" || childType === "district") {
      for (const c of childrenRows) {
        // Try the polygon file for EVERY child, not only `has_boundary` ones:
        // that flag is stamped at seed time from the boundaries manifest and
        // goes stale (a district seeded before its file shipped stays false,
        // and hierarchy rows carry no lat/lng to fall back on → the whole
        // state drilled into looked empty). A missing file is a cached null.
        if (childType === "state" && incompleteStates.has(c.code)) {
          kids.push({ code: c.code, url: boundaryUrl("state", c.code) });
          continue;
        }
        kids.push({ code: c.code, url: boundaryUrl(childType, c.code) });
      }
    }
    return { outline, kids, key: `${entity.id}|${childType}|${kids.map((k) => k.code).join(",")}` };
  }, [entity, childType, childrenRows, incompleteStates]);

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
        // private schools are not drawn (2026-10)
        if (isPrivateSchool(c)) continue;
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
      // fit to EVERY school of the block (2026-10: the user wants them all in view)
      const pf = pointsFeature(points.map((p) => [p.lng, p.lat]));
      if (pf) feats.push(pf);
    }
    if (!feats.length) return null;
    return fitMercator(feats, size.w, size.h, 14);
  }, [ready, points, size]);

  // ---- CARTO Positron underlay for the district (blocks) and block
  // (schools) views only — mvp2's slippy-tile math. The projection is plain
  // Mercator with a central-meridian rotation, so tiles project to
  // axis-aligned rects: each <image> is placed by projecting its NW/SE
  // corners. Zoom picked so one tile is ≤ MAX_TILE_PX (a tile drawn at 2× was visibly pixelated); padded 40 % for panning;
  // hard cap 120 tiles.
  const tiles = useMemo(() => {
    if (!proj || !proj.invert || (childType !== "block" && childType !== "school")) return null;
    const nwLL = proj.invert([0, 0]),
      seLL = proj.invert([size.w, size.h]);
    if (!nwLL || !seLL) return null;
    const P2 = (z: number) => 2 ** z;
    const lon2tx = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * P2(z));
    const lat2ty = (lat: number, z: number) => {
      const r = (lat * Math.PI) / 180;
      return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * P2(z));
    };
    const tx2lon = (x: number, z: number) => (x / P2(z)) * 360 - 180;
    const ty2lat = (y: number, z: number) => {
      const n = Math.PI - (2 * Math.PI * y) / P2(z);
      return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    };
    const cLon = (nwLL[0] + seLL[0]) / 2,
      cLat = (nwLL[1] + seLL[1]) / 2;
    let z = 6;
    for (; z < 15; z++) {
      const x = lon2tx(cLon, z),
        y = lat2ty(cLat, z);
      const a = proj([tx2lon(x, z), ty2lat(y, z)]),
        b = proj([tx2lon(x + 1, z), ty2lat(y + 1, z)]);
      if (a && b && Math.abs(b[0] - a[0]) <= MAX_TILE_PX) break;
    }
    const padLon = Math.abs(seLL[0] - nwLL[0]) * 0.4,
      padLat = Math.abs(nwLL[1] - seLL[1]) * 0.4;
    const x0 = lon2tx(Math.min(nwLL[0], seLL[0]) - padLon, z),
      x1 = lon2tx(Math.max(nwLL[0], seLL[0]) + padLon, z);
    const y0 = lat2ty(Math.min(89, Math.max(nwLL[1], seLL[1]) + padLat), z),
      y1 = lat2ty(Math.max(-89, Math.min(nwLL[1], seLL[1]) - padLat), z);
    const maxIdx = P2(z) - 1;
    const out: { key: string; href: string; x: number; y: number; w: number; h: number }[] = [];
    for (let x = Math.max(0, x0); x <= Math.min(maxIdx, x1); x++) {
      for (let y = Math.max(0, y0); y <= Math.min(maxIdx, y1); y++) {
        const nw = proj([tx2lon(x, z), ty2lat(y, z)]),
          se = proj([tx2lon(x + 1, z), ty2lat(y + 1, z)]);
        if (!nw || !se) continue;
        out.push({ key: `${z}/${x}/${y}`, href: tileUrl(z, x, y), x: nw[0], y: nw[1], w: se[0] - nw[0], h: se[1] - nw[1] });
        if (out.length >= 120) return out;
      }
    }
    return out.length ? out : null;
  }, [proj, childType, size]);

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

  // Where the viewer's own child sits (an area's centre, or its label / dot).
  const ownXYOf = (areasNow: { child: Child; c: [number, number] }[], pts: { child: Child; xy: [number, number] }[]): [number, number] | null =>
    ownId ? (areasNow.find((a) => a.child.id === ownId)?.c ?? pts.find((p) => p.child.id === ownId)?.xy ?? null) : null;
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

  const ownXY = ownXYOf(areas, projected);
  // the viewer's own label's box (district → blocks drawn as labels): others must not cover it
  const ownLabelPt = childType !== "school" ? projected.find((p) => p.child.id === ownId) : undefined;
  const ownLabelBox = ownLabelPt ? labelBox(ownLabelPt.child.name, ownLabelPt.xy, 12 / tf.k) : null;

  // ---- interactions ----
  const showTip = (e: React.MouseEvent, title: string, sub: string | null) => {
    const r = wrapRef.current?.getBoundingClientRect();
    setTip({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0), title, sub });
  };
  const hideTip = () => setTip(null);
  const tipFor = (c: Child, incomplete: boolean): [string, string | null] =>
    incomplete
      ? [c.name, INCOMPLETE_TOOLTIP]
      : [
          c.name,
          (c.using_lifteracy
            ? time
              ? `${fmtDuration(c.time_sum, t)} · n=${c.n}`
              : `${fmtPct(c.pass_rate)} · n=${c.n}`
            : t("Not using Lifteracy")) + (isPrivateSchool(c) ? ` · ${t("private school")}` : ""),
        ];

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
    // Read the ref here, not inside the updater: React applies continuous
    // (pointermove) updates after discrete ones (pointerup/leave), by which
    // time onPointerUp has nulled drag.current.
    const nx = drag.current.tx + dx,
      ny = drag.current.ty + dy;
    setTf((t) => ({ ...t, x: nx, y: ny }));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };
  // +/− zoom around the viewport centre (every map level); a drill resets it.
  const zoomBy = (factor: number) =>
    setTf((t) => {
      const k = Math.min(40, Math.max(0.5, t.k * factor));
      const s = k / t.k;
      const cx = size.w / 2,
        cy = size.h / 2;
      return { k, x: cx - (cx - t.x) * s, y: cy - (cy - t.y) * s };
    });
  const k = tf.k;

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
        onDoubleClick={() => onUp?.()}
        style={{ cursor: dragging ? "grabbing" : "default" }}
        data-testid="map-svg"
      >
        <defs>
          <filter id="own-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#1e3a8a" floodOpacity="0.35" />
          </filter>
        </defs>
        <g transform={`translate(${tf.x},${tf.y}) scale(${k})`} style={{ transition: dragging ? "none" : "transform .25s ease" }}>
          {/* street/landmark underlay (district + block views only) */}
          {tiles && (
            <g pointerEvents="none" data-testid="tile-underlay">
              {tiles.map((tl) => (
                <image key={tl.key} href={tl.href} x={tl.x} y={tl.y} width={tl.w} height={tl.h} preserveAspectRatio="none" />
              ))}
            </g>
          )}
          {/* the district border sits over the underlay at district level; none at block level */}
          {outlineD && <path d={outlineD} fill={tiles ? "none" : "#ffffff"} fillOpacity={0.6} stroke="#334155" strokeWidth={1.4 / k} pointerEvents="none" />}

          {areas.map((a) => {
            const own = ownId === a.child.id;
            const on = hoverId === a.child.id || selectedId === a.child.id;
            const [t1, t2] = tipFor(a.child, a.incomplete);
            return (
              <g key={a.child.id}>
                {areaFill(a.d, a.child, a.incomplete, fillOf)}
                {/* own area: a soft blue halo under a crisp outline */}
                {own && <path d={a.d} fill="none" stroke="#60a5fa" strokeOpacity={0.5} strokeWidth={7 / k} strokeLinejoin="round" pointerEvents="none" data-testid="own-halo" />}
                <path
                  d={a.d}
                  fill="none"
                  pointerEvents="all"
                  data-code={a.child.code}
                  data-id={a.child.id}
                  data-incomplete={a.incomplete ? "true" : undefined}
                  stroke={own ? "#1d4ed8" : on ? "#0f172a" : "#ffffff"}
                  strokeWidth={(own ? 2 : on ? 1.6 : 0.6) / k}
                  strokeLinejoin="round"
                  data-own={own ? "1" : undefined}
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
              </g>
            );
          })}

          {/* the viewer's own area / label: a blue "You" tag above it */}
          {ownXY && (
            <g pointerEvents="none" data-testid="own-tag" filter="url(#own-shadow)">
              <rect x={ownXY[0] - 20 / k} y={ownXY[1] - 36 / k} width={40 / k} height={18 / k} rx={9 / k} fill="#2563eb" stroke="#ffffff" strokeWidth={1.5 / k} />
              <path d={`M${ownXY[0] - 5 / k} ${ownXY[1] - 18.6 / k} L${ownXY[0]} ${ownXY[1] - 13 / k} L${ownXY[0] + 5 / k} ${ownXY[1] - 18.6 / k} Z`} fill="#2563eb" />
              <text x={ownXY[0]} y={ownXY[1] - 23.5 / k} textAnchor="middle" fontSize={10 / k} fontWeight="800" letterSpacing={0.4 / k} fill="#ffffff">
                {t("You")}
              </text>
            </g>
          )}
          {/* labels (blocks; districts without a boundary file) */}
          {childType !== "school" &&
            [...projected]
              // the viewer's own label last, i.e. on top
              .sort((a, b) => Number(a.child.id === ownId) - Number(b.child.id === ownId))
              .map((p) => {
              const on = hoverId === p.child.id || selectedId === p.child.id;
              const fs = 12 / k;
              const [t1, t2] = tipFor(p.child, false);
              const isOwn = p.child.id === ownId;
              // a label that would sit on the viewer's own is not drawn (hover still finds it in the bars)
              if (!isOwn && !on && ownLabelBox && boxesOverlap(labelBox(p.child.name, p.xy, fs), ownLabelBox)) return null;
              const box = labelBox(p.child.name, p.xy, fs);
              return (
                <g key={p.child.id}>
                {isOwn && <rect x={box[0]} y={box[1]} width={box[2] - box[0]} height={box[3] - box[1]} rx={(box[3] - box[1]) / 2} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5 / k} filter="url(#own-shadow)" pointerEvents="none" data-testid="own-label-pill" />}
                <text
                  key={p.child.id}
                  x={p.xy[0]}
                  y={p.xy[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fs}
                  fontWeight="700"
                  fill={fillOf(p.child)}
                  stroke={isOwn ? "none" : on ? "#0f172a" : "#ffffff"}
                  strokeWidth={fs / (on ? 10 : 8)}
                  data-own={isOwn ? "1" : undefined}
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
                </g>
              );
            })}

          {/* schools as dots — SVG paints in order, so grey (no Lifteracy
              user / no score) dots go first and coloured ones sit on top */}
          {childType === "school" &&
            [...projected]
              .sort((a, b) => Number(fillOf(a.child) !== UNCOVERED) - Number(fillOf(b.child) !== UNCOVERED))
              .map((p) => {
              const on = hoverId === p.child.id || selectedId === p.child.id;
              const [t1, t2] = tipFor(p.child, false);
              const r = (on ? 9 : 6) / k;
              // same colour scale for every school; private schools get a
              // diamond instead of a dot (subtle — the legend explains it)
              const common = {
                fill: fillOf(p.child),
                stroke: selectedId === p.child.id ? "#2563eb" : on ? "#0f172a" : "#ffffff",
                strokeWidth: (on ? 2 : 1.2) / k,
                "data-id": p.child.id,
                "data-jittered": p.jittered ? "true" : undefined,
                "data-management": p.child.management_group ?? undefined,
                style: { cursor: "pointer" } as const,
                onMouseEnter: (e: React.MouseEvent) => {
                  setHoverId(p.child.id);
                  showTip(e, t1, p.jittered ? `${t2 ?? ""} · approximate location` : t2);
                },
                onMouseLeave: () => {
                  setHoverId(null);
                  hideTip();
                },
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!moved.current) onSelect(p.child);
                },
                onDoubleClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onDrill(p.child);
                },
              };
              return isPrivateSchool(p.child) ? (
                <rect
                  key={p.child.id}
                  x={p.xy[0] - r}
                  y={p.xy[1] - r}
                  width={2 * r}
                  height={2 * r}
                  rx={r / 4}
                  transform={`rotate(45 ${p.xy[0]} ${p.xy[1]})`}
                  {...common}
                />
              ) : (
                <circle key={p.child.id} cx={p.xy[0]} cy={p.xy[1]} r={r} {...common} />
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

      {drillHint && ownXY && (
        <DrillHint x={tf.x + ownXY[0] * k} y={tf.y + ownXY[1] * k - 30} text={drillHint} onDismiss={onDismissHint} t={t} />
      )}
      {/* zoom — top-right, clear of the legend (bottom-left) and the up button (bottom-right) */}
      <div className="absolute right-2 top-2 z-20 flex flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-md" data-testid="map-zoom">
        <button type="button" onClick={() => zoomBy(1.4)} className="h-8 w-8 text-base font-bold text-zinc-700 hover:bg-zinc-100" aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.4)} className="h-8 w-8 border-t border-zinc-200 text-base font-bold text-zinc-700 hover:bg-zinc-100" aria-label="Zoom out">
          −
        </button>
      </div>

      {tiles && (
        <div className="pointer-events-none absolute bottom-1 right-14 z-20 rounded bg-white/80 px-1.5 py-0.5 text-[9px] text-zinc-500">© OpenStreetMap contributors © CARTO</div>
      )}

      {/* small NIPUN dot legend (mvp2: bottom-left; the up-a-level button sits bottom-right, in the card) */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-zinc-200 bg-white/95 px-2.5 py-2 text-[10px] leading-tight text-zinc-600 shadow">
        <div className="mb-1 font-semibold text-zinc-700">{time ? `${metricLabel} · ${t("per student")}` : `${t("Latest")} ${metricLabel}`}</div>
        {(time
          ? [
              [timeMarkLabels(timeWindow, t)[0], "#16a34a"],
              [timeMarkLabels(timeWindow, t)[1], "#f59e0b"],
              [timeMarkLabels(timeWindow, t)[2], "#dc2626"],
              [t("Not using Lifteracy"), UNCOVERED],
            ]
          : [
              ["≥80", "#16a34a"],
              ["50–79", "#f59e0b"],
              ["<50", "#dc2626"],
              [t("Not using Lifteracy"), UNCOVERED],
            ]
        ).map(([l, c]) => (
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
        {/* block level: marker shape = management (colour stays the score) */}
      </div>
    </div>
  );
}

// A dismissible callout with an arrow pointing down at (x, y): used on the
// map (the viewer's own area) and over the viewer's own teacher card.
export function DrillHint({ x, y, text, onDismiss, t = same }: { x: number | string; y: number | string; text: string; onDismiss?: () => void; t?: T }) {
  return (
    <div className="absolute z-30 w-60 -translate-x-1/2 -translate-y-full" style={{ left: x, top: y }} data-testid="drill-hint" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <div className="relative rounded-2xl bg-blue-600 p-3 pr-8 text-[13px] font-semibold leading-snug text-white shadow-xl ring-4 ring-blue-600/20">
        {text}
        <button type="button" aria-label={t("Dismiss")} className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs hover:bg-white/30" onClick={() => onDismiss?.()} data-testid="drill-hint-dismiss">
          ✕
        </button>
        <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-blue-600" />
      </div>
      <div className="mx-auto mt-1 h-6 w-0.5 animate-pulse bg-blue-600" />
    </div>
  );
}

// A text label's box (x0, y0, x1, y1) around its centre, from a rough glyph
// width; padded so a neighbour's label never touches it.
export function labelBox(name: string, xy: [number, number], fs: number): [number, number, number, number] {
  const w = name.length * fs * 0.62 + fs * 1.2,
    h = fs * 1.7;
  return [xy[0] - w / 2, xy[1] - h / 2, xy[0] + w / 2, xy[1] + h / 2];
}
export const boxesOverlap = (a: [number, number, number, number], b: [number, number, number, number]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
