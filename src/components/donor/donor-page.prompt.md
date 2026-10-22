# Donor page — `/` (src/app/page.tsx → DonorPage)

Public, no session. Ported 2026-10 from sandbox-global-map/donor.html.
Sections: sticky bar (logo; What we do / Traction / Measuring / Roadmap;
GitHub) — no Donate button, no sign-in; ValueStatement; learner photos
(public/donor/); "What LIFTeracy Does" (plain heading — no underline or
dictionary hover) with the two-sentence description above the video
(second sentence, the MPL-B claim, on its own line);
Traction (`TractionChart`, then `InteractionStream`); "Measuring Every Child" (the NIPUN / MPL-b text,
then `TeacherDashboard variant="public"` opened on India — resolved
server-side via geo-entities/search with the badge; the map says it is
unavailable when that fails); Technical Roadmap; footer (`donor-footer.tsx`, www.lifteracy.ai's: Dignity
Education logo, "Sign up for Updates!" — POST /api/quiz/subscribe, the
/quiz page's mailing list (pp-sketch mailing_list_entries; lifteracy.ai's
Framer form only takes posts from that site) — contact hello@lifteracy.ai, Privacy Policy / Terms and
Conditions / Child Protection Policy (Google Drive), Development Consortium
registration). No mention of PadhaiPal anywhere visible (GitHub URLs keep
the org name). No "Help us
empower kids" / donate flow. The brand is written "LIFTeracy" everywhere
user-facing in pp-dashboard.

ValueStatement: the rotating "$… unlocked / averted" sentence with "by 2050
if every child could read." on its own line, then a fixed line — "$31 per
income doubling at scale" links the LIFTeracy cost-effectiveness artifact,
"Ambitious Impact’s funding bar of $60" links AIM's evaluative criteria —
and "This estimate needs to be tested with a randomized control trial." on
its own line.

TractionChart: GET `users/dashboard/traction` (public allowlist; pp-sketch
users/traction.prompt.md). One series at a time from 1 Apr, one point per
IST day (no averaging, no grey lines), blue (#2563eb, the /d toggle's pill)
on a nice 0-based axis titled with its unit; hover = date + value. Toggle:
`MvpMetricToggle` with `TRACTION_METRICS` (ten, asked order; "Minutes
spent" first = default). "Monthly active students" (`monthly`) is
`MonthlyBars`: one stacked bar per month of students with ≥ 1 five-minute
day — dark = joined in an earlier month, light = joined that month, total
on top; the month in progress adds a dashed overlay to its linear
month-end projection ("10 → ~31"). Missing `monthly` (older pp-sketch) →
"No data yet."

InteractionStream: GET `users/dashboard/interactions` (public allowlist;
pp-sketch users/interaction-stream.prompt.md) on load and every 60 s while
the tab is visible. Shows the newest `STREAM_SIZE` (10) turns; turns not
seen before are revealed one by one over the next minute (`revealGapMs`),
newest on top, the oldest rotating out. Columns follow /user/[id]'s table:
When ("N min ago" / "N h ago", refreshed every 30 s; IST time on hover),
Student (masked name, or a stand-in "A...l" when unnamed), Question Type
("Reading Question" / "Comprehension Multi-choice", sky tint), Answer (transcript masked to first and last character, or the
tapped option), Correct Answer, Answer Status, WPM. No audio.

"Measuring Every Child": `TeacherDashboard variant="public"` relabels
"Time" as "Usage time" (English only, via its `t`); the /d dashboards keep
"Time". At the country level a dismissible `DrillHint` points at Uttar
Pradesh (state code 09, GeoMap `hintId`) inviting a double-click; it closes
on dismiss or on any drill (session only).

Technical Roadmap (`tech-roadmap.tsx`): to scale, 24 Feb – 24 Oct 2026,
milestones from the repos' history.
