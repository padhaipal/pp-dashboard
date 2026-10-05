"use client";

import { useState, useEffect, useRef } from "react";
import { useViewerId } from "../../d/[user_id]/viewer-context";
import { withViewer } from "../../d/[user_id]/viewer-url";
import { useIsMobile } from "../../d/[user_id]/use-is-mobile";

interface ScorePoint {
  score: number;
  created_at: string;
  letter_id: string;
  grapheme: string;
  is_seed: boolean;
  user_message_id: string | null;
}

interface LetterSeries {
  letter_id: string;
  grapheme: string;
  points: { x: number; score: number }[];
  initialScore: number | null;
  color: string;
  learnt: boolean;
}

interface LetterBinsResult {
  userId: string;
  userPhone: string;
  bins: {
    untouched: string[];
    regressed: string[];
    learnt: string[];
    improved: string[];
  };
}

const COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#22c55e", "#0ea5e9",
  "#d946ef", "#eab308", "#64748b", "#fb923c", "#2dd4bf",
];

// Letters not learnt yet are drawn at half saturation, so the learnt ones
// (full colour + ★) stand out.
export function desaturate(hex: string, keep = 0.5): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex;
  const sat = (d / (1 - Math.abs(2 * l - 1))) * keep;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const c = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const rgb = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return "#" + rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}

// `t` translates the few captions (the public /d student modal passes its
// dictionary; the admin /user/[id] page leaves them in English).
export function ScoreChart({ userId, t = (s) => s }: { userId: string; t?: (s: string) => string }) {
  const [series, setSeries] = useState<LetterSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  // Tapping / clicking a letter keeps it highlighted (touch has no hover).
  const [pinned, setPinned] = useState<string | null>(null);
  const hoveredLetter = hovered ?? pinned;
  const svgRef = useRef<SVGSVGElement>(null);
  // Phones get a narrower viewBox so the lines and axis text stay legible.
  const mobile = useIsMobile();
  // On the public /d page the viewer rides along (ViewerProvider); on the
  // staff page there is none and the URLs are unchanged.
  const viewerId = useViewerId();

  useEffect(() => {
    (async () => {
      const [scoresRes, learntRes] = await Promise.all([
        fetch(withViewer(`/api/proxy/users/${userId}/scores`, viewerId)),
        fetch(withViewer(`/api/proxy/scores/letter-bins?users=${userId}`, viewerId)),
      ]);
      if (!scoresRes.ok) {
        setLoading(false);
        return;
      }
      const data: ScorePoint[] = await scoresRes.json();
      if (data.length === 0) {
        setLoading(false);
        return;
      }

      let learntSet = new Set<string>();
      if (learntRes.ok) {
        const learntData: LetterBinsResult[] = await learntRes.json();
        learntSet = new Set(learntData[0]?.bins.learnt ?? []);
      }

      // Build global interaction order: each unique non-seed user_message_id
      // becomes one x-tick, in chronological order. Multiple letters scored
      // in the same interaction share the same x.
      const interactionIdx = new Map<string, number>();
      let nextIdx = 0;
      for (const d of data) {
        if (d.user_message_id !== null && !interactionIdx.has(d.user_message_id)) {
          interactionIdx.set(d.user_message_id, nextIdx++);
        }
      }

      // Old users were seeded in [-100, -93]; new users in [0, 7]. Apply +100
      // to old data so the chart's 0-baseline stays meaningful.
      const isLegacySeedUser = data.some(
        (d) => d.is_seed && d.score >= -100 && d.score <= -50,
      );
      const scoreOffset = isLegacySeedUser ? 100 : 0;

      // Group by letter_id, separating seed scores from interaction scores
      const grouped = new Map<string, {
        grapheme: string;
        seedScore: number | null;
        points: { x: number; score: number }[];
      }>();
      for (const d of data) {
        if (!grouped.has(d.letter_id)) {
          grouped.set(d.letter_id, { grapheme: d.grapheme, seedScore: null, points: [] });
        }
        const entry = grouped.get(d.letter_id)!;
        if (d.is_seed) {
          entry.seedScore = d.score + scoreOffset;
        } else {
          entry.points.push({
            x: interactionIdx.get(d.user_message_id!)!,
            score: d.score + scoreOffset,
          });
        }
      }

      const letterIds = Array.from(grouped.keys());
      const result: LetterSeries[] = letterIds
        .filter((lid) => grouped.get(lid)!.points.length >= 1)
        .map((lid, i) => {
          const learnt = learntSet.has(grouped.get(lid)!.grapheme);
          const base = COLORS[i % COLORS.length];
          return {
            letter_id: lid,
            grapheme: grouped.get(lid)!.grapheme,
            points: grouped.get(lid)!.points,
            initialScore: grouped.get(lid)!.seedScore,
            color: learnt ? base : desaturate(base),
            learnt,
          };
        });

      setSeries(result);
      setLoading(false);
    })();
  }, [userId, viewerId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6 flex items-center justify-center min-h-[340px]">
        <p className="text-zinc-400 text-sm text-center">{t("Loading scores...")}</p>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6">
        <p className="text-zinc-400 text-sm text-center">{t("No scores recorded")}</p>
      </div>
    );
  }

  const allScores = series.flatMap((s) => s.points.map((p) => p.score));
  const sMin = Math.min(0, ...allScores);
  const sMax = Math.max(0, ...allScores);
  const scorePad = Math.max(1, (sMax - sMin) * 0.1);

  const maxX = Math.max(
    0,
    ...series.flatMap((s) => s.points.map((p) => p.x)),
  );

  const W = mobile ? 440 : 900;
  const H = mobile ? 330 : 300;
  const PADDING = mobile ? { top: 20, right: 16, bottom: 16, left: 34 } : { top: 20, right: 20, bottom: 30, left: 50 };
  // viewBox units per screen px are larger on a phone: scale the type up.
  const fs = mobile ? 1.3 : 1;
  const plotW = W - PADDING.left - PADDING.right;
  const plotH = H - PADDING.top - PADDING.bottom;

  const sRange = sMax - sMin + scorePad * 2 || 1;
  const sLow = sMin - scorePad;

  const xByX = (x: number) =>
    PADDING.left + (maxX <= 0 ? plotW / 2 : (x / maxX) * plotW);
  const y = (s: number) => PADDING.top + plotH - ((s - sLow) / sRange) * plotH;

  const toPath = (pts: { x: number; score: number }[]) => {
    if (pts.length === 0) return "";
    const parts: string[] = [
      `M${xByX(pts[0].x).toFixed(1)},${y(pts[0].score).toFixed(1)}`,
    ];
    for (let i = 1; i < pts.length; i++) {
      parts.push(`H${xByX(pts[i].x).toFixed(1)}`);
      parts.push(`V${y(pts[i].score).toFixed(1)}`);
    }
    return parts.join(" ");
  };

  // Hover highlights with a mouse; a click / tap pins (and unpins) the letter.
  const hoverProps = (id: string) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setHovered(id);
    },
    onPointerLeave: () => setHovered(null),
    onClick: () => setPinned((cur) => (cur === id ? null : id)),
  });

  // Y-axis ticks (always include 0)
  const yTicks: number[] = [];
  const tickStep = Math.ceil(sRange / 5) || 1;
  for (let v = Math.floor(sLow); v <= sMax + scorePad; v += tickStep) {
    yTicks.push(v);
  }
  if (!yTicks.includes(0)) {
    yTicks.push(0);
    yTicks.sort((a, b) => a - b);
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-3 sm:p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3">
        <h2 className="text-sm font-medium text-zinc-500">{t("Letter Scores Over Time")}</h2>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="text-amber-400 text-sm leading-none">★</span>
          <span>{t("Letter learnt")}</span>
        </div>
      </div>
      <div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          style={{ maxHeight: mobile ? 360 : 300 }}
          data-testid="letter-chart"
        >
          {/* Y-axis grid + labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PADDING.left}
                y1={y(v)}
                x2={W - PADDING.right}
                y2={y(v)}
                stroke={v === 0 ? "#a1a1aa" : "#e4e4e7"}
                strokeWidth={v === 0 ? 1 : 0.5}
              />
              <text
                x={PADDING.left - 8}
                y={y(v) + 4}
                textAnchor="end"
                className={v === 0 ? "fill-zinc-600" : "fill-zinc-400"}
                fontSize={10 * fs}
                fontWeight={v === 0 ? 600 : 400}
              >
                {v}
              </text>
            </g>
          ))}

          {/* Lines (the seed is folded into the path as a leading flat segment) */}
          {series.map((s) => (
            <path
              key={s.letter_id}
              d={toPath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={hoveredLetter === s.letter_id ? 3 : mobile ? 1.2 : 1.5}
              opacity={
                hoveredLetter === null || hoveredLetter === s.letter_id
                  ? 1
                  : 0.15
              }
              {...hoverProps(s.letter_id)}
              style={{ cursor: "pointer" }}
            />
          ))}

          {/* Dots for each interaction point (no dot for the seed) */}
          {series.map((s) =>
            s.points.map((p, pi) => (
              <circle
                key={`dot-${s.letter_id}-${pi}`}
                cx={xByX(p.x)}
                cy={y(p.score)}
                r={hoveredLetter === s.letter_id ? 4 : mobile ? 1.8 : 2.5}
                fill={s.color}
                opacity={
                  hoveredLetter === null || hoveredLetter === s.letter_id
                    ? 1
                    : 0.15
                }
                {...hoverProps(s.letter_id)}
                style={{ cursor: "pointer" }}
              />
            ))
          )}

          {/* Star marker at end of each learnt letter's line */}
          {series.map((s) => {
            if (!s.learnt || s.points.length === 0) return null;
            const last = s.points[s.points.length - 1];
            return (
              <text
                key={`star-${s.letter_id}`}
                x={xByX(last.x)}
                y={y(last.score) - 6}
                textAnchor="middle"
                fontSize={12 * fs}
                fill={s.color}
                opacity={
                  hoveredLetter === null || hoveredLetter === s.letter_id
                    ? 1
                    : 0.15
                }
                {...hoverProps(s.letter_id)}
                style={{ cursor: "pointer" }}
              >
                ★
              </text>
            );
          })}

          {/* Wider invisible hit areas for easier hover */}
          {series.map((s) => (
            <path
              key={`hit-${s.letter_id}`}
              d={toPath(s.points)}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              {...hoverProps(s.letter_id)}
              style={{ cursor: "pointer" }}
            />
          ))}

          {/* Hovered grapheme label at end of line */}
          {hoveredLetter &&
            (() => {
              const s = series.find((s) => s.letter_id === hoveredLetter);
              if (!s) return null;
              const last = s.points[s.points.length - 1];
              // near the right edge the label goes to the left of the point
              const flip = xByX(last.x) > W - 40 * fs;
              return (
                <text
                  x={xByX(last.x) + (flip ? -8 : 6)}
                  y={y(last.score) + (flip ? -8 * fs : 4)}
                  textAnchor={flip ? "end" : "start"}
                  fontSize={14 * fs}
                  fontWeight="bold"
                  fill={s.color}
                  stroke="#ffffff"
                  strokeWidth={3}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {s.grapheme}
                </text>
              );
            })()}
        </svg>

        {/* Legend — under the chart, wrapping across its width */}
        <div className="flex flex-wrap gap-x-1 gap-y-1 pt-3 sm:gap-x-2" data-testid="letter-legend">
          {series.map((s) => (
            <div
              key={s.letter_id}
              className={"flex items-center gap-1.5 cursor-pointer rounded px-1.5 py-1 text-sm sm:py-0.5 sm:text-xs" + (pinned === s.letter_id ? " bg-zinc-100 ring-1 ring-zinc-300" : "")}
              {...hoverProps(s.letter_id)}
              style={{
                opacity:
                  hoveredLetter === null || hoveredLetter === s.letter_id
                    ? 1
                    : 0.3,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-zinc-600">{s.grapheme}</span>
              {s.learnt && (
                <span
                  className="text-amber-400 text-[11px] leading-none"
                  title="Learnt"
                >
                  ★
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
