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

## Weather and playability report — match Taiwan Golf Weather PWA V32.3

The selected-course report should follow the established Taiwan PWA information hierarchy and scoring semantics, adapted to the Asia course coordinates and local timezone.

### Report order

1. Tee-time weather summary: overall weather description, minimum–maximum hourly precipitation probability, and minimum–maximum feels-like temperature for the selected analysis window.
2. Golf playability analysis: overall 0–100 score, A–E grade, five weighted factors, safety alerts, and the three best continuous four-hour tee-time windows when sufficient data exists.
3. Rainfall special report: cumulative rainfall, minimum and maximum hourly precipitation probability with times, maximum single-hour rainfall, longest consecutive wet period, and source spread when multiple independent sources are available.
4. Temperature special report: minimum and maximum feels-like temperature, hours at or below 15°C and 10°C, and source spread when available.
5. Hourly forecast table: time, weather icon/condition, precipitation probability, rainfall amount, five-level rain interpretation, air temperature, feels-like temperature, wind speed, gust, wind direction, humidity, cloud cover and UV when the source supplies them.
6. Charts: hourly precipitation probability, hourly rainfall amount, and air-temperature/feels-like temperature curves.
7. Sixteen-day daytime forecast: horizontally scrollable daily cards for 06:00–18:00, including weather condition, high/low temperature, feels-like temperature, precipitation probability and accumulated rainfall. Selecting a day synchronizes the hourly report.

### Playability scoring baseline

Use the Taiwan PWA's transparent baseline weights:
- Rainfall risk: 50%
- Wind speed and gust: 15%
- Air temperature and feels-like temperature: 15%
- Weather stability: 10%
- Visibility: 10%

Normalize only available factors; never turn missing values into zero. Display the percentage of total weight that could actually be evaluated. Grades: A ≥90, B ≥80, C ≥65, D ≥50, E <50. Safety overrides take precedence over the numeric score: thunderstorm signals force E; forecast cumulative rainfall ≥5 mm or average wind ≥25 km/h or maximum gust ≥40 km/h caps the grade at D.

The rainfall factor uses maximum hourly precipitation probability (60%) and cumulative rainfall (40%). Temperature comfort uses the Taiwan PWA thresholds: 20–27°C feels-like is optimal; 15–20°C or 27–30°C is mildly penalized; 10–15°C or 30–33°C is further penalized; outside those ranges receives the lowest baseline temperature score. Wind, stability and visibility follow the same transparent factor calculations as the Taiwan PWA.

### Forecast horizon adaptation

The full Taiwan PWA-style daily/hourly tables and charts apply only where actual hourly/daily forecast data is available (normally the first 16 days). For days 17–90, retain the separate weekly/monthly seasonal-trend report and do not fabricate hourly charts, daily rain probability, daily rainfall or A–E playability scores. When multiple independent forecast providers are integrated, show source coverage and spread; do not count two products derived from the same model as independent sources.
