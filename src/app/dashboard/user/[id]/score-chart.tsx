"use client";

import { useState, useEffect, useRef } from "react";

interface ScorePoint {
  score: number;
  created_at: string;
  letter_id: string;
  grapheme: string;
  is_seed: boolean;
}

interface LetterSeries {
  letter_id: string;
  grapheme: string;
  points: { t: number; score: number }[];
  initialScore: number | null;
  color: string;
  learnt: boolean;
}

interface LettersLearntResult {
  userId: string;
  userPhone: string;
  lettersLearnt: string[];
}

const COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#22c55e", "#0ea5e9",
  "#d946ef", "#eab308", "#64748b", "#fb923c", "#2dd4bf",
];

const PADDING = { top: 20, right: 20, bottom: 30, left: 50 };

export function ScoreChart({ userId }: { userId: string }) {
  const [series, setSeries] = useState<LetterSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredLetter, setHoveredLetter] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    (async () => {
      const [scoresRes, learntRes] = await Promise.all([
        fetch(`/api/proxy/users/${userId}/scores`),
        fetch(`/api/proxy/scores/letters-learnt?users=${userId}`),
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
        const learntData: LettersLearntResult[] = await learntRes.json();
        learntSet = new Set(learntData[0]?.lettersLearnt ?? []);
      }

      // Group by letter_id, separating seed scores from real scores
      const grouped = new Map<string, {
        grapheme: string;
        seedScore: number | null;
        points: { t: number; score: number }[];
      }>();
      for (const d of data) {
        if (!grouped.has(d.letter_id)) {
          grouped.set(d.letter_id, { grapheme: d.grapheme, seedScore: null, points: [] });
        }
        const entry = grouped.get(d.letter_id)!;
        if (d.is_seed) {
          entry.seedScore = d.score;
        } else {
          entry.points.push({
            t: new Date(d.created_at).getTime(),
            score: d.score,
          });
        }
      }

      const letterIds = Array.from(grouped.keys());
      const result: LetterSeries[] = letterIds
        .filter((lid) => grouped.get(lid)!.points.length >= 1)
        .map((lid, i) => ({
          letter_id: lid,
          grapheme: grouped.get(lid)!.grapheme,
          points: grouped.get(lid)!.points,
          initialScore: grouped.get(lid)!.seedScore,
          color: COLORS[i % COLORS.length],
          learnt: learntSet.has(grouped.get(lid)!.grapheme),
        }));

      setSeries(result);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6">
        <p className="text-zinc-400 text-sm text-center">Loading scores...</p>
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6">
        <p className="text-zinc-400 text-sm text-center">No scores recorded</p>
      </div>
    );
  }

  const allScores = series.flatMap((s) => {
    const scores = s.points.map((p) => p.score);
    if (s.initialScore !== null) scores.push(s.initialScore);
    return scores;
  });
  const sMin = Math.min(0, ...allScores);
  const sMax = Math.max(0, ...allScores);
  const scorePad = Math.max(1, (sMax - sMin) * 0.1);

  const maxLen = Math.max(...series.map((s) => s.points.length));

  const W = 900;
  const H = 300;
  const plotW = W - PADDING.left - PADDING.right;
  const plotH = H - PADDING.top - PADDING.bottom;

  const sRange = sMax - sMin + scorePad * 2 || 1;
  const sLow = sMin - scorePad;

  const xByIndex = (i: number) =>
    PADDING.left + (maxLen <= 1 ? plotW / 2 : (i / (maxLen - 1)) * plotW);
  const y = (s: number) => PADDING.top + plotH - ((s - sLow) / sRange) * plotH;

  const toPath = (pts: { t: number; score: number }[]) => {
    const parts: string[] = [];
    for (let i = 0; i < pts.length; i++) {
      const px = xByIndex(i).toFixed(1);
      const py = y(pts[i].score).toFixed(1);
      if (i === 0) {
        parts.push(`M${px},${py}`);
      } else {
        parts.push(`H${px}`);
        parts.push(`V${py}`);
      }
    }
    return parts.join(" ");
  };

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
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-zinc-500">Letter Scores Over Time</h2>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="text-amber-400 text-sm leading-none">★</span>
          <span>Letter learnt</span>
        </div>
      </div>
      <div className="flex gap-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          style={{ maxHeight: 300 }}
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
                fontSize={10}
                fontWeight={v === 0 ? 600 : 400}
              >
                {v}
              </text>
            </g>
          ))}

          {/* Vertical lines from first point to initial (seed) score */}
          {series.map((s) => {
            if (s.initialScore === null) return null;
            const firstPt = s.points[0];
            if (firstPt.score === s.initialScore) return null;
            return (
              <line
                key={`seed-${s.letter_id}`}
                x1={xByIndex(0)}
                y1={y(firstPt.score)}
                x2={xByIndex(0)}
                y2={y(s.initialScore)}
                stroke={s.color}
                strokeWidth={hoveredLetter === s.letter_id ? 2.5 : 1.5}
                strokeDasharray="3,3"
                opacity={
                  hoveredLetter === null || hoveredLetter === s.letter_id
                    ? 0.6
                    : 0.1
                }
                onMouseEnter={() => setHoveredLetter(s.letter_id)}
                onMouseLeave={() => setHoveredLetter(null)}
                style={{ cursor: "pointer" }}
              />
            );
          })}

          {/* Lines */}
          {series.map((s) => (
            <path
              key={s.letter_id}
              d={toPath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={hoveredLetter === s.letter_id ? 3 : 1.5}
              opacity={
                hoveredLetter === null || hoveredLetter === s.letter_id
                  ? 1
                  : 0.15
              }
              onMouseEnter={() => setHoveredLetter(s.letter_id)}
              onMouseLeave={() => setHoveredLetter(null)}
              style={{ cursor: "pointer" }}
            />
          ))}

          {/* Dots for each data point */}
          {series.map((s) =>
            s.points.map((p, pi) => (
              <circle
                key={`dot-${s.letter_id}-${pi}`}
                cx={xByIndex(pi)}
                cy={y(p.score)}
                r={hoveredLetter === s.letter_id ? 4 : 2.5}
                fill={s.color}
                opacity={
                  hoveredLetter === null || hoveredLetter === s.letter_id
                    ? 1
                    : 0.15
                }
                onMouseEnter={() => setHoveredLetter(s.letter_id)}
                onMouseLeave={() => setHoveredLetter(null)}
                style={{ cursor: "pointer" }}
              />
            ))
          )}

          {/* Star marker at end of each learnt letter's line */}
          {series.map((s) => {
            if (!s.learnt || s.points.length === 0) return null;
            const lastIdx = s.points.length - 1;
            const last = s.points[lastIdx];
            return (
              <text
                key={`star-${s.letter_id}`}
                x={xByIndex(lastIdx)}
                y={y(last.score) - 6}
                textAnchor="middle"
                fontSize={12}
                fill={s.color}
                opacity={
                  hoveredLetter === null || hoveredLetter === s.letter_id
                    ? 1
                    : 0.15
                }
                onMouseEnter={() => setHoveredLetter(s.letter_id)}
                onMouseLeave={() => setHoveredLetter(null)}
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
              onMouseEnter={() => setHoveredLetter(s.letter_id)}
              onMouseLeave={() => setHoveredLetter(null)}
              style={{ cursor: "pointer" }}
            />
          ))}

          {/* Hovered grapheme label at end of line */}
          {hoveredLetter &&
            (() => {
              const s = series.find((s) => s.letter_id === hoveredLetter);
              if (!s) return null;
              const last = s.points[s.points.length - 1];
              const lastIdx = s.points.length - 1;
              return (
                <text
                  x={xByIndex(lastIdx) + 6}
                  y={y(last.score) + 4}
                  fontSize={14}
                  fontWeight="bold"
                  fill={s.color}
                >
                  {s.grapheme}
                </text>
              );
            })()}
        </svg>

        {/* Legend */}
        <div className="flex flex-col gap-1 min-w-[60px] pt-1 overflow-y-auto max-h-[280px]">
          {series.map((s) => (
            <div
              key={s.letter_id}
              className="flex items-center gap-1.5 cursor-pointer text-xs"
              onMouseEnter={() => setHoveredLetter(s.letter_id)}
              onMouseLeave={() => setHoveredLetter(null)}
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
