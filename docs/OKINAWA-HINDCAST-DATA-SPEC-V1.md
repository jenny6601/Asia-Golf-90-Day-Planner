# Okinawa Golf Weather Hindcast — Data Specification V1

## Purpose
Validate forecast skill and golf-playability thresholds for the Okinawa Main Island pilot. This is a verification design, not a claim that calibration has already been completed.

## Dataset roles — do not mix

| Dataset | Role | Valid use | Invalid claim |
|---|---|---|---|
| Open-Meteo Historical Weather (ERA5 / ERA5-Land / IFS analysis) | Reanalysis reference / climatology proxy | Seasonal distributions, historical weather context, threshold sensitivity | Not an archived forecast; cannot measure what a forecast said days earlier |
| Open-Meteo Historical Forecast | Continuous archived model output | Historical forecast-like sequence and post-processing research | Stitched initial hours are not a full original forecast run |
| Open-Meteo Previous Runs | Fixed forecast lead-time series | Skill evaluation at fixed lead-time offsets of 1–7 days | Does not provide full run structure or fixed 8–16 day lead fields |
| Open-Meteo Single Runs | Individual archived model initialisations | Reconstruct a specific forecast issue/run and full forecast horizon | Archive coverage differs by model; must verify run availability and matching valid times |

Official documentation:
- Historical Weather: https://open-meteo.com/en/docs/historical-weather-api
- Historical Forecast: https://open-meteo.com/en/docs/historical-forecast-api
- Previous Runs: https://open-meteo.com/en/docs/previous-runs-api
- Single Runs: https://open-meteo.com/en/docs/single-runs-api

## Geographic scope
- Okinawa Main Island only; exclude Miyakojima and Ishigaki.
- Retain north / central / south regional representation.
- Course-level samples must preserve catalog GPS status (provisional, pending, verified). Do not treat provisional coordinates as surveyed course locations.
- PGM remains excluded until its course GPS is independently verified.
- Do not average regional precipitation signals in a way that hides a wet local area; report the worst relevant zone separately.

## Required sample schema
Each paired sample must include:
- courseId or zoneId; latitude, longitude, coordinateStatus
- validTime in ISO-8601 and timezone
- issuedAt / model run initialisation time (UTC); leadHours (valid time minus issue time)
- model, modelVersion if supplied, dataset
- forecast values: precipitation amount, precipitation probability (if available), temperature, apparent temperature, wind speed, gust, weather code
- verification values for the same valid time: precipitation, temperature, apparent temperature, wind speed, gust, weather code or explicitly defined event label
- data provenance, retrieval time, missing-data flags

Never pair samples solely by array index. Join on valid time, location and model/run identity as appropriate. Keep UTC issue time and Japan local valid time explicit.

## Evaluation windows and metrics
### Lead time
- 1–3 days
- 4–7 days
- 8–16 days (only where a true archived run and matched verification are available)
- >16 days: seasonal outlook evaluation only; do not label as deterministic daily forecast verification.

Previous Runs API documents fixed lead offsets from 1 to 7 days. For 8–16 day run-level testing, use Single Runs where model coverage and forecast horizon support it. Do not infer missing lead times.

### Metrics
- Continuous variables: MAE, mean bias (forecast minus verification), RMSE.
- Precipitation probability: Brier score; only if a calibrated probability forecast exists and observed rain event definition is fixed in advance.
- Rain event: POD, FAR, CSI from a contingency table. Define the rain threshold before analysis and keep it consistent.
- Golf suitability: confusion matrix / sensitivity and false-alarm rate for each grade after playability threshold rules are frozen.
- Stratify by lead time, month/season, north/central/south, and coastal/course point. Publish sample count (n) alongside every score.

## Golf-specific verification protocol
1. Define a 6-hour tee-time window and rain-event threshold before collecting samples.
2. Compare forecast 6-hour maximum/minimum rain probability and accumulated precipitation with verification over exactly the same local-time window.
3. Verify wind and gust thresholds using maximum hourly values during the same window.
4. Verify apparent-temperature thresholds using minimum and maximum values during the same window.
5. Thunderstorm verification must use an explicit observed event definition; WMO forecast code alone is not ground truth.
6. Evaluate worst-hour / worst-zone decision rules separately from regional averages.
7. Keep existing suitability thresholds marked provisional until hindcast results support a change.

## Data-quality gates
- Reject samples with missing issue time, valid time, lead time, or mismatched valid-time pairing.
- Never silently replace missing course coordinates with town-centre coordinates.
- Keep API grid coordinates and their offset audit as separate metadata; a grid point is not a course-boundary validation.
- Check model archive availability before bulk collection. Model start dates and variables vary.
- Record model changes/version boundaries; do not pool across major model changes without stratification.
- Report data coverage and missingness before calculating skill scores.

## Implementation status
V1 adds pure metric functions and tests only. It does not yet call external archive APIs, download historical samples, or produce empirical accuracy claims. Next: probe API availability for representative north/central/south coordinates and two seasons, then build a reproducible sample collector with cached raw responses and provenance.

## Live API availability probe — 2026-11-23

A GitHub Actions probe queried north / central / south representative proxy coordinates against the Open-Meteo archive endpoints. The tested model selectors were ECMWF IFS for Single Runs and ECMWF IFS 0.25 for Previous Runs.

| Endpoint / sample | Result | Available fields |
|---|---|---|
| Previous Runs, 2025-08-01 to 2025-08-07, all 3 zones | HTTP 200; 168 hourly timestamps per zone | temperature, apparent temperature, precipitation and 10 m wind speed are non-null for day 1; precipitation and wind speed are non-null for day 3 and day 7 |
| Previous Runs, 2025-01-15 to 2025-01-21, all 3 zones | HTTP 200; 168 hourly timestamps per zone | Same tested fields are non-null for day 1, day 3 and day 7 |
| Single Runs, ECMWF IFS, 2025-08-01 00 UTC, all 3 zones | HTTP 200; 360 hourly timestamps per zone | temperature, apparent temperature and wind speed: 360 non-null; precipitation and gusts: 359 non-null |
| Single Runs, ECMWF IFS, 2026-05-01 00 UTC, all 3 zones | HTTP 200; 360 hourly timestamps per zone | Same counts as above |

Interpretation:
- The Previous Runs API is technically usable for a first 1–7 day skill dataset for the tested ECMWF IFS 0.25 selector and both tested seasonal windows.
- wind_gusts_10m_previous_day variables returned all-null values in this probe. Do not include archived gust verification until a supported model/variable combination is found.
- Single Runs is available for the tested 2025 and 2026 IFS run dates and returns a 15-day hourly horizon (360 timestamps). This provides a route to evaluate lead times through day 15, not a verified day-16 forecast.
- The one null precipitation/gust value per 360-hour response must be handled as missing data; do not impute it.
- These are representative regional proxy coordinates, not the six golf-course points. The current course catalog still has provisional GPS points and PGM pending.
- HTTP 200 alone is insufficient: the probe now checks non-null value counts and classifies HTTP 200 / all-null as unavailable.

Probe workflow: .github/workflows/hindcast-api-probe.yml. Raw JSON and Markdown reports are uploaded as the okinawa-hindcast-api-probe workflow artifact. This probe verifies endpoint coverage only; it does not calculate forecast skill or compare forecasts with observations.

## First paired pilot dataset — 2026-11-23

The first collection workflow successfully paired ECMWF IFS 0.25 Previous Runs with ERA5 hourly reanalysis for four seven-day windows (15–21 January, April, July and October 2025), three regional proxy coordinates, and 1-, 3- and 7-day lead offsets.

- Total paired forecast-valid-time-lead rows: 6,048.
- Each zone/window: 168 hourly valid times × 3 lead offsets = 504 rows.
- Each lead/zone aggregate: n = 672.
- Rain event definition: hourly precipitation >= 0.1 mm.
- Forecast variables scored: 2 m temperature, precipitation amount and 10 m wind speed.
- Verification reference: ERA5 reanalysis; this is a modelled reference, not a rain-gauge or on-course observation.

### Pilot metrics

| Lead | Zone | n | Temperature MAE (°C) | Precipitation MAE (mm/h) | Wind MAE (m/s) | Rain POD | Rain FAR | Rain CSI |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 day | North | 672 | 1.32 | 0.30 | 2.57 | 0.80 | 0.35 | 0.56 |
| 1 day | Central | 672 | 1.34 | 0.25 | 2.54 | 0.76 | 0.36 | 0.53 |
| 1 day | South (Itoman proxy) | 672 | 1.40 | 0.27 | 2.57 | 0.73 | 0.38 | 0.51 |
| 3 days | North | 672 | 1.22 | 0.25 | 2.59 | 0.65 | 0.48 | 0.40 |
| 3 days | Central | 672 | 1.27 | 0.29 | 2.63 | 0.64 | 0.49 | 0.40 |
| 3 days | South (Itoman proxy) | 672 | 1.32 | 0.29 | 2.70 | 0.60 | 0.52 | 0.37 |
| 7 days | North | 672 | 1.24 | 0.24 | 2.62 | 0.70 | 0.41 | 0.47 |
| 7 days | Central | 672 | 1.24 | 0.25 | 2.65 | 0.73 | 0.46 | 0.45 |
| 7 days | South (Itoman proxy) | 672 | 1.28 | 0.26 | 2.67 | 0.72 | 0.47 | 0.44 |

### Data interpretation and quality warnings

1. The temperature and precipitation scores are preliminary diagnostics against ERA5, not against station observations.
2. Wind speed has a large negative bias (approximately -2.5 m/s in all zones and lead bands). This needs a dedicated unit, variable-definition, grid and model-version audit before any wind threshold is changed.
3. The 3-day rain CSI is lower than the 1-day and 7-day values in this small sample. Do not interpret this non-monotonic pattern as evidence that 7-day forecasts are intrinsically better; four isolated seasonal weeks are not a representative annual sample.
4. The returned model grid coordinates for the central and southern proxy points both resolve to 26.25, 127.75; they are not independent spatial grid cells. Regional comparison must therefore not claim three independent forecast grid cells. North resolves to 26.50, 128.00.
5. No precipitation probability was archived in this collection, so no Brier score is calculated. Gusts were omitted because the tested Previous Runs gust fields were null.
6. Apparent temperature is stored only when supplied by the forecast API; it is not scored because the ERA5 verification pair was restricted to variables explicitly collected and paired.
7. The dataset is a pilot only. It must not recalibrate production rain-risk or playability thresholds.

The collection workflow writes the paired dataset, summary Markdown, and raw API responses to the `okinawa-hindcast-pilot-dataset` GitHub Actions artifact. The artifact is the reproducible source for the figures above.
