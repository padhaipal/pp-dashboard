1.) Test-only fixtures for the /d/[user_id] suite: `PROFILE` (country-level user `u1`, geo `g-in` India, share link `https://lifteracy.ai/d/u1`), `SCORES` (child_type state; children `g-09` Uttar Pradesh 72.0 % and `g-28` Andhra Pradesh 60.0 %), `EMPTY_SCORES` (all root fields null, no children/series), `SPOTLIGHT`, `GEO` (tiny square GeoJSON FeatureCollections for `/boundaries/country/IN.geojson`, `/boundaries/state/09.geojson`, `/boundaries/state/28.geojson`).
2.) `makeFetch({ scores })` returns a fetch stub (for `vi.stubGlobal`) routing those URLs and recording every call in `calls`; unmocked URLs → 404 `{ message }`. `jsonResponse(status, body)` builds a minimal Response.
Time fixtures (2026-09): `timeScores(window)` / `timeScoresClass(window)` — the geo and class payloads as pp-sketch returns them in Time mode (window echoed, `time_*` on root / children / students, no deltas, no most improved); `USAGE_HISTORY` — GET users/:id/usage-history. `makeFetch({ timeById: { "<id>": "geo" | "class" } })` answers `metric=usage&window=…` scores / spotlight requests for those ids in Time mode; without it a usage request gets the plain fixture (a pp-sketch that predates windows).

## 2026-10: verdict fixtures

`SCORES_VERDICT` (UP under `metric=nipun`: Lucknow 1 of 2 decided schools
pass, Barabanki undecided / grey) and `SCORES_SCHOOL_VERDICT` (a school's
Pass with its three bands, no teachers). `makeFetch({ verdictById })`
answers `metric=nipun` scores requests with them (spotlight → nulls).
`TEST_SCORES.nipun_grade_1`: three level-8 lessons so far, four needed.

## 2026-10: share message

`SHARE_MESSAGE` and `makeFetch({ shareMessage })`: the share-message answer
for every id (null → 403, as pp-sketch answers a non-owner).
