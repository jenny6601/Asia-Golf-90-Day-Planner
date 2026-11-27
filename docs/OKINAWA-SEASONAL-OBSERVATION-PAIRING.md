# Okinawa Seasonal Forecast–JMA Observation Pairing

## Purpose
Pair archived EC46 weekly and SEAS5 monthly forecast snapshots with subsequent JMA AMeDAS regional precipitation observations. This stage creates an auditable raw paired dataset; it does not yet claim forecast accuracy.

## Region station groups
- North: Nago, Oku, Motobu, Kunigami.
- Central: Yomitan, Goya, Miyagijima.
- South: Naha, Ashimine, Itokazu.

## Observation aggregation
- Only JMA precipitation1h readings accepted by the shared quality parser are used.
- Each station must have at least 90% of expected hourly readings in the target period.
- At least two eligible stations are required for a regional value.
- Regional precipitation is the arithmetic mean of eligible station period totals.
- Missing hours are never imputed as zero.

## Forecast matching
- Weekly target boundaries are provisional only. The reviewed provider documentation does not explicitly define the timestamp boundary convention; weekly records must not be used for skill scoring until confirmed.
- Monthly timestamp-to-calendar-month mapping is provisional only; do not score until provider timestamp semantics are confirmed.
- A forecast vintage is eligible only when its retrieval date precedes the target period.
- Provider initialization/issue time is not exposed and is not inferred.

## Explicit non-goals
No forecast MAE, anomaly hit rate, category accuracy, or confidence score is calculated in this stage. API response units are now retained with each forecast field, but period boundary semantics remain unverified. Pair status `OBSERVATION_COVERAGE_COMPLETE_SEMANTICS_UNVERIFIED` means observation coverage is sufficient, not that forecast and observation periods are confirmed comparable. JMA regional stations are proxies, not golf-course observations.
