# Okinawa Seasonal Forecast Direction Stability

## Purpose
Describe whether the precipitation anomaly direction for the same exact provider time label remains consistent across archived daily snapshots, and whether north/central/south latest directions agree.

## Direction categories
- Positive precipitation anomaly: `WETTER_THAN_MODEL_CLIMATE`.
- Negative precipitation anomaly: `DRIER_THAN_MODEL_CLIMATE`.
- Zero: `NEAR_ZERO_ANOMALY`.
- Missing/non-numeric: `UNKNOWN`.

These categories use the sign of the provider anomaly only. No custom thresholds are introduced. Weekly EFI is retained as a separate numeric trend series and is not converted into probability.

## Minimum evidence
At least three valid archived snapshots are required before a series can be classified as `CONSISTENT_DIRECTION` or `DIRECTION_CHANGED`. With fewer than three valid values, status remains `INSUFFICIENT_SNAPSHOTS`.

Direction changes are counted between adjacent valid observations; missing values are skipped, never zero-filled. A descriptive direction consistency ratio is provided but is not confidence, probability, or calibrated reliability.

Regional agreement is assessed for the same exact provider time label using latest archived direction for each of the three regions. Fewer than three regions yields `INCOMPLETE_REGIONAL_COVERAGE`.

## Output
- `data/okinawa/seasonal-direction-stability/YYYY-MM-DD.json`
- `data/okinawa/seasonal-direction-stability/YYYY-MM-DD.md`

## Restrictions
No weekly/monthly period boundaries or model issue times are inferred. No daily rainfall, rain probability, forecast accuracy, or forecast skill is produced. This is a descriptive revision-stability diagnostic only.
