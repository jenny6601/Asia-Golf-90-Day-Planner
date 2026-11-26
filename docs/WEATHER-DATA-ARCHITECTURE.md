# Okinawa Weather Data Architecture (Phase 2)

## Status and safety
This document defines the provider/data contract. It does not add a live API integration. The browser demo remains synthetic until a separately tested data adapter is implemented. Never display synthetic values as forecasts.

## Decision: three forecast horizons

| Lead time | Primary data | Display semantics | Permitted scoring use |
|---|---|---|---|
| D1-D16 | Open-Meteo Forecast API (multi-model best match or explicitly selected model) | Daily/hourly forecast; retain hourly detail for golf hours | Daily rain/wind/thermal/severe risk, with forecast confidence |
| D17-D46 | Open-Meteo Seasonal API, ECMWF EC46 ensemble | 6-hourly ensemble distribution, weekly summaries/anomalies | Trend-based probability/risk only; no deterministic day-level rainfall amount |
| D47-D90 | Open-Meteo Seasonal API, ECMWF SEAS5 ensemble + JMA Okinawa/Amami seasonal outlook | Monthly/period summaries: wetter/near/ drier than normal; warm/normal/cool | Seasonal prior and climatological comparison only; do not rank individual days by invented rain probabilities |

The Open-Meteo seasonal seamless model transitions from EC46 to SEAS5. For auditability, the adapter should request/record explicit model identifiers and model transition metadata rather than silently mixing values. EC46 is a 46-day ensemble system; SEAS5 is a seasonal ensemble product. Provider documentation states 36 km resolution and 51 ensemble members, with EC46 refreshed daily and SEAS5 monthly. Forecasts are not bias-corrected and should be interpreted as area-scale guidance.

## Cross-check and climatology
- JMA Okinawa/Amami long-range outlook is an independent regional cross-check, expressed as above/near/below-normal categories, not a golf-course daily forecast.
- Use a 1991-2020 climate normal baseline where available. Historical reanalysis/climate data may support monthly rainfall frequency and wet-day climatology; clearly label it as climatology, not forecast.
- Keep JMA outlook category and model ensemble probabilities as separate evidence fields; do not average incompatible categories and millimetre forecasts into one raw value.

## Okinawa regional model
- Preserve three separate zones: north, central, south.
- Each zone must have a documented representative coordinate or course-level coordinate set before production API requests.
- At trip-ranking time, show the equal-weight regional mean AND the worst-zone result. A severe hazard in any zone must not be hidden by averaging.
- Once the user selects three courses, switch from regional proxy points to the actual course coordinates for course-specific analysis.

## Normalized daily/period record
Every provider adapter should emit source-native values plus provenance. Required metadata:
- provider, product, model, model run/issue time, fetched time
- valid_start, valid_end, timezone (Asia/Tokyo), lead_day, temporal_resolution
- ensemble_member or ensemble_summary (when applicable)
- spatial_resolution_km (when known), coordinate, region/course identifier
- variable, value, unit, aggregation_method
- quality flags: missing, stale, partial, model-transition, low-resolution, not-a-daily-forecast

Required weather variables where supported:
- precipitation amount (mm) and precipitation probability (%); never derive one from the other without a documented calibrated method
- rain / showers separately where provider supplies them
- wind speed and gust (m/s), direction (degrees)
- 2m temperature, apparent temperature, relative humidity
- weather code / cloud cover
- severe-weather alerts/hazard flags from authoritative warning sources

## Confidence is not risk
- Weather risk describes expected conditions.
- Data/forecast confidence describes evidence quality: lead time, ensemble spread, agreement, freshness, completeness, spatial resolution, and historical skill.
- Do not set confidence from a fixed lead-time lookup alone. The current date-engine completeness thresholds are prototype placeholders and must be replaced by validated calibration.
- For D47-D90, confidence must explicitly say "seasonal outlook / low daily specificity"; it is not a confidence score for a particular day's rain.

## Rain-risk transformation: not yet approved
Do not map precipitation probability or amount into the date-engine's 0-100 rainRisk until a calibration study is complete. Develop a golf-specific impact function using:
1. probability of measurable rain,
2. expected rain amount and duration during local golf hours,
3. intensity/convective risk,
4. antecedent wetness only if reliable data exist.
Validate against archived forecasts and observations/hindcasts by lead-time band and Okinawa subregion. Preserve the raw source variables beside any derived score.

## API implementation sequence
1. Define and approve representative north/central/south coordinates and course coordinate schema.
2. Implement read-only D1-D16 adapter and validate units/timezone/field availability.
3. Implement EC46 D17-D46 ensemble adapter and period aggregation.
4. Implement SEAS5 D47-D90 seasonal anomaly/probability adapter.
5. Add JMA Okinawa/Amami outlook ingestion as independent corroboration.
6. Build historical hindcast/verification dataset before activating automatic date rankings for booking decisions.

## Current limitation
No live weather API is connected in the application yet. The displayed recommendations remain synthetic demo output.
