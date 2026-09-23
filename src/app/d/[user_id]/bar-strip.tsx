"use client";

import { useState } from "react";
import type { T } from "./i18n";

// mvp2's BarGraph under the map: every child of the current level as one
// bar, ranked by value, coloured like its tile/marker, with a hover card
// (name, subtitle, value, rank). Hover shares the page's hoverId so the map
// marker, the trend line and the bar light up together; click selects (geo
// levels) or opens the student (class). No drag / send list here.
export type BarItem = {
  id: string;
  name: string;
  sub: string;
  value: number | null; // null = not using Lifteracy / unscored (grey stub)
  display: string; // formatted value for the hover card
  color: string;
};

export function BarStrip({
  items,
  max = 100,
  hoverId,
  setHoverId,
  selId = null,
  onClick,
  hint,
  t = (s) => s,
}: {
  items: BarItem[];
  max?: number; // axis top: 100 for percentages, minutes for usage in the class view
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selId?: string | null;
  onClick: (item: BarItem) => void;
  hint: string;
  t?: T;
}) {
  const [localHover, setLocalHover] = useState<string | null>(null);
  const bars = [...items].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const hovIdx = hoverId != null ? bars.findIndex((b) => b.id === hoverId) : -1;
  const hov = hovIdx >= 0 ? bars[hovIdx] : null;
  const showCard = hov && localHover === hov.id; // only for a hover that started on a bar
  const top = Math.max(1, max);
  return (
    <div
      className="relative select-none rounded-b-2xl border border-t-0 border-zinc-200 bg-white"
      style={{ height: 150 }}
      onMouseLeave={() => {
        setLocalHover(null);
        setHoverId(null);
      }}
      data-testid="bar-strip"
    >
      <div className="flex items-center justify-between px-3 py-1 text-[11px] text-zinc-500">
        <span>
          {bars.length} · {hint}
        </span>
        <span className="text-zinc-400">{t("hover a bar for details")}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-px px-2" style={{ top: 26 }}>
        {bars.map((b, i) => {
          const pct = b.value == null ? 0 : (Math.max(0, b.value) / top) * 100;
          const on = hoverId === b.id || selId === b.id;
          return (
            <div
              key={b.id}
              title={b.name}
              onMouseEnter={() => {
                setLocalHover(b.id);
                setHoverId(b.id);
              }}
              onClick={() => onClick(b)}
              className="min-w-0 flex-1 cursor-pointer rounded-t-sm"
              style={{
                height: `${Math.max(2, pct)}%`,
                background: b.value == null ? "#e5e7eb" : b.color,
                outline: selId === b.id ? "2px solid #2563eb" : "none",
                outlineOffset: "-1px",
                opacity: hoverId != null && !on ? 0.45 : 1,
              }}
              data-testid="bar"
              data-id={b.id}
              data-hot={on ? "1" : undefined}
            />
          );
        })}
      </div>
      {showCard && (
        <div
          className="pointer-events-none absolute z-10 w-48 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl"
          style={{ left: `max(96px, min(calc(100% - 96px), ${((hovIdx + 0.5) / bars.length) * 100}%))`, bottom: 132 }}
          data-testid="bar-card"
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-zinc-900">{hov.name}</div>
              {hov.sub && <div className="truncate text-[10px] text-zinc-500">{hov.sub}</div>}
            </div>
            <span className="ml-auto rounded px-1 py-0.5 text-[10px] font-bold text-white" style={{ background: hov.value == null ? "#9ca3af" : hov.color }}>
              {hov.display}
            </span>
          </div>
          <div className="mt-1.5 text-[10px] text-zinc-600">
            {t("Rank")} <b>#{hovIdx + 1}</b> {t("of")} {bars.length}
          </div>
        </div>
      )}
    </div>
  );
}
