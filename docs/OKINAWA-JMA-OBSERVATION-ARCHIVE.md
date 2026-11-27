# Okinawa JMA AMeDAS Observation Archive

## Purpose
Persist the observed side of forecast verification so daily forecast retrieval snapshots can later be paired with actual station observations by identical Asia/Tokyo valid timestamp.

## Collection
- Workflow: `.github/workflows/okinawa-daily-jma-observation-archive.yml`
- Collector: `scripts/archive-okinawa-jma-observations.mjs`
- Schedule: daily at 18:30 UTC (02:30 Taiwan / 03:30 Japan on the following local date).
- Scope: all ten configured Okinawa AMeDAS stations.
- Period: latest seven complete observation dates available from JMA.
- Storage: `data/okinawa/jma-observation-archive/YYYY-MM-DD.json` plus Markdown; 90-day artifact copy.

## Pairing semantics
- Preserve each station's official configured metadata, station ID, location, elevation, observed elements and quality flags.
- Observation timestamps are JMA Asia/Tokyo valid times.
- Only quality 0 and 1 numeric observations are usable under the shared parser.
- Missing observations remain null/unavailable; never replace them with zero.
- This is an observation archive, not a forecast archive. Pairing must later use matching valid timestamps, element compatibility, station-course distance and elevation representativeness.
- Do not infer model issue time or forecast lead from a retrieval timestamp.

## Limitations
- The JMA AMeDAS point JSON endpoint is an undocumented internal feed of the official JMA website and may change.
- Stations are proxies, not on-course sensors.
- A seven-day rolling snapshot is not an independent seven-day sample each day; snapshots overlap. Deduplicate observations by station ID and valid timestamp when building the long-term verification dataset.
- Collection completeness is not forecast accuracy.
