# Donor page — `/` (src/app/page.tsx → DonorPage)

Public, no session. Ported 2026-10 from sandbox-global-map/donor.html.
Sections: sticky bar (logo; What we do / Traction / Measuring / Roadmap;
GitHub) — no Donate button, no sign-in; ValueStatement; learner photos
(public/donor/); "What LIFTeracy Does" (plain heading — no underline or
dictionary hover) with the one-line description above the video;
Traction (`TractionChart`); "Measuring Every Child" (the NIPUN / MPL-b text,
then `TeacherDashboard variant="public"` opened on India — resolved
server-side via geo-entities/search with the badge; the map says it is
unavailable when that fails); Technical Roadmap; footer. No "Help us
empower kids" / donate flow. The brand is written "LIFTeracy" everywhere
user-facing in pp-dashboard.

TractionChart: GET `users/dashboard/traction` (public allowlist; pp-sketch
users/traction.prompt.md). One SVG line chart from 1 Sep: every series a
grey line on its own scale, the selected one blue (#2563eb, the /d toggle's
pill) on a nice 0-based axis titled with its unit; hover = date + value.
Toggle: `MvpMetricToggle` with `TRACTION_METRICS` (ten series, asked
order). Slider 1–14 days (default 7): trailing mean of every line
(`smooth`, nulls skipped), in a /d-style pill with a dark day count.
