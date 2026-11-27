# Okinawa Model Source Reliability Ranking

## Data source
Daily archived Previous Runs API comparisons for ECMWF IFS 0.25°, JMA GSM and JMA MSM against JMA AMeDAS station observations.

## Daily persistence
- Collector: `scripts/validate-okinawa-jma-observations.mjs`
- Archive: `data/okinawa/model-hindcast-archive/YYYY-MM-DD.json`
- Schedule: 19:10 UTC (03:10 Taiwan time).
- Each report contains fixed previous_day lead (1–7), matched valid timestamps, station IDs, forecast and observation values, quality flags, and station/grid representativeness.

## Ranking
- Aggregator: `scripts/rank-okinawa-model-sources.mjs`
- Output: `data/okinawa/model-source-ranking/YYYY-MM-DD.json` and Markdown.
- Groups: model × lead × variable × all/south/central/north.
- Continuous variables: RMSE primary, with MAE and bias retained.
- Precipitation: CSI at 1 mm/hour primary, RMSE secondary; POD/FAR also reported.
- Sample gate: at least 200 pairs, 30 distinct valid dates; precipitation also needs at least 10 observed wet hours.
- Before passing the gate, status is INSUFFICIENT_SAMPLE and rank remains blank.

## Guardrails
- Previous Runs API previous_day fields provide the fixed hindcast lead group. Do not use the Forecast API retrieval age as model lead.
- Only three model configurations are currently included; no claim of universal provider ranking.
- Station representativeness and precipitation accumulation interval alignment remain limitations.
- No production source blending, bias correction or golf suitability threshold changes.
