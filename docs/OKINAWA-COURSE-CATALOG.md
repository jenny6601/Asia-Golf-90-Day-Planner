# Okinawa Main Island Course Catalog — Pilot

The fixed pilot scope contains six user-selected Okinawa Main Island courses. The exact Google Maps coordinates below were supplied by the user on 2026-11-27 and are the active coordinates for the course-weather acceptance run. They are synchronized across:
- `config/global/courses.json`
- `config/okinawa/course-coordinate-candidates.json`
- `assets/js/okinawa-courses.js`

## Current GPS points — user-supplied Google Maps coordinates

| Course | Zone | Latitude | Longitude | Source status | Runtime |
|---|---|---:|---:|---|---|
| The Southern Links Golf Club | South / Yaese | 26.113785 | 127.739021 | User-provided Google Maps | Enabled |
| Palm Hills Golf Resort Club | South / Itoman | 26.120580 | 127.699640 | User-provided Google Maps | Enabled |
| PGM Golf Resort Okinawa | Central / Onna | 26.455335 | 127.820344 | User-provided Google Maps | Enabled |
| Kanehide Kise Country Club | North / Nago | 26.524228 | 127.939192 | User-provided Google Maps | Enabled |
| The Atta Terrace Golf Resort | North / Onna | 26.499868 | 127.896002 | User-provided Google Maps | Enabled |
| Chura Orchard Golf Club | North / Onna | 26.506260 | 127.895720 | User-provided Google Maps | Enabled |

All six records use:
- `coordinateStatus: user_provided_google_maps`
- `coordinateSource: User-provided Google Maps coordinate (2026-11-27)`
- `timezone: Asia/Tokyo`

These are the exact user-provided points. Earlier third-party course listings, old manual candidates, and official map viewport/destination coordinates are retained only as historical audit context; they must not overwrite this six-point set.

## Data and runtime rules

- The exact six GPS values above must match in the candidate, global runtime and pilot module catalogs.
- All six courses are enabled because each now has a user-supplied coordinate.
- The source attribution means the coordinates were supplied from Google Maps by the user; it does not claim independent land-survey or golf-course polygon validation.
- A provider-returned forecast grid coordinate is not the course GPS or a course boundary.
- The weather engine must preserve the selected course identity and requested coordinate in every result.
- Any future coordinate change requires updating all three catalogs and the coordinate regression test in one change.

## Weather coverage

The six-course availability probe is implemented in:
- Script: `scripts/validate-okinawa-course-weather.mjs`
- Workflow: `.github/workflows/okinawa-course-weather-acceptance.yml`
- Test: `tests/okinawa-course-weather-acceptance.test.js`
- Report artifact: `okinawa-six-course-weather-acceptance`

The probe requests 16-day hourly/daily forecast fields and 90-day seasonal daily/six-hourly fields at each of the six user-supplied course points. It records timezone, non-null coverage, returned grid coordinates, shared grid cells, and nearest JMA AMeDAS station candidates. It is a data-availability and structural-completeness test, not forecast-accuracy verification.

## Official course and observation references

- Southern Links: https://reserve.accordiagolf.com/en/global/golfCourse/okinawa/southernlinks/access
- Palm Hills: https://reserve.accordiagolf.com/en/global/golfcourse/okinawa/palmhills/access/
- PGM: https://www.pacificgolf.co.jp/okinawa/information.asp
- Atta Terrace: https://www.terrace.co.jp/atta/information/access.php
- Chura Orchard: https://www.jgmgroup.co.jp/churaorchard/
- Kanehide Kise: https://www.kise-cc.jp/en/
- Japan Meteorological Agency AMeDAS: https://www.jma.go.jp/bosai/amedas/
