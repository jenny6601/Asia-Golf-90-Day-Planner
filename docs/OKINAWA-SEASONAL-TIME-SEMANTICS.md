# Okinawa Seasonal Forecast Time-Semantics Audit

## Purpose
Audit archived Open-Meteo seasonal snapshots for timestamp-label structure and internal array consistency without guessing the provider's weekly/monthly aggregation boundaries.

## What is checked
- Three regional points: north, central, south.
- ISO date label syntax.
- Weekly label spacing (7 days) and monthly label spacing (calendar-month sequence).
- Duplicate labels.
- Alignment of timestamp, precipitation mean/anomaly, and weekly EFI arrays.
- Precipitation units retained with each scale.

## What is not inferred
A seven-day timestamp cadence does not prove whether the timestamp is the start, end, or anchor of the aggregation period. Monthly date labels likewise do not independently prove the exact aggregation boundary. Snapshot retrieval time is not model initialization or issue time.

Open-Meteo's Model Updates documentation distinguishes initialization, modification, and availability timestamps. These are separate metadata fields; the archive must not substitute retrieval time for any of them. The current seasonal snapshot response/archive has not yet been verified to expose a directly retrievable model-specific metadata endpoint for EC46 and SEAS5, so those fields remain unknown.

## Output
- `data/okinawa/seasonal-time-semantics/YYYY-MM-DD.json`
- `data/okinawa/seasonal-time-semantics/YYYY-MM-DD.md`

## Gate
Structural review can pass while skill scoring remains blocked. No accuracy, correlation, hit rate, daily rain probability, or daily rainfall amount is produced.
