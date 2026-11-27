# Okinawa 17–90 Day Seasonal Validation Readiness

This report is a data-readiness gate, not a forecast-skill score.

## Coverage
- Separate groups are produced for north, central, and south Okinawa and for weekly EC46 and monthly SEAS5 records.
- Observation completeness is inherited from the JMA pairing archive. Only records whose regional observation aggregate is complete are counted as coverage-complete.
- ECMWF monthly anomaly and ERA5 historical percentile availability are counted independently.

## Scoring gate
A row is scoring-eligible only if all conditions are true: the pair status is explicitly `SCORING_ELIGIBLE`, forecast period boundaries are verified, provider issue/initialization time is known, the regional observation aggregate is complete, and the native-scale forecast precipitation mean is numeric.

The current archive deliberately sets `periodBoundaryVerified=false` and `issueTimeKnown=false`. Therefore the expected scoring-eligible count is zero. Retrieval time must never be relabeled as model issue time.

## Scale and interpretation
- Weekly EC46 remains weekly.
- Monthly SEAS5 remains monthly.
- No daily rainfall amount or daily rain probability is inferred.
- ERA5 P10/median/P90 remain an independent historical reference and are not merged with the ECMWF model climatology.

## Outputs
- `data/okinawa/seasonal-validation-readiness/YYYY-MM-DD.json`
- `data/okinawa/seasonal-validation-readiness/YYYY-MM-DD.md`
