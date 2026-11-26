# Seasonal Daily Data Availability Probe — 2026-11-26

## Purpose and scope

Read-only availability probe of the Open-Meteo Seasonal Forecast API for the three existing Okinawa regional proxy coordinates. This verifies whether daily and native 6-hourly fields are returned for D17–D90. It is not a forecast-skill validation, probability calibration, or change to production scoring.

Workflow: `.github/workflows/seasonal-daily-probe.yml`
Script: `scripts/probe-seasonal-daily.mjs`
Run: https://github.com/jenny6601/Asia-Golf-90-Day-Planner/actions/runs/45817094721
Artifact: `seasonal-daily-data-probe`

## Request

- Endpoint: `https://seasonal-api.open-meteo.com/v1/seasonal`
- Model requested: `ecmwf_seasonal_seamless`
- Forecast length: 90 days
- Time zone: `Asia/Tokyo`
- Native hourly-series interval returned: 6 hours (4 values/day)
- Points: existing north/Nago, central/Okinawa City, south/Naha proxy coordinates

## Results

All three requests returned 90 daily records and 360 six-hourly timestamps, covering 2026-11-26 through 2027-02-23.

| Field group | D17–D46 | D47–D90 | Result |
|---|---:|---:|---|
| Daily weather code | 30/30 | 44/44 | Complete |
| Daily max/min/mean temperature | 30/30 | 44/44 | Complete |
| Daily mean wind speed | 30/30 | 44/44 | Complete |
| Daily mean cloud cover | 30/30 | 44/44 | Complete |
| Daily sunshine duration | 30/30 | 44/44 | Complete |
| 6-hourly precipitation / rain / showers | 120/120 | 176/176 | Complete |
| 6-hourly temperature / apparent temperature | 120/120 | 176/176 | Complete |
| 6-hourly weather code / wind / cloud / humidity | 120/120 | 176/176 | Complete |
| 6-hourly wind gust | 119/120 | 0/176 | Not usable as a D47–D90 field |

The 6-hourly precipitation series can be aggregated by local calendar date to produce a model-derived daily rainfall amount estimate. This remains a seasonal model estimate, not a calibrated daily rain probability. No daily precipitation probability was requested or returned by this probe.

Wind gusts must be omitted from D47–D90; do not silently substitute zero or infer gusts from mean wind speed.

## Spatial-grid limitation

Returned coordinates:

| Requested proxy | Returned grid coordinate |
|---|---|
| North / Nago | 26.557377, 127.956520 |
| Central / Okinawa City | 26.276346, 127.792206 |
| South / Naha | 26.276346, 127.792206 |

The central and south requests resolve to the same model grid coordinate. Therefore these three nominal regional points represent only two unique seasonal model grid cells in this probe. Do not describe the three results as three independent model-grid forecasts or imply the south result has independent spatial resolution.

## Implementation decision

The existing app can be upgraded to show a daily D17–D90 seasonal outlook without inventing daily weather from weekly/monthly averages:

1. Keep the existing D1–D16 forecast unchanged.
2. For D17–D46 and D47–D90, request the API's daily weather code, daily temperature range/mean, daily mean wind and cloud cover, and sunshine duration.
3. Aggregate the native 6-hourly precipitation/rain/showers fields into daily totals using the destination's local date.
4. Display rainfall as a seasonal-model daily amount estimate, never as a precipitation probability.
5. Show a daily golf-playability tendency with an explicit seasonal/low-specificity label. Keep forecast confidence separate from weather tendency.
6. Exclude gust-based scoring after D46 because the field is unavailable.
7. Retain the returned model-grid coordinate and flag duplicated grid cells in regional comparisons.
8. Validate the daily derived fields against hindcast/reforecast data before describing the output as more accurate or calibrating a numeric playability score.

## Limits

- This probe demonstrates API field availability only; it does not establish forecast accuracy.
- The seasonal product is a coarse regional model output, not a course-local forecast.
- The returned 6-hourly values are not hourly tee-time forecasts.
- A daily rainfall amount estimate is not a probability of rain.
- The requested model identifier was recorded; the API response did not return a model field in this probe.
