# SEAS5.1 archive normalization

## Purpose

Convert the course-point extraction CSV and its manifest into a shared, provenance-preserving CDS archive batch envelope. This transformation is local and deterministic; it performs no CDS requests and no persistent storage writes.

## Normalization rules

- Convert GRIB YYYYMMDD / HHMM fields into UTC ISO-8601 initialization and valid times.
- Preserve forecast lead in hours and ensemble member number.
- Preserve country, course, variable, value, unit and nearest-grid distance.
- Map GRIB stepType explicitly: instant, accum, avg, max and min. Unrecognized values are rejected, not guessed.
- In particular, a precipitation field with stepType=instant remains `instantaneous`; it is never converted into rainfall accumulation.
- All records remain `qualityStatus=unverified`; verificationSource remains null until a genuine paired verification source exists.
- Rows failing required-field, temporal-semantics or time-order checks are listed separately in rejectedRecords with source line and source row.

## Batch boundary

One normalized batch must contain exactly one initialization time. Its manifest records source files, model/system, dataset, lead hours and variables. A new initialization or corrected extraction must use a distinct batch identity.

## Run

```bash
python scripts/standardize_seas51_archive.py
python -m unittest tests.test_standardize_seas51_archive -v
```

Default output: `artifacts/seas51-normalized-archive-batch.json`.

## Limitations

This script does not calculate forecast skill, does not infer missing precipitation accumulations, does not verify provisional course coordinates, and does not write to R2/Supabase or any persistent backend. The raw GRIB remains the source-of-record artifact; normalized output is a derived representation.
