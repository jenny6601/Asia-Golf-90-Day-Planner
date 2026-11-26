# CDS multi-batch archive inventory

## Purpose

Create a read-only inventory over one or more normalized CDS batch JSON files. The report counts initialization dates, batches, courses, variables and four planning horizons: D17–30, D31–45, D46–60 and D61–90. It flags duplicate batch IDs, duplicate record keys, invalid envelopes and missing provenance without silently deleting data.

## Supported inputs

The inventory accepts the normalizer's top-level batch envelope and the immutable storage envelope containing `manifest` plus `records`. It does not fetch data, write to a database, or alter live forecasts.

## Run

```bash
python scripts/inventory_cds_archive_batches.py artifacts/batch-2016.json artifacts/batch-2017.json --output artifacts/cds-archive-inventory.json
python -m unittest discover -s tests -p "test_inventory_cds_archive_batches.py" -v
```

## Interpretation

- `initializationCount` is the number of distinct initialization timestamps represented in each country/variable/lead group.
- Duplicate records remain in the input count and are flagged for review; they are not deduplicated automatically.
- Distance metadata is retained as a descriptive diagnostic only; it does not filter regional long-range guidance.
- A structurally valid inventory is not forecast-skill validation and does not prove durable archive storage.
- The current CDS pilot still contains one initialization; multiple initializations must be retrieved and normalized before multi-year validation is possible.

This tool does not broaden or modify the approved CDS retrieval scope.
