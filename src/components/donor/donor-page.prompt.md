# Donor page — `/` (src/app/page.tsx → DonorPage)

Public, no session. Ported 2026-10 from sandbox-global-map/donor.html.
Sections: sticky bar (logo; What we do / Traction / Measuring / Roadmap;
GitHub) — no Donate button, no sign-in; ValueStatement; learner photos
(public/donor/); "What LIFTeracy Does" (plain heading — no underline or
dictionary hover) with the two-sentence description above the video;
Traction (`TractionChart`, then `InteractionStream`); "Measuring Every Child" (the NIPUN / MPL-b text,
then `TeacherDashboard variant="public"` opened on India — resolved
server-side via geo-entities/search with the badge; the map says it is
unavailable when that fails); Technical Roadmap; footer. No "Help us
empower kids" / donate flow. The brand is written "LIFTeracy" everywhere
user-facing in pp-dashboard.

ValueStatement: the rotating "$… unlocked / averted by 2050" sentence, then
a fixed line — "$31 per income doubling" links the LIFTeracy cost
effectiveness model (Google Sheet), "GiveWell’s $55 funding bar" links
GiveWell's cost-effectiveness models page.

TractionChart: GET `users/dashboard/traction` (public allowlist; pp-sketch
users/traction.prompt.md). One series at a time from 1 Sep, one point per
IST day (no averaging, no grey lines), blue (#2563eb, the /d toggle's pill)
on a nice 0-based axis titled with its unit; hover = date + value. Toggle:
`MvpMetricToggle` with `TRACTION_METRICS` (ten series, asked order). A
`dots` series (cohort hours) is one dot per day plus its `note`: a day with
no dot = nobody onboarded that day.

InteractionStream: GET `users/dashboard/interactions` (public allowlist;
pp-sketch users/interaction-stream.prompt.md) on load and every 60 s while
the tab is visible. Shows the newest `STREAM_SIZE` (10) turns; turns not
seen before are revealed one by one over the next minute (`revealGapMs`),
newest on top, the oldest rotating out. Columns follow /user/[id]'s table:
Timestamp (IST), Student (masked), Response (Voice note / Flow tap, sky
tint), Answer (transcript masked to first and last character, or the
tapped option), Correct Answer, Answer Status, WPM. No audio.

"Measuring Every Child": `TeacherDashboard variant="public"` relabels
"Time" as "Usage time" (English only, via its `t`); the /d dashboards keep
"Time".

Technical Roadmap (`tech-roadmap.tsx`): to scale, 24 Feb – 24 Oct 2026,
milestones from the repos' history.
