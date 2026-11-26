# Okinawa 6-hour Tee-time Multi-model Validation V1

## Purpose
Evaluate archived multi-model hourly forecasts in the same six-hour local-time windows used by the golf tee-time playability workflow. This is a partial hindcast validation, not a production calibration.

## Fixed window definition
- Timezone: Asia/Tokyo.
- Tee-off hours: 06:00 through 13:00 inclusive.
- Each window contains exactly six hourly samples: tee-off hour through tee-off +5 hours.
- Example: 07:00 tee-off uses 07:00, 08:00, 09:00, 10:00, 11:00 and 12:00.
- Each hourly value is paired by its valid-time string. No interpolation or gap filling.
- A window is rejected if any of the six hours is absent or if forecast/reference precipitation or 10 m wind is missing in any hour.

## Metrics
For every model, proxy point and lead:
- Six-hour accumulated precipitation: sum of the six hourly precipitation values; continuous MAE and bias.
- Rain event sensitivity thresholds: >=0.1, >=1 and >=5 mm per six hours. These are exploratory thresholds, not operational cut-offs.
- Event metrics: hit, miss, false alarm, correct negative, POD/recall, FAR, CSI, precision and F1.
- Six-hour maximum hourly 10 m wind: maximum of six hourly values; continuous MAE and bias.
- Monthly and tee-time stratification includes sample counts and grid-alignment counts.
- Overall confidence intervals use a deterministic 500-replicate cluster bootstrap, resampling complete local dates so all eight tee-time windows from a selected date remain together. These intervals describe this sampled archive and do not remove ERA5 or spatial-representation limitations.

## Scope and interpretation
- Input is the paired multi-model hourly hindcast report produced by `collect-okinawa-multimodel-hindcast.mjs`.
- Models are evaluated only at lead times with actual non-null paired values. ICON has no day-7 score.
- Spatial proxies remain north and central-south shared proxy. Do not present central and south as independent cells.
- ERA5 is a reanalysis reference proxy, not a rain-gauge, station or on-course observation.
- The expanded archive sample uses two seven-day windows per month in 2025 (1st–7th and 15th–21st). It does not cover every day of the year.
- Different model grids and ERA5 native-grid snapping remain a representativeness limitation.

## What is not validated
The archived collector does not provide a complete matched verification set for gust, apparent temperature and observed thunderstorm events. Therefore this phase evaluates rainfall accumulation and 10 m wind only. It does not validate the complete four-grade suitability score, nor its cancellation implications.

## Production guardrails
- Do not select a production model from this pilot alone.
- Do not alter rain-risk or suitability thresholds, apply wind-bias correction, or change production ranking.
- Do not merge 0–100 short-range rain probability with long-range ordinal seasonal tendency.
- Publish sample count, rejected-window count and grid-alignment count with every score.

## Implementation
- Evaluator: `scripts/evaluate-okinawa-6h-playability.mjs`
- Expanded collection: two sampled weeks per month; not a continuous annual archive.
- Confidence intervals: date-cluster bootstrap (500 replicates), overall model / proxy / lead groups.
- Tests: `tests/6h-playability.test.js`
- Workflow: `.github/workflows/okinawa-6h-playability.yml`
- Artifact: `okinawa-6h-playability-validation`
