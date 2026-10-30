"use client";

// The public donor page (ported from sandbox-global-map/donor.html,
// 2026-10): value statement, learner photos, partners (CE / DEVI Sansthan +
// the report PDF), What LIFTeracy Does (video +
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

// the LIFTeracy demo (LIFTeracy_demo.mp4, re-encoded to 720p, faststart)
const LIFTERACY_VIDEO_URL = "/donor/lifteracy-demo.mp4";

const H = "text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl";
const NAV: [string, string][] = [
  ["#what-does", "What we do"],
  ["#traction", "Traction"],
  ["#measure", "Impact"],
  ["#roadmap", "What we built"],
  ["#team", "Team"],
];

// "Try it Out": a referral link that starts the WhatsApp bot
const TRY_IT_URL = "https://dashboard.padhaipal.com/r/919565897842";
const REPORT_URL = "/donor/lifteracy-report.pdf";

// learners in the field (the first three from www.lifteracy.ai, the rest
// from the LIFTeracy report) in four columns of two, paired so the columns'
// natural heights nearly match (each stretches to the tallest, cropping a
// few %, so the bottoms line up); phones: two columns of four (1+2, 3+4)
type Photo = { src: string; w: number; h: number; alt: string };
const PHOTO_COLUMNS: Photo[][] = [
  [
    { src: "/donor/learner-7.webp", w: 500, h: 787, alt: "A girl doing a LIFTeracy lesson on a phone" },
    { src: "/donor/learner-5.webp", w: 922, h: 427, alt: "Classmates gathered round a LIFTeracy lesson" },
  ],
  [
    { src: "/donor/learner-4.webp", w: 725, h: 543, alt: "A class and their teacher" },
    { src: "/donor/learner-1.avif", w: 598, h: 735, alt: "A learner using LIFTeracy" },
  ],
  [
    { src: "/donor/learner-2.webp", w: 1178, h: 776, alt: "Children learning together with LIFTeracy" },
    { src: "/donor/learner-8.webp", w: 750, h: 1000, alt: "A teacher and children with LIFTeracy on a phone" },
  ],
  [
    { src: "/donor/learner-3.avif", w: 497, h: 696, alt: "A learner using LIFTeracy" },
    { src: "/donor/learner-6.webp", w: 615, h: 410, alt: "A schoolboy reading a LIFTeracy lesson" },
  ],
];

const PARTNERS: { logo: string; w: number; h: number; name: string; text: string }[] = [
  {
    logo: "/donor/ambitious-impact.webp",
    w: 600,
    h: 261,
    name: "Charity Entrepreneurship (Ambitious Impact)",
    text: "LIFTeracy is a 2026 incubatee of Ambitious Impact’s Charity Entrepreneurship Program.",
  },
  {
    logo: "/donor/devi-sansthan.webp",
    w: 752,
    h: 345,
    name: "DEVI Sansthan (Dignity Education Vision International)",
    text: "DEVI Sansthan is our on-the-ground partner, bringing LIFTeracy to schools and families in India.",
  },
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          <div className="flex items-center gap-8">
            <a href="#top" className="shrink-0">
              <Image src="/lifteracy-logo-only.svg" alt="LIFTeracy" width={160} height={64} className="h-9 w-auto sm:h-12" priority />
            </a>
            <nav className="hidden items-center gap-6 text-sm font-semibold text-zinc-600 lg:flex">
              {NAV.map(([href, label]) => (
                <a key={href} href={href} className="transition-colors hover:text-brand-ink">
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href={TRY_IT_URL} target="_blank" rel="noreferrer" className="whitespace-nowrap rounded-full border-2 border-brand-ink px-3 py-1.5 text-sm font-semibold text-brand-ink shadow-sm transition-colors hover:bg-brand-ink hover:text-white sm:px-4" data-testid="cta-try">
              Try it Out
            </a>
            <a href="#contact" className="whitespace-nowrap rounded-full bg-brand-ink px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep sm:px-4" data-testid="cta-talk">
              Talk to us
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" title="Source on GitHub" aria-label="Source on GitHub" className="hidden text-zinc-500 transition-colors hover:text-zinc-900 sm:block">
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

      {/* 2 · learners in the field — columns stretched to one height, so the bottoms line up: two columns on phones, four on desktop */}
      <section className="bg-zinc-50 py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-6 sm:gap-4" data-testid="photo-strip">
          {[PHOTO_COLUMNS.slice(0, 2), PHOTO_COLUMNS.slice(2)].map((half, i) => (
            <div key={i} className="flex flex-col gap-3 sm:gap-4 lg:grid lg:grid-cols-2">
              {half.map((col) => (
                <div key={col[0].src} className="flex grow flex-col gap-3 sm:gap-4">
                  {col.map((p) => (
                    <div key={p.src} className="relative grow overflow-hidden rounded-2xl bg-zinc-100 shadow-md ring-1 ring-black/5" style={{ aspectRatio: `${p.w} / ${p.h}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- static photos, already compressed */}
                      <img src={p.src} alt={p.alt} width={p.w} height={p.h} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* 2b · partners — incubator and on-the-ground partner, and the report */}
      <section id="partners" className="scroll-mt-20 bg-white py-10" data-testid="partners">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {PARTNERS.map((p) => (
              <div key={p.logo} className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center sm:flex-row sm:text-left" data-testid="partner">
                <Image src={p.logo} alt={p.name} width={p.w} height={p.h} className="h-20 w-auto shrink-0 object-contain sm:h-24" />
                <p className="leading-relaxed text-zinc-700">{p.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <a href={REPORT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep" data-testid="report-link">
              Read the LIFTeracy report (PDF)
            </a>
          </div>
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
            <video src={LIFTERACY_VIDEO_URL} poster="/donor/lifteracy-demo-poster.jpg" controls preload="metadata" playsInline className="w-full rounded-xl bg-black shadow-md" />
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
