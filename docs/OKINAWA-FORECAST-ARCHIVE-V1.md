# Okinawa Forecast Archive V1

## Purpose
Build a persistent, daily retrieval-time archive for the six Okinawa pilot courses. This closes the gap between one-off live API probes and longitudinal forecast-evolution analysis.

## Collection
- Workflow: `.github/workflows/okinawa-daily-forecast-archive.yml`
- Collector: `scripts/archive-okinawa-daily-forecast.mjs`
- Schedule: daily at 18:15 UTC (03:15 next day Japan Standard Time); also supports manual dispatch.
- Scope: six golf-course points plus ten exact JMA AMeDAS station coordinates (schema v2).
- Provider: Open-Meteo Forecast API.
- Requested horizon: 16 days for both course points and station points.
- Station-coordinate forecasts are a separate `stationRecords` collection and must be used for JMA verification; course points must never be substituted for station forecasts.
- Hourly fields: temperature, apparent temperature, relative humidity, precipitation probability, precipitation, weather code, wind speed/direction, gust and cloud cover.
- Daily fields: weather code, precipitation sum/probability maximum, min/max temperature and apparent temperature, max wind and gust.
- Storage: `data/okinawa/forecast-archive/YYYY-MM-DD.json` and matching Markdown summary, committed to the development branch; 90-day workflow artifact is also retained.

## Timestamp semantics
The current Forecast API response does not expose the model initialisation/issue time in the collector contract. Therefore:
- `retrievedAt` means when this system fetched the response.
- It must never be relabelled as provider `issueTime`.
- Valid times are the provider's Asia/Tokyo hourly timestamps.
- Do not calculate true model lead time by subtracting retrievedAt from validTime.
- The archive supports retrieval-to-retrieval forecast evolution and missingness analysis, not strict issue-time forecast verification.

## Future verification
For strict hindcast metrics, use Previous Runs or Single Runs where the provider exposes fixed lead/run identity, or another archive with explicit report/initialisation time. Pair by model/run identity and valid time, then compare with JMA AMeDAS observations. Retain station distance, elevation, observed-element coverage and quality flags.

## Quality gates
- Exactly six expected course IDs must be present.
- Exactly ten configured JMA station IDs must be present in `stationRecords`, in configured order.
- Every station record must have complete required hourly and daily fields.
- Preserve user-supplied course coordinate and provider-returned grid coordinate separately.
- Record all raw hourly/daily arrays, units, model label if returned, retrieval time, and per-field coverage.
- Missing values remain missing; never convert null to zero.
- A partial snapshot is retained for diagnosis, but the workflow collector step is marked failed when required fields are incomplete.
- A successful archive run is evidence of collection and schema completeness only, not forecast accuracy.

## Current limitations
- Forecast API retrieval snapshots are not full original model runs.
- The API may revise forecast values between daily retrievals; this evolution is useful but does not establish accuracy without observed verification.
- Course points and station points may share provider grid cells; returned grid coordinates are retained separately for each record.
- JMA station data are regional proxies, not on-course measurements.
- D19-D90 seasonal outlook remains a separate signal and must not be stored as deterministic daily forecast data.
