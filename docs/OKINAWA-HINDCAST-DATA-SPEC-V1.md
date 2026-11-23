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

## Grid-cell and wind audit — next validation gate

A dedicated reproducible diagnostic has been added:
- Script: `scripts/audit-okinawa-grid-wind.mjs`
- Workflow: `.github/workflows/okinawa-grid-wind-audit.yml`
- Artifact: `okinawa-grid-wind-audit`

The audit tests five southern/central/northern proxy candidates across winter and summer windows. For every point it records:
- requested proxy coordinate versus the forecast API returned grid coordinate;
- ERA5 returned grid coordinate and elevation;
- API hourly units for wind speed;
- paired wind sample count, MAE, bias, forecast mean and ERA5 mean;
- raw sample values to make the comparison reproducible.

The candidate south points are diagnostic only. No candidate is adopted as the final southern regional proxy until its returned model grid is distinct and its geographic relevance is reviewed. If a separate southern grid cell cannot be obtained at the selected model resolution, the analysis must explicitly report two independent grid cells rather than presenting three nominal zones as independent.

Wind-speed bias must not be corrected by adding an offset or changing suitability thresholds. First confirm unit metadata, returned grid alignment, sample pairing, and raw values. ERA5 remains a reanalysis reference proxy, not direct on-course truth.

After this gate, expand the paired hindcast sample across all 12 months of 2025, stratify by month and lead, and retain missingness and unique-grid counts in every report. The existing production risk and playability thresholds remain frozen until a larger, appropriately verified dataset supports recalibration.

## Grid and wind audit results — 2026-11-23

The dedicated diagnostic workflow completed successfully (GitHub Actions run 45105525786; artifact `okinawa-grid-wind-audit`).

- Four southern candidate points were tested, along with central and north reference points, in January and July 2025.
- All four southern candidates returned the same ECMWF forecast grid cell: 26.25, 127.75. They therefore do not provide an independent southern grid cell at this model resolution.
- Central also returned 26.25, 127.75. North returned 26.50, 128.00. The tested points therefore resolve to two unique forecast grid cells, not three.
- Forecast and ERA5 hourly wind units both explicitly report m/s. A simple unit mismatch is not supported by this diagnostic.
- Wind bias remains negative in both seasons and across the two grid areas: roughly -3.2 to -3.4 m/s in January and -2.3 to -2.5 m/s in July. The bias is not isolated to the southern proxy.
- For the southern candidates, the Previous Runs forecast grid latitude was 26.25 while the ERA5 grid latitude was 26.00. This spatial grid mismatch is an additional pairing limitation. The central and northern tested grid coordinates aligned between the two endpoints.

Interpretation: the audit rules out a basic m/s versus km/h mismatch but does not establish the cause of the wind bias. Differences in model representation, grid sampling, model version, or other processing remain possible. Do not apply a constant wind correction or change production playability thresholds based on this result.

The paired-data collector has now been expanded from four seasonal weeks to one seven-day mid-month window in each of the 12 months of 2025. This improves month coverage but is still a sampled hindcast, not a complete annual record. The report now records unique forecast grid count and forecast/ERA5 grid coordinates per zone-window.

## Expanded 12-month paired sample — 2026-11-23

The expanded collector completed successfully (GitHub Actions run 45105600576; artifact `okinawa-hindcast-pilot-dataset`).

- 12 windows: the 15th–21st of each month in 2025.
- 3 nominal regional proxies × 12 windows × 168 valid hours × 3 lead offsets.
- Total: 18,144 forecast-valid-time-lead rows.
- All 36 zone-window requests completed; no coverage request failed.
- Each lead/nominal-zone aggregate: n = 2,016.
- Only two unique ECMWF forecast grid cells were returned: north 26.50, 128.00; central and south both 26.25, 127.75.
- ERA5 grid coordinates match north and central, but the south proxy resolves to ERA5 latitude 26.00 while the Previous Runs forecast grid resolves to 26.25. South forecast-versus-ERA5 scores therefore include a spatial grid mismatch and must be treated cautiously.

### Expanded sample diagnostics

| Lead | Nominal zone | n | Temperature MAE °C | Precipitation MAE mm/h | Wind MAE m/s | Wind bias m/s | Rain POD | Rain FAR | Rain CSI |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1d | North | 2,016 | 1.19 | 0.21 | 2.41 | -2.33 | 0.67 | 0.44 | 0.44 |
| 1d | Central | 2,016 | 1.31 | 0.19 | 2.36 | -2.27 | 0.64 | 0.45 | 0.42 |
| 1d | South proxy | 2,016 | 1.40 | 0.20 | 2.41 | -2.32 | 0.62 | 0.44 | 0.42 |
| 3d | North | 2,016 | 1.19 | 0.22 | 2.42 | -2.32 | 0.59 | 0.55 | 0.34 |
| 3d | Central | 2,016 | 1.30 | 0.21 | 2.38 | -2.27 | 0.53 | 0.55 | 0.32 |
| 3d | South proxy | 2,016 | 1.36 | 0.20 | 2.44 | -2.32 | 0.51 | 0.55 | 0.31 |
| 7d | North | 2,016 | 1.22 | 0.21 | 2.54 | -2.34 | 0.59 | 0.59 | 0.32 |
| 7d | Central | 2,016 | 1.30 | 0.20 | 2.53 | -2.29 | 0.58 | 0.56 | 0.34 |
| 7d | South proxy | 2,016 | 1.35 | 0.20 | 2.56 | -2.33 | 0.56 | 0.55 | 0.33 |

Interpretation:
1. Wind bias remains consistently around -2.27 to -2.34 m/s across all lead bands and nominal zones. Both endpoints declare m/s, so a basic unit mismatch is not supported. This still does not prove which model or processing difference causes the bias.
2. The 3-day and 7-day rain CSI are lower than the 1-day values in this sampled dataset. This is a useful diagnostic, not a claim of universal lead-time skill.
3. The 12 monthly windows improve seasonal coverage over the first four-week pilot, but each month still contributes only one seven-day window. Do not call this a full-year hindcast.
4. Central and south are not independent spatial forecast cells. Do not count their identical grid data as independent evidence or average the nominal zone metrics as if there were three independent locations.
5. No production rain-risk or playability thresholds were changed.

The full JSON, Markdown report, and raw API responses are retained in the workflow artifact. The artifact is the reproducible data source for this table.
