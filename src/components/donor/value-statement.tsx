"use client";

// The donor page's headline value proposition (ported from
// sandbox-global-map/donor.html ValueStatement): a rotating subject / verb
// with an odometer roll, a drag-to-scrub subject and a hand-scribbled "counterfactually" note (Caveat; hover, or tap on
// touch screens); a row of dots under it shows and picks the variation; then
// the MPL-B claim. The cost-effectiveness figures are CostEffectiveness.

import { Caveat } from "next/font/google";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

const caveat = Caveat({ subsets: ["latin"], weight: ["500", "600", "700"] });


const VARIATIONS = [
  { subject: "$200T of economic value", verb: "unlocked" },
  { subject: "$21 trillion additional tax revenue", verb: "unlocked" },
  { subject: "46 million more people employed", verb: "unlocked" },
  { subject: "368 million more primary school completions", verb: "unlocked" },
  { subject: "368 million more secondary school starts", verb: "unlocked" },
  { subject: "12 million child deaths", verb: "averted" },
  { subject: "12 million child marriages", verb: "averted" },
];

// vertical pixels per value step while scrubbing
const STEP_PY = 46;

export function ValueStatement() {
  const scribble = caveat.className;
  const [vIdx, setVIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setVIdx((i) => (i + 1) % VARIATIONS.length), 5200);
    return () => clearTimeout(id);
  }, [vIdx, paused]);
  const v = VARIATIONS[vIdx];
  // keyed fragments remount on change, replaying the roll once
  const rollStyle: CSSProperties = { display: "inline-block", transformOrigin: "center", animation: "ppRoll 780ms cubic-bezier(.2,.8,.25,1) both" };
  const stage: CSSProperties = { perspective: "520px" };

  const drag = useRef<{ y0: number; idx0: number; last: number } | null>(null);
  const onDragStart = (e: PointerEvent<HTMLSpanElement>) => {
    if ((e.target as HTMLElement).closest("a")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y0: e.clientY, idx0: vIdx, last: vIdx };
    setPaused(true);
  };
  const onDragMove = (e: PointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    const n = VARIATIONS.length;
    const ni = (((d.idx0 + Math.round((e.clientY - d.y0) / STEP_PY)) % n) + n) % n;
    if (ni !== d.last) {
      d.last = ni;
      setVIdx(ni);
    }
  };
  const onDragEnd = (e: PointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setPaused(false);
  };

  return (
    <div className="mx-auto max-w-5xl text-center">
      <style>{"@keyframes ppRoll{from{transform:rotateX(90deg) translateY(.5em);opacity:0}to{transform:rotateX(0) translateY(0);opacity:1}}"}</style>
      <h1 className="pt-10 text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
        <span
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          title="Drag up or down to explore other ways to measure the opportunity"
          className="relative inline cursor-ns-resize select-none"
          style={{ ...stage, touchAction: "none" }}
        >
          <span key={vIdx} className="font-extrabold text-brand-ink" style={rollStyle}>
            {v.subject}
          </span>
        </span>{" "}
        would be{" "}
        <button
          type="button"
          onClick={() => setNote((n) => !n)}
          aria-expanded={note}
          className="group relative inline-block font-bold text-accent"
          style={stage}
        >
          <span className={"absolute bottom-full left-0 w-max -translate-x-1/2 whitespace-nowrap pb-2 text-2xl font-semibold leading-none text-accent group-hover:block " + (note ? "block " : "hidden ") + scribble}>counterfactually</span>
          <span className={"pointer-events-none absolute bottom-full left-0 -translate-x-1/2 text-base leading-none text-accent group-hover:block " + (note ? "block" : "hidden")}>‸</span>
          <span key={v.verb} style={rollStyle}>
            {v.verb}
          </span>
        </button>
        <br />
        by 2050 if every child could read.
      </h1>
      <div className="mt-5 flex justify-center gap-1" role="group" aria-label="Other ways to measure the opportunity">
        {VARIATIONS.map((x, i) => (
          <button
            key={x.subject}
            type="button"
            onClick={() => setVIdx(i)}
            aria-label={x.subject}
            aria-current={i === vIdx}
            className="grid h-6 w-6 place-items-center"
            data-testid="value-dot"
          >
            <span className={"block h-2 rounded-full transition-all " + (i === vIdx ? "w-5 bg-brand-ink" : "w-2 bg-zinc-300 hover:bg-zinc-400")} />
          </button>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-3xl pb-10 text-lg leading-relaxed text-zinc-700 sm:text-xl" data-testid="mpl-b-claim">
        LIFTeracy is the only Hindi EdTech tool designed to teach a fully illiterate child to pass the main internationally recognized reading standard (MPL-B) without supplemental teaching input.
      </p>
    </div>
  );
}
