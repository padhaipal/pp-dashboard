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
  // more lines for the hover card: [label, value]
  extra?: [string, string][];
};

// Children without any engagement are grey stubs; past this many they only
// pad the strip, so the rest are dropped (the count still says how many).
export const MAX_GREY = 10;

export function BarStrip({
  items,
  max = 100,
  hoverId,
  setHoverId,
  selId = null,
  onClick,
  onDoubleClick,
  ownId = null,
  t = (s) => s,
}: {
  items: BarItem[];
  max?: number; // axis top: 100 for percentages, minutes for usage in the class view
  hoverId: string | null;
  setHoverId: (id: string | null) => void;
  selId?: string | null;
  onClick: (item: BarItem) => void;
  // double-click: drill into the area (the class opens the student on click already)
  onDoubleClick?: (item: BarItem) => void;
  // the viewer's own area: blue outline + "You" tag above its bar
  ownId?: string | null;
  // (unused since 2026-10: the strip has no caption row)
  hint?: string;
  t?: T;
}) {
  const [localHover, setLocalHover] = useState<string | null>(null);
  // Ranked by value; at most MAX_GREY of the grey (no engagement) stubs.
  let grey = 0;
  // One item (a lone teacher / student) ranks against nothing: the strip
  // stays, empty, at its height so toggling metrics never makes the page jump.
  const bars = items.length <= 1 ? [] : [...items].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).filter((b) => b.value != null || grey++ < MAX_GREY);
  const hovIdx = hoverId != null ? bars.findIndex((b) => b.id === hoverId) : -1;
  const hov = hovIdx >= 0 ? bars[hovIdx] : null;
  const showCard = hov && localHover === hov.id; // only for a hover that started on a bar
  const top = Math.max(1, max);
  return (
    <div
      className="relative select-none rounded-t-2xl border border-b-0 border-zinc-200 bg-white"
      style={{ height: 150 }}
      onMouseLeave={() => {
        setLocalHover(null);
        setHoverId(null);
      }}
      data-testid="bar-strip"
    >
      <div className="pointer-events-none absolute inset-x-3 bottom-2 rounded-xl bg-zinc-50" style={{ top: 26 }} />
      <div className="absolute inset-x-0 bottom-2 flex items-end gap-1 px-3" style={{ top: 26 }}>
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
              onDoubleClick={() => onDoubleClick?.(b)}
              className="relative min-w-0 flex-1 cursor-pointer rounded-t-full transition-opacity"
              style={{
                height: `${Math.max(4, pct)}%`,
                // like the ranking rows: a soft gradient into the colour, rounded top
                background: b.value == null ? "#e4e4e7" : `linear-gradient(180deg, ${b.color}, ${b.color}99)`,
                boxShadow: ownId === b.id ? "0 0 0 2px #ffffff, 0 0 0 4px #3b82f6" : selId === b.id ? "0 0 0 2px #93c5fd" : "none",
                opacity: hoverId != null && !on ? 0.4 : 1,
              }}
              data-testid="bar"
              data-id={b.id}
              data-hot={on ? "1" : undefined}
              data-own={ownId === b.id ? "1" : undefined}
            >
              {ownId === b.id && (
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold leading-none tracking-wide text-white shadow-md ring-2 ring-white" data-testid="own-bar-tag">
                  {t("You")}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {showCard && (
        <div
          className="pointer-events-none absolute z-40 w-64 -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl"
          style={{ left: `max(128px, min(calc(100% - 128px), ${((hovIdx + 0.5) / bars.length) * 100}%))`, top: "100%", marginTop: 8 }}
          data-testid="bar-card"
        >
          <div className="flex items-start gap-2.5">
            <span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold " + (hovIdx === 0 ? "bg-amber-400 text-white" : "bg-zinc-200 text-zinc-700")}>{hovIdx + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-zinc-900">{hov.name}</div>
              {hov.sub && <div className="truncate text-[11px] text-zinc-500">{hov.sub}</div>}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="rounded-full px-2.5 py-1 text-sm font-extrabold text-white" style={{ background: hov.value == null ? "#9ca3af" : hov.color }}>
              {hov.display}
            </span>
            <span className="text-[11px] text-zinc-500">
              {t("Rank")} <b className="text-zinc-800">#{hovIdx + 1}</b> {t("of")} {bars.length}
            </span>
          </div>
          {!!hov.extra?.length && (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-zinc-100 pt-2 text-[11px]">
              {hov.extra.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-right font-semibold text-zinc-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
