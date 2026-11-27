# Okinawa Complete Acceptance V1 — Six Main-Island Golf Courses

## Objective

Complete the Okinawa pilot before adding any other region. This phase is data and weather-engine verification only. Do not change App layout, page structure, navigation, visual design, or the existing forecast/report architecture.

## Fixed scope

The six courses are:
1. The Southern Links Golf Club — Yaese, south
2. Palm Hills Golf Resort Club — Itoman, south
3. PGM Golf Resort Okinawa — Onna, central
4. The Atta Terrace Golf Resort — Onna, north
5. Chura Orchard Golf Club — Onna, north
6. Kanehide Kise Country Club — Nago, north

The current coordinate source is `config/okinawa/course-coordinate-candidates.json`; it is synchronized with `config/global/courses.json` and `assets/js/okinawa-courses.js`.

## Current course GPS — user-provided Google Maps coordinates

On 2026-11-27, the user supplied the following six Google Maps coordinates. These exact values now supersede earlier candidate coordinates and are synchronized across the candidate, global runtime and pilot JavaScript catalogs.

| Course | Latitude | Longitude | Coordinate source |
|---|---:|---:|---|
| The Southern Links | 26.113785 | 127.739021 | User-provided Google Maps |
| Palm Hills | 26.120580 | 127.699640 | User-provided Google Maps |
| PGM Golf Resort Okinawa | 26.455335 | 127.820344 | User-provided Google Maps |
| Kanehide Kise | 26.524228 | 127.939192 | User-provided Google Maps |
| The Atta Terrace | 26.499868 | 127.896002 | User-provided Google Maps |
| Chura Orchard | 26.506260 | 127.895720 | User-provided Google Maps |

All six records now have `coordinateStatus: user_provided_google_maps`, source attribution `User-provided Google Maps coordinate (2026-11-27)`, timezone `Asia/Tokyo`, and runtime `enabled: true`.

The previous PGM null-GPS safeguard is no longer applicable because the user supplied a PGM point. The older third-party coordinates and prior official map-link coordinates remain historical audit references only; they must not overwrite the current user-supplied points.

This status accurately records the source of the values. It does not claim an independent land survey or course-boundary polygon validation.

## Existing meteorological work — what is already available

### 1. Short-range and 6-hour golf-window hindcast pilot

The existing V1 hindcast work:
- Compared ECMWF IFS, NCEP GFS, JMA GSM, JMA Seamless, CMA GRAPES and DWD ICON against ERA5 reanalysis.
- Expanded the sample to 12 mid-month seven-day windows in 2025.
- Evaluated precipitation amount, temperature, 10 m wind and six-hour tee-time windows at north and central/south proxy locations.
- Found only two independent forecast grid cells among the three nominal regional proxies: north 26.50, 128.00; central and south both 26.25, 127.75.
- Found a persistent negative wind-speed bias in the sampled comparisons, approximately -2.27 to -2.34 m/s for ECMWF in the expanded 1/3/7-day sample.
- Used ERA5 as a reanalysis reference proxy, not station or on-course truth.

This pilot is useful for identifying model and grid issues. It is not a production accuracy calibration. It does not verify the full suitability grade, gusts, apparent temperature, or observed thunderstorm events.

Detailed source: `docs/OKINAWA-HINDCAST-DATA-SPEC-V1.md` and `docs/OKINAWA-6H-PLAYABILITY-VALIDATION-V1.md`.

### 2. Seasonal / 19–90 day estimate

The current seasonal engine:
- Uses Open-Meteo ECMWF seasonal daily and 6-hourly data.
- Uses historical same-calendar-day statistics as an analogue.
- Blends seasonal and historical values for high/low temperature and rainfall amount.
- Does not provide or invent daily precipitation probability for the seasonal horizon.
- Marks 19–90 day values as experimental tendency estimates, not deterministic daily forecasts.

The existing availability probe uses three regional proxies. The Okinawa acceptance probe added here requests the same seasonal fields at each of the six course candidate points and records returned model grid cells separately.

### 3. C3S spatial-method comparison

The retained C3S file `okinawa_c3s_spatial_method_comparison.csv` compares four initialization times across 90 forecast days and three spatial methods:
- `all6`: six-point GRIB area mean; baseline candidate
- `near2`: nearest-two-point mean; sensitivity comparison
- `p3`: single-point method; sensitivity comparison

Recorded mean daily precipitation amounts were approximately 7.07, 7.13 and 7.35 mm/day respectively; mean absolute differences from all6 were approximately 1.14 mm/day for near2 and 1.58 mm/day for p3. This is a spatial-method comparison, not a forecast-versus-observation skill score. Retain all6 as the baseline spatial method and near2/p3 as sensitivity checks until a proper hindcast/observation validation is completed.

## New automated six-course data-availability gate

Script: `scripts/validate-okinawa-course-weather.mjs`  
Workflow: `.github/workflows/okinawa-course-weather-acceptance.yml`  
Test: `tests/okinawa-course-weather-acceptance.test.js`  
Output artifact: `okinawa-six-course-weather-acceptance`

For each of the six candidate coordinates the workflow requests:

### 16-day course forecast
- Hourly temperature, apparent temperature, relative humidity, precipitation probability, precipitation amount, weather code, wind speed/direction, gust, cloud and UV.
- Daily weather code, rainfall amount, maximum precipitation probability, min/max temperature, apparent temperature, wind and gust.
- Returned grid coordinate, elevation, timezone and non-null coverage.

### 90-day seasonal fields
- Daily weather code, temperature max/min/mean, wind mean, cloud mean and sunshine duration.
- Six-hourly precipitation, rain/showers, temperature, apparent temperature, weather code, wind, gust, cloud and humidity.
- Separate coverage for D17–46 and D47–90.
- Explicit confirmation that seasonal rain probability is not available/assumed.

### Grid integrity
The report groups provider-returned grid coordinates. Multiple courses resolving to the same model grid cell are not counted as independent meteorological locations. The candidate course point and provider grid point are stored separately.

### Pass criteria
- Exactly six course IDs and six candidate coordinate records.
- All candidates use valid Okinawa coordinate ranges and Asia/Tokyo.
- Six of six forecast requests return at least 16 daily dates, at least 360 hourly timestamps and at least 95% coverage for core forecast fields.
- Six of six seasonal requests return at least 90 daily dates, at least 350 six-hourly timestamps and at least 90% coverage for core seasonal fields.
- Returned timezone is Asia/Tokyo for every course.
- Every error, missing field and shared grid is explicitly reported; no missing value is converted to zero.

A successful availability gate means the provider data is technically available and structurally complete. It does not mean the forecast is accurate.

## Required next accuracy-validation gate

After the six-course availability probe:
1. Preserve the six user-supplied Google Maps coordinates as the operational course points; if a future discrepancy is found, compare it against the actual course property/map before changing any coordinate.
2. Find the nearest suitable JMA AMeDAS/official observation stations for rainfall, temperature and wind. Record station ID, distance, elevation difference and exposure limitations.
3. Collect archived forecast runs at fixed issue times and leads; do not use ERA5 as if it were the original forecast.
4. Pair each forecast and observed value by course/zone, valid time, issue time and lead. Never pair by array index.
5. Evaluate rainfall amount (MAE, bias, RMSE), rain probability (Brier score only when a true probability exists), event POD/FAR/CSI, temperature, wind and gust.
6. Evaluate exact six-hour tee-time windows (06:00–13:00 tee-off; tee hour through +5h) with missing-hour rejection and no interpolation.
7. Stratify by north/central/south, month, season, model and lead band. Publish n, coverage, grid cell and station distance.
8. Only after sufficient observation-paired evidence may model weights, wind handling, rain thresholds or playability thresholds be reconsidered.

## Non-negotiable scope constraints

- Do not change App layout, page structure, navigation, visual style or forecast/report architecture.
- Do not expand beyond the six Okinawa courses during this acceptance phase.
- Do not silently replace a missing course coordinate with a town-centre proxy.
- Do not label a seasonal estimate as daily rain probability.
- Do not call ERA5 reanalysis an observed on-course truth.
- Do not change production risk thresholds or choose a production model from the current pilot alone.
- Keep all work on the Asia development branch and validate through Cloudflare Preview before any production promotion.

## Official and reference sources

- Southern Links official Accordia access page: https://reserve.accordiagolf.com/en/global/golfCourse/okinawa/southernlinks/access
- Southern Links course listing coordinate: https://www.fullgolf.com/en/golf-course/japan/okinawa/shimajiri/southern-links
- Palm Hills official Accordia access page: https://reserve.accordiagolf.com/en/global/golfcourse/okinawa/palmhills/access/
- Palm Hills MapFan coordinate listing: https://mapfan.com/spots/SCC3I%2CJ%2CT
- PGM official golf course information: https://www.pacificgolf.co.jp/okinawa/information.asp
- Atta Terrace official access/map page: https://www.terrace.co.jp/atta/information/access.php
- Chura Orchard official course site: https://www.jgmgroup.co.jp/churaorchard/
- Kanehide Kise official course site: https://www.kise-cc.jp/en/
- Open-Meteo Forecast API: https://open-meteo.com/en/docs
- Open-Meteo Seasonal API: https://open-meteo.com/en/docs/seasonal-forecast-api
- Open-Meteo Previous Runs API: https://open-meteo.com/en/docs/previous-runs-api
- Japan Meteorological Agency AMeDAS: https://www.jma.go.jp/bosai/amedas/
