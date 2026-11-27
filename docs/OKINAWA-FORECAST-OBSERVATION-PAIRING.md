# Okinawa Forecast–Observation Pairing

## Purpose
Pair station-coordinate Open-Meteo forecast snapshots with JMA AMeDAS station observations using exact station ID and hourly Asia/Tokyo valid time.

## Forecast station data
The daily Open-Meteo forecast archive now stores two distinct collections:
- Six user-supplied golf-course forecast points for course use.
- Ten JMA station-coordinate forecast points for observation verification.

Station-coordinate forecasts are requested at the exact configured JMA station coordinates. Course-point forecasts must not be substituted for station forecasts.

## Pairing
- Script: `scripts/build-okinawa-forecast-observation-pairs.mjs`
- Workflow: `.github/workflows/okinawa-forecast-observation-pairing.yml`
- Daily schedule: 18:50 UTC (02:50 Taiwan / 03:50 Japan next local date).
- Match exact station ID and exact hourly Asia/Tokyo valid timestamp.
- Only numeric JMA observations with quality 0 or 1 are accepted.
- Pair temperature, precipitation, wind speed and exploratory gust.
- Pair precipitation probability against observed wet-hour event (JMA precipitation1h >= 0.1 mm); report Brier score.

## Timestamp semantics
Forecast API model issue time is unavailable. The field `leadHours` is explicitly retrieval-to-valid-time age, not model issue-time lead. No model lead claim is permitted from this field.

## Metrics
Group by station, returned model label, retrieval-age bucket and variable. Continuous variables report N, MAE, bias and RMSE. Rain probability reports N and Brier score. Gust is exploratory because JMA gust semantics differ from model hourly gust.

## Guardrails
- Forecast/observation matching is station-grid, not on-course validation.
- Rolling observation archives overlap; deduplicate by station ID and valid time.
- Open-Meteo and JMA hourly precipitation interval boundaries require confirmation before strict rain-error interpretation.
- Pairing and diagnostic metrics do not alter production suitability thresholds.
