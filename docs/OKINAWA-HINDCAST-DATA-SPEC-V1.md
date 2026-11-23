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
