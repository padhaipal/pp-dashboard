# Lifteracy boundary files

`boundaries/{type}/{code}.geojson` — one GeoJSON Feature per entity, WGS84 (EPSG:4326),
RFC 7946, simplified at 0.0008° with topology preserved. Properties: `code`, `name`, `type`.
Copy the `boundaries/` directory to `pp-dashboard/public/boundaries/`.

| type | files | key |
|---|---|---|
| country | 1 | `IN` |
| state | 36 | 2-digit UDISE state code |
| district | 772 | 4-digit UDISE district code |

No block, cluster or school boundaries: education-block polygons are not published
anywhere, and deriving them from school points was unreliable. Blocks render as labels.

## Source

Local Government Directory boundary layers (Ministry of Panchayati Raj), redistributed
as public-domain release assets by `yashveeeeeeer/india-geodata`:
`admin/states/LGD_States.parquet` (36), `admin/districts/LGD_Districts.parquet` (785).
District keys come from the distinct `(state_code, district_code, district)` tuples in
`DavidChristopherNelson/india-school-coordinates` (781 districts present in the register).

State files are keyed by UDISE state code. The LGD layer's `STCODE11` differs for three
states — Andhra Pradesh 37, Ladakh 38, DNH & DD 39 (UDISE 28, 37, 38) — so `build.py`
must remap them; an earlier build shipped AP's polygon as `37` and had no `28`.
`src/app/d/[user_id]/boundaries.test.ts` guards this.

## National outline — read before changing

`country/IN.geojson` is the unary union of the 36 official LGD state polygons. It is NOT
taken from Natural Earth, geoBoundaries, OSM or DataMeet. Those follow the Line of Control
convention for Jammu & Kashmir and Ladakh and exclude Aksai Chin; publishing such a map in
India is an offence under the Criminal Law Amendment Act 1961, and our users are Indian
government education officials. Any future replacement must derive from an official Indian
government layer (LGD or Survey of India).

## 9 districts with no boundary file — 4 states affected

LGD publishes no polygon for these, so they render as labels over the state outline.
A state is "incomplete" if any of its districts is missing:

- **Arunachal Pradesh (12)** — Keyi Panyor, Bichom (created 2024, not yet in LGD)
- **West Bengal (19)** — Siliguri (education-only district, no revenue equivalent)
- **Andhra Pradesh (28)** — Polavaram, Markapur (created 2025)
- **Karnataka (29)** — Bengaluru U North/South, Belagavi Chikkodi, Tumakuru Madhugiri
  (education districts that split revenue districts)

The other 32 states/UTs are complete. Delhi is complete: its 16 education zones all
matched by name. Resolving the remaining 9 needs the LGD *village* layer dissolved by
the schools inside each district — every one has 99–100% LGD village coverage, so it
is tractable but was out of scope here.

## Regenerating

`python3 build.py` (needs `geopandas`, `pyarrow`). Source files download to `src/`.
Outputs: `boundaries/`, `boundaries_manifest.csv`, `boundaries_district_crosswalk.csv`,
`districts_without_boundary.csv`.
