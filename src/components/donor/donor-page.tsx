"use client";

// The public donor page (ported from sandbox-global-map/donor.html,
// 2026-10): value statement, learner photos, What LIFTeracy Does (video +
// cost-effectiveness), Traction (real daily series + a live stream of masked
// student turns), Measuring Every Child (the /d dashboard's drillable map of
// India for the general public — every person masked by pp-sketch,
// recordings replaced by an example clip), What we built in 8 months, Team,
// Get involved (contact + newsletter), footer (www.lifteracy.ai's). No donate
// flow and no sign-in. Prose sits on the bands; cards only hold interactive
// parts (chart, map, roadmap, sign-up).

import Image from "next/image";
import type { ReactNode } from "react";
import { TeacherDashboard, publicProfile } from "@/app/d/[user_id]/teacher-dashboard";
import type { GeoRef } from "@/app/d/[user_id]/dashboard-types";
import { CostEffectiveness } from "./cost-effectiveness";
import { DonorContact, DonorFooter } from "./donor-footer";
import { TechRoadmap } from "./tech-roadmap";
import { InteractionStream } from "./interaction-stream";
import { TractionChart } from "./traction-chart";
import { ValueStatement } from "./value-statement";

// the "See LIFTeracy in Action" clip from www.lifteracy.ai/#video
const LIFTERACY_VIDEO_URL = "https://framerusercontent.com/assets/UzlwOpPmZp3DVtJKOUr7hrlM8.mp4";

const H = "text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl";
const NAV: [string, string][] = [
  ["#what-does", "What we do"],
  ["#traction", "Traction"],
  ["#measure", "Measuring"],
  ["#roadmap", "What we built"],
  ["#team", "Team"],
];

// the founders (www.lifteracy.ai bios, expanded 2026-10)
const GITHUB_URL = "https://github.com/orgs/padhaipal/repositories";
const TEAM: { name: string; role: string; linkedin: string; points: ReactNode[] }[] = [
  {
    name: "Tom Delaney",
    role: "Pedagogy, Programs & Operations",
    linkedin: "https://www.linkedin.com/in/thomas-delaney-31b95b326/",
    points: [
      "Grew up in India, fluent in Hindi.",
      "Eight years in Indian education nonprofits; trained tens of thousands of government teachers.",
      "Coauthored two books (2022, 2024) and a journal article on literacy.",
      "Based in India, leading operations on the ground.",
    ],
  },
  {
    name: "David Nelson",
    role: "Software, Fundraising & Strategy",
    linkedin: "https://www.linkedin.com/in/david-nelson-51a3a387/",
    points: [
      "Degrees in Physics and Chemical Engineering.",
      "Serial entrepreneur; founded a modular housing company.",
      <>
        LIFTeracy’s code is{" "}
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink underline decoration-brand-mute underline-offset-2 hover:text-brand-deep">
          open source
        </a>
        .
      </>,
      "Based in Boston, leading software development, US networking and fundraising.",
    ],
  },
];

export function DonorPage({ country, incompleteStates }: { country: GeoRef | null; incompleteStates: string[] }) {
  return (
    <div className="flex-1 scroll-smooth overflow-x-clip bg-zinc-50 text-zinc-900">
      {/* sticky top bar — logo + nav upper-left, Talk to us + GitHub upper-right */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-zinc-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
          <div className="flex items-center gap-8">
            <a href="#top" className="shrink-0">
              <Image src="/lifteracy-logo-only.svg" alt="LIFTeracy" width={160} height={64} className="h-11 w-auto sm:h-12" priority />
            </a>
            <nav className="hidden items-center gap-6 text-sm font-semibold text-zinc-600 lg:flex">
              {NAV.map(([href, label]) => (
                <a key={href} href={href} className="transition-colors hover:text-brand-ink">
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <a href="#contact" className="rounded-full bg-brand-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep" data-testid="cta-talk">
              Talk to us
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" title="Source on GitHub" aria-label="Source on GitHub" className="text-zinc-500 transition-colors hover:text-zinc-900">
              <svg viewBox="0 0 16 16" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <div id="top" />

      {/* 1 · headline value proposition */}
      <section className="bg-blue-50">
        <div className="mx-auto flex min-h-[30vh] items-center justify-center px-6 py-6">
          <ValueStatement />
        </div>
      </section>

      {/* 2 · learners in the field — fixed aspect ratios in a max-width row; phones get the centre photo only */}
      <section className="bg-zinc-50 py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-3 px-6 sm:grid-cols-[3fr_4fr_3fr]" data-testid="photo-strip">
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo strip, already compressed */}
          <img src="/donor/learner-1.avif" alt="A learner using LIFTeracy" className="hidden aspect-[4/5] w-full rounded-2xl bg-zinc-100 object-cover shadow-md sm:block" />
          {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
          <img src="/donor/learner-2.webp" alt="Children learning together with LIFTeracy" className="aspect-[4/3] w-full rounded-3xl bg-zinc-100 object-cover shadow-lg" />
          {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
          <img src="/donor/learner-3.avif" alt="A learner using LIFTeracy" className="hidden aspect-[4/5] w-full rounded-2xl bg-zinc-100 object-cover shadow-md sm:block" />
        </div>
      </section>

      {/* 3 · what LIFTeracy does — prose on the band, then the video, then the cost figures */}
      <section id="what-does" className="scroll-mt-20 bg-zinc-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-4 " + H}>What LIFTeracy Does</h2>
          <p className="mb-8 max-w-3xl text-lg leading-relaxed text-zinc-700" data-testid="what-does-text">
            LIFTeracy is a one-on-one AI tutor that teaches children in India to read Hindi through evening WhatsApp voice message conversations. A ten minute lesson costs just four cents.
          </p>
          <div className="grid items-center gap-8 lg:grid-cols-[3fr_2fr]">
            <video src={LIFTERACY_VIDEO_URL} poster="/donor/lifteracy-video-poster.jpg" controls preload="metadata" playsInline className="w-full rounded-xl bg-black shadow-md" />
            <CostEffectiveness />
          </div>
        </div>
      </section>

      {/* 4 · traction — headline figures, one chart, the live stream */}
      <section id="traction" className="scroll-mt-20 bg-blue-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-6 " + H}>Traction</h2>
          <TractionChart />
          <InteractionStream />
        </div>
      </section>

      {/* 5 · measurement — the /d dashboard's map of India, real data, everyone masked */}
      <section id="measure" className="scroll-mt-20 bg-zinc-50 pt-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-4 " + H}>Measuring Every Child</h2>
          <p className="max-w-3xl text-lg leading-relaxed text-zinc-700" data-testid="measure-text">
            LIFTeracy estimates student performance on national (<span className="font-semibold text-zinc-900">NIPUN</span>) and international (<span className="font-semibold text-zinc-900">MPL-B</span>) tests on a daily basis with full transparency, allowing a much larger &amp; richer sample than current once-a-year tests with a random sample of students.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">Real data. Double-click an area to drill from India down to a school, a class and a student. Names and phone numbers are masked.</p>
        </div>
        {country ? (
          <TeacherDashboard profile={publicProfile(country)} incompleteStates={incompleteStates} variant="public" />
        ) : (
          <p className="py-16 text-center text-sm text-zinc-500">The map is unavailable right now.</p>
        )}
      </section>

      {/* 6 · what we built */}
      <section id="roadmap" className="scroll-mt-20 bg-blue-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-6 " + H}>What we built in 8 months</h2>
          {/* no overflow-hidden: hover cards below the bottom lane must spill past the track */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <TechRoadmap />
          </div>
        </div>
      </section>

      {/* 7 · team */}
      <section id="team" className="scroll-mt-20 bg-zinc-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-6 " + H}>Team</h2>
          <div className="grid items-center gap-8 md:grid-cols-[2fr_3fr]" data-testid="team">
            <figure>
              <Image src="/donor/founders.jpg" alt="Tom Delaney (left) and David Nelson (right) in LIFTeracy shirts outside Ambitious Impact in London" width={893} height={1000} className="aspect-[4/5] w-full max-w-sm rounded-2xl object-cover shadow-md" />
              <figcaption className="mt-2 text-sm text-zinc-500">Tom Delaney (left) and David Nelson (right) at Ambitious Impact, London.</figcaption>
            </figure>
            <div className="space-y-6">
              {TEAM.map((m) => (
                <div key={m.name} data-testid="team-member">
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-bold text-zinc-900">{m.name}</div>
                    <a href={m.linkedin} target="_blank" rel="noreferrer" aria-label={`${m.name} on LinkedIn`} title="LinkedIn" className="text-zinc-500 transition-colors hover:text-brand-ink">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
                      </svg>
                    </a>
                  </div>
                  <div className="text-sm font-semibold uppercase tracking-wide text-brand-ink">{m.role}</div>
                  <ul className="mt-2 max-w-xl list-disc space-y-1 pl-5 leading-relaxed text-zinc-700">
                    {m.points.map((p, k) => (
                      <li key={k}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8 · get involved — contact + newsletter */}
      <section id="contact" className="scroll-mt-20 bg-blue-50 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className={"mb-6 " + H}>Help us measure what works</h2>
          <DonorContact />
        </div>
      </section>

      <DonorFooter />
    </div>
  );
}
