# Donor page — `/` (src/app/page.tsx → DonorPage)

Public, no session. Ported 2026-10 from sandbox-global-map/donor.html.
Sections: sticky bar (logo; What we do / Traction / Impact (→ #measure) /
What we built / Team; "Try it Out" outline button → the referral link
dashboard.padhaipal.com/r/919565897842 (new tab); "Talk to us" button →
#contact; GitHub, hidden on phones) — no donate flow, no sign-in;
ValueStatement; learner photos; partners; "What LIFTeracy Does"; Traction;
"Measuring Every Child"; "What we built in 8 months"; Team; "Help us
measure what works" (#contact); footer. No mention of PadhaiPal anywhere
visible (GitHub URLs keep the org name). The brand is written "LIFTeracy",
the test "MPL-B", everywhere user-facing.

Look: Geist (globals.css no longer overrides it with Arial) + Noto Sans
Devanagari (`font-devanagari`; Hindi answers render in it at 1.1em). One
colour system — globals.css `@theme` tokens: `brand` #1f9ddf (logo; fills,
dots, bars), `brand-ink` #1878b0 (headings, links, figures, buttons — the
logo blue fails WCAG as text), `brand-deep` (hover), `brand-soft` /
`brand-mute` (light fills, badges, "joined this month" bars), `accent`
#c2410c (the hero verb only); emerald only for success / correct. Grey
text is zinc-500 or darker. No dark-mode body switch. Headings and intros
are left-aligned (the hero stays centred); prose sits directly on the
alternating blue-50 / zinc-50 bands; cards only around interactive parts
(chart, map, roadmap, sign-up form, interaction table).

ValueStatement (h1): the rotating "$… unlocked / averted" sentence
(larger), "by 2050 if every child could read." on its own line (no source
note); "counterfactually"
shows on hover or tap; drag-to-scrub on the subject; a row of dots (one per
variation, tappable, the current one wide) under it; then the MPL-B claim:
"LIFTeracy is the only Hindi EdTech tool designed to teach a fully
illiterate child to pass the main internationally recognized reading
standard (MPL-B) without supplemental teaching input."

What LIFTeracy Does: "LIFTeracy is a one-on-one AI tutor … conversations. A
ten minute lesson costs just four cents.", then the demo video
(public/donor/lifteracy-demo.mp4: LIFTeracy_demo.mp4 re-encoded to 720p,
faststart, ~10 MB; poster lifteracy-demo-poster.jpg) beside
`CostEffectiveness` ($31 vs $60 bars to scale, each linking its source;
the sentence "LIFTeracy is estimated to cost [$31 per income doubling at
scale], beating [Ambitious Impact’s funding bar of $60]." — CEM artifact /
AIM evaluative criteria; "This estimate needs to be tested with a
randomized control trial." as small grey text).

TractionChart: headline figures first (`totals`: all-time hours spent on
LIFTeracy, students; plain on the band, hidden when pp-sketch has none),
then the chart card; fixed-size pulse skeletons while loading (no layout
jump). GET `users/dashboard/traction` (public allowlist; pp-sketch
users/traction.prompt.md). One series at a time from 1 Apr, one point per
IST day, x labels on each month's 1st ("1 April"; phones: short names, at
most four), brand-ink line on a nice 0-based axis titled with its unit; hover =
date + value; chart text ≥ 12 px. Toggle: `MvpMetricToggle` (brand-ink
selected pill via `selectedClass`) with `TRACTION_METRICS` ("Minutes spent"
first = default). "Monthly active students" (`monthly`) is `MonthlyBars`:
one stacked bar per month of students with ≥ 1 five-minute day — brand-ink
= joined in an earlier month, brand-mute = joined that month, total on top;
the month in progress adds a dashed overlay to its linear month-end
projection ("10 → ~31"). Missing `monthly` → "No data yet." "Download CSV" (beside
"updated …", shown when there are daily rows, on mobile too): built in the
browser from the same response (`tractionCsv`, no pp-sketch call) — one row
per IST day, a column per daily toggle (header = toggle label), then the
day's month's "Monthly active students" figures (total, joined earlier,
joined this month, projected; blank without a month row). UTF-8 with BOM,
`lifteracy-traction-<computed_at date>.csv`.

InteractionStream: graded turns only (pp-sketch filters). GET
`users/dashboard/interactions` (public allowlist; pp-sketch
users/interaction-stream.prompt.md) on load and every 60 s while the tab is
visible. Newest `STREAM_SIZE` (10) turns; unseen turns revealed one by one
over the next minute (`revealGapMs`), oldest rotating out. From sm up the
/user/[id] table: When, Student (masked), Question Type ("Reading
Question" / "Comprehension Multi-choice", brand-soft tint), Answer, Correct
Answer, Answer Status, WPM. Below sm a compact feed: "2 min ago · S...a ·
Reading · 42 wpm", then ✓/✗ and the answer (+ "expected …" when wrong).
WPM over 200 (`MAX_WPM`) shows "--" like a missing speed. Loading = ten
skeleton rows. No audio.

"Measuring Every Child": intro on the band ("… daily basis with full
transparency, allowing a much larger & richer sample than current
once-a-year tests with a random sample of students."; "Names and phone
numbers are masked."), then
`TeacherDashboard variant="public"` opened on India (resolved server-side
via geo-entities/search with the badge; "unavailable" when that fails). The
public variant renders the location title as an h3 (no h1 under the page's
h2s), draws incomplete states in the same Not-using grey as /d (tooltip on
hover or tap, no legend entry, not drillable), opens on All time, leaves today (IST, in progress) out of the Usage
time trend, ignores a single click on a teacher (card or bar — no popup;
double-click still drills), is always English (ignores the language a /d dashboard saved in
localStorage), relabels "Time" as "Usage time" and shows a `DrillHint` on every map
level (country / state / district / block): at India on Jammu & Kashmir
(code 01), below that on the northernmost area in use (GeoMap `hintNorth`;
on a block's school dots, the school with the most students), worded for the level ("Double-click Lucknow to explore its blocks, schools
and students."; blocks: "… to see its classes and students."). ✕ dismisses
it for that level only (session state); near the map's top edge it hangs
below its area, arrow up.

Learner photos (`PHOTO_COLUMNS`): eight photos in four columns of two from
lg (phones: two columns of four, columns 1+2 and 3+4), paired so the
columns' natural heights nearly match; every column stretches to the
tallest (photos object-cover, a few % cropped) so the bottoms line up.
learner-1..3 from www.lifteracy.ai, learner-4..8 extracted from the
LIFTeracy report (2026-10).

Partners (`PARTNERS`, white band just above "What LIFTeracy Does"): two
cards, logo + one line — Ambitious Impact's logo (Charity Entrepreneurship
is its incubation program; "LIFTeracy is a 2026 incubatee of Ambitious
Impact’s Charity Entrepreneurship Program.") and DEVI Sansthan's (Dignity
Education Vision International; "on-the-ground partner") — then "Read the
LIFTeracy report (PDF)" → public/donor/lifteracy-report.pdf (a copy of
"LIFTeracy Proposal.pdf", 2026-10-30 15:23).

"What we built in 8 months" (`tech-roadmap.tsx`): from md up, to scale,
24 Feb – 24 Oct 2026, labels in lanes, story on hover; below md a vertical
timeline grouped by month (newest first) with every story visible.

Team: the founders' photo (public/donor/founders.jpg) beside one block per
founder — name + LinkedIn icon link, role (Tom Delaney: Pedagogy, Programs
& Operations; David Nelson: Software, Fundraising & Strategy), bullet bio
(David's links the open-source code on GitHub).

"Help us measure what works" (`DonorContact`): the seed-funding ask with
hello@lifteracy.ai, beside the "Get updates" form (placeholder
you@example.org) — POST /api/quiz/subscribe, the /quiz page's mailing list
(pp-sketch mailing_list_entries; lifteracy.ai's Framer form only takes
posts from that site).

Footer (`DonorFooter`): no partners block (the page's partners section
has the logos); Privacy Policy / Terms of
Use / Child Protection Policy at /privacy, /terms,
/child-protection (next.config.ts rewrites to public/legal/*.pdf, the PDFs
LIFTeracy versions, Oct 2026); Development Consortium
registration.
The team photo's caption names Tom Delaney (left) and David Nelson (right).
