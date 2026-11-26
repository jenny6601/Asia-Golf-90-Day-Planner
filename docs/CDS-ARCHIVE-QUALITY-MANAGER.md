# CDS archive quality and coverage manager

## Scope

This is a read-only reporting layer for staged or persisted CDS archive envelopes. It does not retrieve data, modify batches, write to storage, or feed live forecasts.

## Coverage dimensions

Coverage is grouped by country code, variable and forecast lead bucket:

- D17-D30
- D31-D46
- D47-D60
- D61-D90

Shorter-than-D17 and beyond-D90 records remain visible in separate buckets rather than being silently folded into the requested long-range bands.

## Quality checks

The report identifies:
- duplicate batch IDs and deterministic record keys;
- malformed batch envelopes and manifest/record count mismatches;
- unknown temporal semantics;
- invalid or reversed initialization/valid-time pairs;
- missing nearest-grid distance and verification-source provenance;
- records explicitly marked rejected.

Missing provenance is a warning, not evidence that a record is valid for skill scoring. Structurally valid records remain `unverified` until forecast/verification pairing and independent assessment are completed.

## Interpretation boundary

Coverage counts are not skill scores. Country/variable/lead coverage does not establish representative sampling, independent station truth, or calibrated probabilities. ERA5 remains a reanalysis proxy. No threshold is imposed on nearest-grid distance here; spatial representativeness is reported separately rather than dropping points through an arbitrary cutoff.

## Current state

- `assets/js/cds-archive-quality.js` produces a deterministic, read-only quality and coverage report.
- Tests use synthetic records to validate logic.
- No live CDS pilot output is assumed or fabricated.
- This module is isolated from the live forecast runtime.
