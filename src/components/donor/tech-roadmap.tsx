"use client";

// The donor page's Technical Roadmap (ported from sandbox-global-map/
// donor.html TechRoadmap): a to-scale timeline of shipped milestones, labels
// packed into lanes so titles never collide, a one-line story on hover.

import { useEffect, useRef, useState } from "react";

const TECH_DONE = [
  { date: "2026-03-04", title: "Live on WhatsApp", detail: "Children message LIFTeracy on WhatsApp — no app to install." },
  { date: "2026-03-18", title: "Hears every letter", detail: "Spots exactly which letters a child misreads in a voice note." },
  { date: "2026-04-15", title: "Evening reminders", detail: "A short video at 7 pm every evening invites each child to their lesson." },
  { date: "2026-04-22", title: "Teaches vowels", detail: "Vowels and their signs (matras) join the lessons." },
  { date: "2026-05-29", title: "Safe daily releases", detail: "Automated tests and a staging copy before every update." },
  { date: "2026-06-11", title: "Live monitoring", detail: "Every message traced end to end, with a daily health report." },
  { date: "2026-07-07", title: "Proven at scale", detail: "Handled 1,200 messages a second in load tests." },
  { date: "2026-07-27", title: "Stories, not just words", detail: "Reading passages with comprehension questions, written by AI and quality-checked before a child sees them." },
  { date: "2026-08-25", title: "Adapts to every child", detail: "Lesson difficulty moves up or down with each child's reading." },
  { date: "2026-09-04", title: "Measures reading speed", detail: "Words per minute from each recorded read-aloud." },
  { date: "2026-09-11", title: "Sign-up by voice", detail: "Parents give consent and child details just by speaking." },
  { date: "2026-09-16", title: "Mapped every school in India", detail: "1.7 million schools mapped, ready for teacher dashboards." },
  { date: "2026-10-02", title: "Fourth speech engine", detail: "A fourth transcription service checks every voice note." },
  { date: "2026-10-08", title: "Dashboards for officials", detail: "Teachers and education officials see their own schools' progress every day." },
  { date: "2026-10-12", title: "Daily NIPUN verdicts", detail: "Every school gets a NIPUN pass or fail estimate, updated daily." },
  { date: "2026-10-13", title: "Reading-speed gate", detail: "From level 9, a child reads at 40 words a minute before moving on." },
];

const T0 = Date.parse("2026-02-24T00:00:00Z");
const T1 = Date.parse("2026-10-24T00:00:00Z");
const MONTHS: [string, string][] = [
  ["Mar", "2026-03-01"],
  ["Apr", "2026-04-01"],
  ["May", "2026-05-01"],
  ["Jun", "2026-06-01"],
  ["Jul", "2026-07-01"],
  ["Aug", "2026-08-01"],
  ["Sep", "2026-09-01"],
  ["Oct", "2026-10-01"],
];
// label lanes: above-near, below-near, above-far, below-far, … (eight: the
// September–October milestones crowd the right end)
const LANES = [-34, 34, -70, 70, -106, 106, -142, 142];

const xOf = (d: string) => ((Date.parse(d + "T00:00:00Z") - T0) / (T1 - T0)) * 100;
const fmtD = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const anchorOf = (x: number) => (x < 7 ? "0%" : x > 93 ? "-100%" : "-50%");
// text-[11px] font-semibold + padding
const labelW = (t: string) => t.length * 6.4 + 18;

export function TechRoadmap() {
  const events = [...TECH_DONE].sort((a, b) => (a.date < b.date ? -1 : 1));
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackW, setTrackW] = useState(960);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackW(el.clientWidth || 960);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // each event takes the nearest lane whose previous label ends before it starts (8 px gap)
  const lastRight = LANES.map(() => -Infinity);
  const laneOf = events.map((e) => {
    const x = xOf(e.date);
    const w = labelW(e.title);
    const a = anchorOf(x);
    const left = (x / 100) * trackW - (a === "-50%" ? w / 2 : a === "-100%" ? w : 0);
    let lane = LANES.findIndex((_, k) => left >= lastRight[k] + 8);
    if (lane < 0) lane = lastRight.indexOf(Math.min(...lastRight));
    lastRight[lane] = left + w;
    return lane;
  });
  const farthest = Math.max(...laneOf);
  return (
    <div className="p-5 sm:p-8" data-testid="tech-roadmap">
      <div className="mb-2 text-center text-sm text-zinc-500">
        What we&apos;ve built so far, month by month. Hover a milestone for the one-line story. Every line of code is open source:{" "}
        <a href="https://github.com/orgs/padhaipal/repositories" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">
          GitHub ↗
        </a>
      </div>
      <div className={"relative mx-auto mb-10 mt-14 max-w-5xl overflow-x-auto sm:overflow-visible " + (farthest >= 6 ? "h-96" : farthest >= 4 ? "h-80" : "h-64")}>
        <div ref={trackRef} className="relative h-full min-w-[720px]">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-zinc-300" />
          {MONTHS.map(([m, d]) => (
            <div key={m} className="absolute top-1/2 -translate-y-1/2" style={{ left: xOf(d) + "%" }}>
              <div className="absolute -top-1.5 left-0 h-3 w-px -translate-x-1/2 bg-zinc-300" />
              <div className="absolute left-0 top-2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{m}</div>
            </div>
          ))}
          {events.map((e, i) => {
            const x = xOf(e.date);
            const off = LANES[laneOf[i]];
            const up = off < 0;
            const anchor = anchorOf(x);
            return (
              <div key={e.date + e.title} className="group/m absolute top-1/2" style={{ left: x + "%" }}>
                <div className="absolute -translate-x-1/2 bg-zinc-300 transition-colors group-hover/m:bg-emerald-400" style={{ width: 1, height: Math.abs(off) - 6, top: up ? off + 6 : 0 }} />
                <div className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-white transition group-hover/m:scale-125 group-hover/m:bg-emerald-600" style={{ top: 0 }} />
                <div
                  className="absolute z-10 cursor-default whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-800 shadow-sm transition group-hover/m:border-emerald-400 group-hover/m:text-emerald-700"
                  style={{ top: off - 11, transform: "translateX(" + anchor + ")" }}
                >
                  {e.title}
                </div>
                <div
                  className="pointer-events-none absolute z-30 hidden w-56 whitespace-normal rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-medium leading-snug text-white shadow-xl group-hover/m:block"
                  style={{ top: up ? off - 11 - 8 : off + 18, transform: "translate(" + anchor + ", " + (up ? "-100%" : "0") + ")" }}
                >
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">{fmtD(e.date)}</div>
                  {e.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
