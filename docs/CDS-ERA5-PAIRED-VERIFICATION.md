# CDS–ERA5 paired verification dataset

## Scope and source boundary

Build a paired dataset from an existing normalized CDS hindcast batch and a separately supplied ERA5 record file. This tool does not retrieve or expand the CDS pilot request, and does not retrieve ERA5. ERA5 is explicitly labelled a reanalysis verification proxy, not station truth and not an issued forecast.

## Exact pairing policy

A pair is created only when all of the following match exactly:

- country code and course ID;
- valid time;
- variable;
- unit;
- temporal semantics (instantaneous, period accumulation, average, maximum or minimum).

No time interpolation, nearest-time fallback, implicit unit conversion, precipitation accumulation inference or duplicate resolution is performed. Multiple ERA5 records for the same key are ambiguous and excluded. Missing or mismatched records are listed in the report.

## Output

Each pair retains forecast initialization, valid time, lead hours/days, ensemble member, forecast value, ERA5 value, model/version, spatial method and nearest-grid distance. Quality label is `paired-proxy-not-station-truth`.

## Interpretation

This initial pilot may yield zero valid pairs because its SEAS5.1 precipitation records are instantaneous and sparse. That is an acceptable result; it is not a reason to weaken matching. A single initialization cannot support D17–D90 skill claims or bias correction.

## Run

```bash
python scripts/build_cds_era5_pairs.py --forecast-batch artifacts/seas51-normalized-archive-batch.json --era5-records path/to/era5-records.json
python -m unittest discover -s tests -p "test_build_cds_era5_pairs.py" -v
```

ERA5 input must be a JSON array or an object with a `records` array. Each record must include the pairing fields and `verificationSource: "ERA5-reanalysis-proxy"`.
