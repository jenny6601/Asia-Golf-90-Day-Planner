# Regional Daily Evidence Contract

## Purpose and boundary

`assets/js/regional-daily-evidence.js` defines a canonical, presentation-independent record for one weather subregion and one local calendar date.

This is a data-engine layer only. It is not imported by `app.js`, does not change the App screen or interaction flow, and does not alter formal V1 scoring or ranking weights.

## Geography rule

- Exactly one representative climate point per subregion.
- The point represents regional climate; it does not need clubhouse/fairway precision.
- Do not create per-course climate evidence records within a subregion.
- Each record retains subregion ID, timezone, latitude, longitude, and the point purpose.

## Maturity bands

| Lead day | Permitted evidence | Rain field semantics |
|---|---|---|
| D01–D16 | Actual short-range daily forecast only | `rainProbabilityPct` is populated only from the actual daily forecast |
| D17–D18 | Weekly/transition signal only | No daily rain probability or daily wet-day estimate |
| D19–D46 | Seasonal signal plus historical same-calendar-day baseline where available | `wetDayFrequencyEstimatePct` is a climate-frequency estimate, never daily rain probability |
| D47–D90 | Seasonal outlook and historical climate reference | Same separation; no deterministic daily rain probability |

Missing values remain `null`. Historical climate is never substituted for a missing D01–D16 forecast.

## Canonical record

The builder returns:

- `schemaVersion`, `recordType`
- `geography`: subregion, timezone and representative point
- `validDate`, `leadDaysAhead`, `leadDay`
- `forecastMaturity`: band, class, description and availability status
- `sourceType` and evidence separated by source family
- `weatherMetrics`: forecast rain probability kept separate from climate wet-day frequency
- `confidence`: confidence/coverage metadata kept separate from rainfall risk
- `provenance`: optional source ID, dataset, retrieval time and version metadata supplied by the caller
- `quality`: explicit source availability and missing-value policy
- `decisionPolicy`: ranking disabled until independent validation

## Input expectations

- `forecastDaily`: one date's normalized daily forecast row, not the full provider timeline.
- `weeklyTrend`: one date's weekly/transition signal.
- `seasonalOutlook`: one date's normalized seasonal estimate, compatible with `buildDailyClimateOutlook` fields such as `rainChanceEstimate`, `rainEstimate`, `highEstimate` and `lowEstimate`.
- `historical`: one date's historical climate normal, including `rainFrequency`, `rainMean`, `highMean`, `lowMean` and valid sample-year counts.
- `provenance`: optional metadata grouped under `forecast`, `weeklyTrend`, `seasonal` and `historical`.

## Activation status

The contract and its automated test cases are implemented as a standalone module. Test execution/CI status must be checked separately; this file does not imply that tests have passed. The module is not connected to the App and does not activate the historical baseline, 90-day outlook, or trip-date ranking. Actual ERA5-Land downloads, JMA cross-checks and regional coverage validation remain prerequisites.
