# Phase 10.1 — The Southern Links official GPS verification

## Result
The Southern Links Golf Club is the first Okinawa pilot course whose location pin is marked verified.

- Course: The Southern Links Golf Club (ザ・サザンリンクスゴルフクラブ)
- Official address: 697 Hanashiro, Yaese-cho, Shimajiri-gun, Okinawa 901-0513, Japan
- Timezone: Asia/Tokyo
- Official map pin (WGS84): latitude 26.114086000297586, longitude 127.73689211539313
- Verification date: 2026-11-24
- Status: verified (official club access-page embedded Google Maps location pin)

## Evidence
The official Accordia Golf access page lists the course address and embeds a Google Maps iframe. The iframe's map parameters resolve to the coordinates above.

- Official access page: https://reserve.accordiagolf.com/en/global/golfCourse/okinawa/southernlinks/access
- Official club information: https://www.accordiagolf.com/en/grand/southernlinks/information.php

## Coordinate interpretation
The coordinates represent the official map location pin exposed by the club's access page. They are not claimed to be a surveyed course centroid, course polygon, or individual tee/green positions. The prior third-party representative coordinate (26.118019, 127.738385) was replaced and is no longer used.

## Catalogue impact
Okinawa pilot catalogue: 6 courses; 1 verified, 4 provisional, 1 pending.
Japan catalogue: 19 courses; 2 forecast-ready, 6 provisional, 11 pending. The other forecast-ready course is Hokkaido Brooks Country Club, outside the active Okinawa pilot scope.

## Forecast readiness
The course now passes the schema's GPS forecast-readiness gate. This only permits a provider forecast request using the official location pin; it does not prove forecast accuracy or provider reliability. Provider availability remains independently pending until each provider is tested with this verified coordinate.

## Next validation
Run Open-Meteo, Visual Crossing, and Foreca independently for this one verified location. Preserve each provider's issue time, local valid time, units, precipitation accumulation interval, and missing values. Do not write production cache or make booking recommendations until normalized data quality is reviewed.
