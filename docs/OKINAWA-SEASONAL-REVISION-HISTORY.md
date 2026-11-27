# Okinawa Seasonal Forecast Revision History

## Purpose
Track how EC46 weekly and SEAS5 monthly fields change across retained daily API snapshots for the existing north, central, and south regional points.

## Matching rules
A revision is computed only when records share:
- Region.
- Scale (weekly or monthly).
- Exact provider time label (the label is not interpreted as a period boundary).
- Model identifier.
- Identical unit metadata.

## Fields
- Weekly: precipitation mean, precipitation anomaly, precipitation EFI.
- Monthly: precipitation mean and precipitation anomaly.

Each field reports previous value, current value, and numeric delta. For precipitation anomaly, the report also indicates whether its sign changed. Missing/non-numeric values remain null; no zero filling.

## Important interpretation
A difference between two API snapshots is a snapshot revision. It does not prove that ECMWF has issued a new model initialization. It may reflect API refresh, data revision, or model update; model issue time is not available in the current archive schema.

## Output
- `data/okinawa/seasonal-revision-history/YYYY-MM-DD.json`
- `data/okinawa/seasonal-revision-history/YYYY-MM-DD.md`

## Restrictions
No weekly/monthly period boundary is inferred. No daily rainfall or rain probability is derived. No forecast accuracy, skill, or calibrated confidence is claimed. This report is a revision-stability diagnostic only.
