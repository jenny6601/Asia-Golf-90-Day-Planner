# Okinawa Main Island Course Catalog — Pilot

The fixed pilot scope contains six user-selected Okinawa Main Island courses. Runtime course data is stored in `config/global/courses.json`. Candidate coordinates and their provenance are tracked separately in `config/okinawa/course-coordinate-candidates.json` and must not be automatically promoted.

## Current coordinate acceptance status

| Course | Zone | Address source | Candidate coordinate | GPS status | Runtime availability |
|---|---|---|---|---|---|
| The Southern Links Golf Club | South / Yaese | Official Accordia | 26.118019, 127.738385 | Provisional | Enabled for preview |
| Palm Hills Golf Resort Club | South / Itoman | Official Accordia | 26.1220517, 127.7076402 | Provisional | Enabled for preview |
| PGM Golf Resort Okinawa | Central / Onna | Official PGM | 26.458099, 127.814610 (candidate only) | Pending independent verification | Disabled; runtime coordinates remain null |
| The Atta Terrace Golf Resort | North / Onna | Official Atta Terrace | 26.500916, 127.895049 | Verified against official Google Maps destination link | Enabled |
| Chura Orchard Golf Club | North / Onna | Official JGM | 26.5100539, 127.8927318 | Verified against official Google Maps place link | Enabled |
| Kanehide Kise Country Club | North / Nago | Official Kanehide Kise | 26.5241373, 127.9393349 | Verified against official Google Maps place link | Enabled |

## Coordinate reconciliation notes

- Southern Links: FullGolf / OpenStreetMap course listing provides 26.118019, 127.738385. Accordia confirms the official address 697 Hanashiro, Yaese. Keep provisional until the point is checked against the course property/map.
- Palm Hills: MapFan lists 26.1220517, 127.7076402. Accordia confirms 762 Arakaki, Itoman. The official Google Maps embed viewport centre is 26.1219569, 127.7056698; this is not assumed to be the exact facility pin. Keep provisional pending map-pin/property review.
- PGM: official PGM confirms the golf-course address 1043 Fuchaku, Onna. The earlier manually supplied coordinate 26.458099, 127.814610 is retained only as a validation candidate. Do not confuse the separate PGM Hotel Resort at 1390 Fuchaku with the golf course. PGM remains disabled until its point is independently verified.
- Atta Terrace: the official access page links to Google Maps destination 26.500916, 127.895049. This supersedes the older Where2Golf point.
- Chura Orchard: the official JGM course page's Google Maps place link resolves to 26.5100539, 127.8927318. This supersedes the earlier manual candidate 26.499221, 127.893139 and older FullGolf point; the manual candidate is about 1.2 km away.
- Kanehide Kise: the official club website's Google Maps link resolves to 26.5241373, 127.9393349. This supersedes older approximate third-party/manual coordinates.

## Safety and runtime rules

- A pending GPS record must keep runtime latitude/longitude null and must be disabled in the course picker.
- Provisional coordinates may be used for read-only preview comparison but must retain their status and source provenance.
- A provider-returned forecast grid coordinate is not a course boundary or course GPS verification.
- Never substitute a town-centre coordinate when a course GPS is missing.
- The weather engine must preserve the selected course identity and requested coordinate in every result.
- Any coordinate promotion requires source URL, verification date, course-property/map review and regression tests.

## Weather coverage

The six-course availability probe is implemented in:
- Script: `scripts/validate-okinawa-course-weather.mjs`
- Workflow: `.github/workflows/okinawa-course-weather-acceptance.yml`
- Report: workflow artifact `okinawa-six-course-weather-acceptance`

The probe requests 16-day hourly/daily forecast fields and 90-day seasonal daily/six-hourly fields at each candidate course point. It records timezone, non-null coverage, returned grid coordinates and shared grid cells. It is a data-availability test, not forecast-accuracy verification.

## Official and reference URLs

- Southern Links: https://reserve.accordiagolf.com/en/global/golfCourse/okinawa/southernlinks/access
- Palm Hills: https://reserve.accordiagolf.com/en/global/golfcourse/okinawa/palmhills/access/
- PGM: https://www.pacificgolf.co.jp/okinawa/information.asp
- Atta Terrace: https://www.terrace.co.jp/atta/information/access.php
- Chura Orchard: https://www.jgmgroup.co.jp/churaorchard/
- Kanehide Kise: https://www.kise-cc.jp/en/
