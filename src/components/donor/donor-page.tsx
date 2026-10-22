"use client";

// The public donor page (ported from sandbox-global-map/donor.html,
// 2026-10): value statement, learner photos, What LIFTeracy Does (video),
// Traction (real daily series + a live stream of masked student turns),
// Measuring Every Child (the /d dashboard's drillable map of India for the
// general public — every person masked by pp-sketch, recordings replaced by
// an example clip), Technical Roadmap, footer. No donate flow and no
// sign-in.

import Image from "next/image";
import { TeacherDashboard, publicProfile } from "@/app/d/[user_id]/teacher-dashboard";
import type { GeoRef } from "@/app/d/[user_id]/dashboard-types";
import { TechRoadmap } from "./tech-roadmap";
import { InteractionStream } from "./interaction-stream";
import { TractionChart } from "./traction-chart";
import { ValueStatement } from "./value-statement";

// the "See LIFTeracy in Action" clip from www.lifteracy.ai/#video
const LIFTERACY_VIDEO_URL = "https://framerusercontent.com/assets/UzlwOpPmZp3DVtJKOUr7hrlM8.mp4";

const H = "text-center text-3xl font-extrabold tracking-tight sm:text-4xl";
const HC = { color: "#1d9edf" };

export function DonorPage({ country, incompleteStates }: { country: GeoRef | null; incompleteStates: string[] }) {
  return (
    <div className="flex-1 scroll-smooth overflow-x-clip bg-zinc-50 text-zinc-900">
      {/* sticky top bar — logo + nav upper-left, GitHub upper-right */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-8">
            <a href="#top" className="shrink-0">
              <Image src="/lifteracy-logo-only.svg" alt="LIFTeracy" width={160} height={64} className="h-11 w-auto sm:h-12" priority />
            </a>
            <nav className="hidden items-center gap-6 text-sm font-semibold text-zinc-600 md:flex">
              <a href="#what-does" className="transition-colors hover:text-blue-600">
                What we do
              </a>
              <a href="#traction" className="transition-colors hover:text-blue-600">
                Traction
              </a>
              <a href="#measure" className="transition-colors hover:text-blue-600">
                Measuring
              </a>
              <a href="#roadmap" className="transition-colors hover:text-blue-600">
                Roadmap
              </a>
            </nav>
          </div>
          <a href="https://github.com/orgs/padhaipal/repositories" target="_blank" rel="noreferrer" title="Source on GitHub" aria-label="Source on GitHub" className="text-zinc-500 transition-colors hover:text-zinc-900">
            <svg viewBox="0 0 16 16" className="h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </header>

      <div id="top" />

      {/* 1 · headline value proposition */}
      <section className="bg-blue-50">
        <div className="mx-auto flex min-h-[30vh] items-center justify-center px-6 py-6">
          <ValueStatement />
        </div>
      </section>

      {/* 2 · learners in the field — full-bleed */}
      <section className="bg-zinc-50 py-10">
        <div className="flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size photo strip, already compressed */}
          <img src="/donor/learner-1.avif" alt="A learner using LIFTeracy" className="h-[32vh] w-[30vw] flex-shrink-0 rounded-2xl bg-zinc-100 object-cover shadow-md" />
          {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
          <img src="/donor/learner-2.webp" alt="Children learning together with LIFTeracy" className="h-[40vh] w-[46vw] flex-shrink-0 rounded-3xl bg-zinc-100 object-cover shadow-lg" />
          {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
          <img src="/donor/learner-3.avif" alt="A learner using LIFTeracy" className="h-[32vh] w-[30vw] flex-shrink-0 rounded-2xl bg-zinc-100 object-cover shadow-md" />
        </div>
      </section>

      {/* 3 · what LIFTeracy does */}
      <section id="what-does" className="scroll-mt-20 bg-zinc-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-6 " + H} style={HC}>
            What LIFTeracy Does
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="mx-auto mb-6 max-w-3xl text-center text-lg leading-relaxed text-zinc-700" data-testid="what-does-text">
              LIFTeracy is a one-on-one AI tutor that teaches children in India to read Hindi through evening WhatsApp voice message conversations. We are the only EdTech tool that can teach a fully illiterate child to pass the main internationally recognized standard of being able to read.
            </p>
            <video src={LIFTERACY_VIDEO_URL} poster="/donor/lifteracy-video-poster.jpg" controls preload="metadata" playsInline className="mx-auto w-full max-w-4xl rounded-xl bg-black" />
          </div>
        </div>
      </section>

      {/* 4 · traction — one chart, every series, the selected one in colour */}
      <section id="traction" className="scroll-mt-20 bg-blue-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-6 " + H} style={HC}>
            Traction
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <TractionChart />
          </div>
          <InteractionStream />
        </div>
      </section>

      {/* 5 · measurement — the /d dashboard's map of India, real data, everyone masked */}
      <section id="measure" className="scroll-mt-20 bg-zinc-50 pt-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-6 " + H} style={HC}>
            Measuring Every Child
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
            <p className="text-sm leading-relaxed text-zinc-600" data-testid="measure-text">
              LIFTeracy estimates student performance on national (<span className="font-semibold text-zinc-800">NIPUN</span>) and international (<span className="font-semibold text-zinc-800">MPL-b</span>) tests on a daily basis with 100% transparency. This is 1000 times faster than current sampling rates.
            </p>
            <p className="mt-2 text-xs text-zinc-400">Real data. Double-click an area to drill from India down to a school, a class and a student. Names and phone numbers are masked and recordings are private.</p>
          </div>
        </div>
        {country ? (
          <TeacherDashboard profile={publicProfile(country)} incompleteStates={incompleteStates} variant="public" />
        ) : (
          <p className="py-16 text-center text-sm text-zinc-400">The map is unavailable right now.</p>
        )}
      </section>

      {/* 6 · technical roadmap */}
      <section id="roadmap" className="scroll-mt-20 bg-blue-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-6 " + H} style={HC}>
            Technical Roadmap
          </h2>
          {/* no overflow-hidden: hover cards below the bottom lane must spill past the track */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <TechRoadmap />
          </div>
        </div>
      </section>

      {/* 7 · footer */}
      <section className="bg-zinc-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <DonorFooter />
        </div>
      </section>
    </div>
  );
}

function DonorFooter() {
  const cols: { h: string; links: [string, string][] }[] = [
    { h: "LIFTeracy", links: [["About", "https://www.padhaipal.com"], ["How it works", "https://www.padhaipal.com"], ["Contact", "https://www.padhaipal.com"]] },
    { h: "Trust", links: [["Annual report", "https://www.padhaipal.com"], ["Financials", "https://www.padhaipal.com"], ["Governance", "https://www.padhaipal.com"]] },
    { h: "Safety", links: [["Child safeguarding", "https://www.padhaipal.com"], ["Data & privacy", "https://www.padhaipal.com"]] },
  ];
  return (
    <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="text-lg font-black text-blue-700">LIFTeracy</div>
          <div className="mt-1 text-[11px] text-zinc-500">Teaching every child to read, over WhatsApp.</div>
          <a href="https://www.padhaipal.com" target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-semibold text-blue-600 hover:underline">
            www.padhaipal.com ↗
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
      <div className="mt-4 border-t border-zinc-100 pt-3 text-[10px] text-zinc-400">LIFTeracy is a registered non-profit · child data is processed under our privacy &amp; safeguarding policy.</div>
    </div>
  );
}
