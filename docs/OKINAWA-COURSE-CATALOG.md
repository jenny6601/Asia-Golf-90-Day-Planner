# Okinawa Main Island Course Catalog — Pilot

Six user-selected courses are catalogued. All addresses are checked against official or tourism/club listings. Coordinates are representative points from third-party map listings and must be independently checked against the official course map or a verified entrance/course polygon before operational use. The current phase adds provenance links and compares each requested coordinate with the forecast provider returned grid point; this grid offset is not proof that the coordinate lies inside the course boundary.

| Course | Zone | Address status | GPS status | Coordinate source |
|---|---|---|---|---|
| The Southern Links Golf Club | South | Official Accordia address | Provisional | FullGolf / OpenStreetMap map listing |
| PGM Golf Resort Okinawa | Central | Official PGM address | Pending | No independently verified course GPS point yet |
| Kanehide Kise Country Club | North | Official club address | Provisional | Travelmyth map listing |
| The Atta Terrace Golf Resort | North | Official club address | Provisional | Where2Golf map listing |
| Palm Hills Golf Resort Club | South | Official Accordia address | Provisional | FullGolf / OpenStreetMap map listing |
| Chura Orchard Golf Club | North | Tourism/club listing address | Provisional | FullGolf / OpenStreetMap map listing |

## Safety and data rules
- The course picker allows up to three courses.
- PGM is temporarily disabled because the GPS point has not been independently verified. Its official street address is recorded.
- Provisional coordinates are usable for prototype forecast comparison only; they are not survey-grade boundaries and should be confirmed before using the weather data for trip ranking.
- The app must not silently substitute city proxy coordinates when a course coordinate is missing.
- Once the PGM point is verified, update the catalog and its source record, then enable its selector.
- For the selected courses, Open-Meteo 16-day forecasts are fetched using each course's own coordinates. Course forecasts remain separate from city-level north/central/south proxy forecasts.

## Verified address references
- Southern Links: https://reserve.accordiagolf.com/en/global/golfCourse/okinawa/southernlinks
- PGM: https://www.pacificgolf.co.jp/okinawa/
- Kanehide Kise: https://www.kise-cc.jp/en/
- Atta Terrace: https://www.terrace.co.jp/en/atta/
- Palm Hills: https://reserve.accordiagolf.com/en/global/golfCourse/okinawa/palmhills/
- Chura Orchard: https://www.okinawa.or.jp/ (use current official course page when available); address also corroborated by Okinawa tourism listings.
## Coordinate source review — 2026-11-23

- PGM Golf Resort Okinawa: official PGM club information confirms the golf-course address as 1043 Fuchaku, Onna. The official PGM hotel access page separately lists the hotel at 1390 Fuchaku; do not substitute the hotel location for the golf-course GPS. A third-party navigation listing reports 26.454972, 127.820007, but it is not an official course-boundary point, so the app continues to keep PGM disabled pending independent verification.
- Kanehide Kise: the official club site confirms 1107-1 Kise, Nago; Travelmyth publishes 26.524415, 127.93946. Keep provisional until checked against the official course map.
- The Atta Terrace: the official resort confirms 1079 Afuso; Where2Golf publishes 26.499693, 127.896228. Keep provisional.
- Palm Hills: Accordia confirms 762 Arakaki; FullGolf publishes 26.11934, 127.701172. Keep provisional.
- Chura Orchard: FullGolf publishes 26.496499, 127.891015; keep provisional.
- Southern Links: Accordia and JNTO confirm the 697 Hanashiro address; the currently stored coordinate remains provisional. A direct coordinate-source URL is not yet independently confirmed.

## Forecast grid audit
For each fetched course forecast, the UI displays the requested coordinate, Open-Meteo returned grid coordinate, their approximate geodesic separation, elevation and timezone. The returned coordinate is a forecast grid point, not the actual golf course boundary. A small offset does not validate the input point; a large offset should trigger review rather than automatic coordinate correction.
