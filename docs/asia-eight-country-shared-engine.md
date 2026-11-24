# Asia Golf Weather 90 — Simplified Product Scope

## User flow

1. Select a departure date within the next 90 days.
2. Select a country and one golf course.
3. Select a tee-off time.
4. Generate one weather and golf-playability report for that course and date.

The app is a weather decision aid, not a travel itinerary builder. Do not add hotel planning, multi-course routing, three-round scheduling, date ranking, or country-specific workflows unless explicitly requested.

## Forecast horizons

- Days 1–16: use the selected course's coordinates and IANA timezone to retrieve daily and hourly forecast data. For a selected play date, report daily precipitation probability and amount, temperature range, wind, and the six-hour tee-time rain/playability assessment.
- Days 17–90: use weekly/monthly seasonal forecast signals for the selected course. Clearly label these as broad climate tendencies, not daily weather forecasts. Never invent daily rain probability, daily rainfall, or precise playability grades for this horizon.

Only fetch the forecast horizon needed for the selected date. Missing data remains missing; do not synthesize values.

## Scope

Support only eight Asian markets: Japan (JP), South Korea (KR), China (CN), Vietnam (VN), Thailand (TH), Malaysia (MY), Singapore (SG), and Indonesia (ID).

The shared country and course data live in `config/global/countries.json` and `config/global/courses.json`. Each course carries an IANA timezone and coordinate provenance/status. Pending coordinates remain null and cannot be queried. Provisional course-vicinity coordinates may be used only when clearly labeled.

## Implementation

- `assets/js/course-catalog.js`: shared country/course list.
- `assets/js/course-time.js`: course-local date formatting.
- `assets/js/weather-api.js`: 1–16 day Open-Meteo forecast by selected course.
- `assets/js/long-range-api.js`: 17–90 day weekly/monthly seasonal context by selected course.
- `assets/js/rain-risk.js` and `assets/js/suitability-engine.js`: six-hour tee-time assessment for dates with hourly forecasts.

## Current data coverage

The course catalog currently contains Okinawa, Japan pilot courses. Other Asian country choices remain disabled until actual course records and usable coordinates are added. Do not fabricate course locations.

## Change discipline

Keep one simple PWA and one shared data model. Preserve `main` while the simplified experience is reviewed. Do not create country-specific modules or workflows. Integration testing is a separate step after the architecture is complete.
