"use client";

// The donor page's headline value proposition (ported from
// sandbox-global-map/donor.html ValueStatement): a rotating subject / verb /
// percentage with an odometer roll, a drag-to-scrub subject and
// hand-scribbled hover notes (Caveat).

import { Caveat } from "next/font/google";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

const caveat = Caveat({ subsets: ["latin"], weight: ["500", "600", "700"] });

const WWHGE_PDF = "https://www.wwhge.org/wp-content/uploads/2026/02/WWHGE_Universal-Foundational-Learning-Insight-Note.pdf";
const CG_LINK = "https://coefficientgiving.org/research/our-planned-allocation-to-givewells-recommendations-for-the-next-few-years/";
const PP_ANALYSIS = "https://www.padhaipal.com"; // TODO: replace with the real analysis link

const VARIATIONS = [
  { subject: "$200T of economic value", verb: "unlocked", pct: "47%" },
  { subject: "$21 trillion additional tax revenue", verb: "unlocked", pct: "46%" },
  { subject: "46 million more people employed", verb: "unlocked", pct: "51%" },
  { subject: "368 million more primary school completions", verb: "unlocked", pct: "49%" },
  { subject: "368 million more secondary school starts", verb: "unlocked", pct: "50%" },
  { subject: "12 million child deaths", verb: "averted", pct: "47%" },
  { subject: "12 million child marriages", verb: "averted", pct: "49%" },
];

// vertical pixels per value step while scrubbing
const STEP_PY = 46;

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-bold text-blue-600 no-underline transition-colors hover:text-blue-700">
      {children}
    </a>
  );
}

export function ValueStatement() {
  const scribble = caveat.className;
  const note = "absolute left-1/2 top-full hidden w-max -translate-x-1/2 whitespace-nowrap pt-2 text-center text-2xl font-medium leading-tight text-zinc-500 group-hover:block";
  const [vIdx, setVIdx] = useState(0);
  const [paused, setPaused] = useState(false);
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
    <div className="mx-auto w-[90vw] max-w-none text-center text-3xl font-semibold leading-snug text-zinc-800 sm:text-4xl">
      <style>{"@keyframes ppRoll{from{transform:rotateX(90deg) translateY(.5em);opacity:0}to{transform:rotateX(0) translateY(0);opacity:1}}"}</style>
      <p className="pt-8">
        <span
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          title="Drag up or down to explore other ways to measure the opportunity"
          className="group relative inline-flex cursor-ns-resize select-none items-center align-middle"
          style={{ ...stage, touchAction: "none" }}
        >
          <span key={vIdx} className="font-extrabold text-blue-700" style={rollStyle}>
            {v.subject}
          </span>
          <span className={"absolute bottom-full left-1/2 hidden w-max -translate-x-1/2 whitespace-nowrap pb-1 text-center text-2xl font-medium leading-tight text-zinc-500 group-hover:block " + scribble}>
            reference <Link href={WWHGE_PDF}>here</Link>
          </span>
        </span>{" "}
        would be{" "}
        <span className="group relative inline-block font-semibold text-emerald-700" style={stage}>
          <span className={"absolute bottom-full left-0 hidden w-max -translate-x-1/2 whitespace-nowrap pb-2 text-2xl font-semibold leading-none text-emerald-600 group-hover:block " + scribble}>counterfactually</span>
          <span className="pointer-events-none absolute bottom-full left-0 hidden -translate-x-1/2 text-base leading-none text-emerald-600 group-hover:block">‸</span>
          <span key={v.verb} style={rollStyle}>
            {v.verb}
          </span>
        </span>{" "}
        by 2050 if every child could read.
      </p>
      <p className="relative mt-6 pb-14" style={stage}>
        LIFTeracy&apos;s goal is to{" "}
        <span className="group relative inline-block font-semibold text-amber-700">
          cost effectively
          <span className={note + " " + scribble}>
            achieves Coefficient Giving&apos;s funding bar of <Link href={CG_LINK}>$50/DALY</Link>
          </span>
        </span>{" "}
        capture{" "}
        <span className="group relative inline-block font-extrabold text-violet-700" style={stage}>
          <span key={vIdx} style={rollStyle}>
            {v.pct}
          </span>
          <span className="absolute left-1/2 top-full hidden translate-x-1 items-start gap-1 pt-1 group-hover:flex">
            <svg width="56" height="44" viewBox="0 0 56 44" fill="none" className="-mt-2 flex-shrink-0 text-zinc-400">
              <path d="M10 8 C 14 30, 28 35, 46 35" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M46 35 l -13 -5 M46 35 l -13 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={"whitespace-nowrap pt-2.5 text-2xl font-medium leading-tight text-zinc-500 " + scribble}>
              our analysis <Link href={PP_ANALYSIS}>here</Link>
            </span>
          </span>
        </span>{" "}
        of that.
      </p>
    </div>
  );
}
