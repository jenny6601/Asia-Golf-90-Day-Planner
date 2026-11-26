# Chronological CDS holdout and leakage control

## Split policy

The split uses forecast initialization time, not random row sampling. Records initialized before the timezone-aware cutoff enter the training candidate set; records at or after cutoff enter holdout.

To reduce target leakage, training candidates are purged whenever the same country, course, valid time, variable and unit appear in holdout. Ensemble members sharing the same target valid time remain together on one side. This prevents a forecast target from appearing in both training and holdout through different initialization cycles.

Rows with missing or timezone-naive initialization/valid timestamps are excluded and reported. No random fallback is used.

## Output and interpretation

The output includes train, holdout, purged and invalid rows, counts and initialization ranges. `ready-for-evaluation` means only that both partitions are non-empty; it is not a claim of adequate sample size or statistical power.

The holdout must not be used for fitting corrections, choosing thresholds or model selection. ERA5 remains a reanalysis proxy. Multiple years/initializations and sufficient samples by country, variable and lead band are required before accuracy claims.

## Run

```bash
python scripts/split_cds_temporal_holdout.py --input artifacts/cds-era5-paired-verification.json --cutoff 2019-01-01T00:00:00Z
python -m unittest discover -s tests -p "test_split_cds_temporal_holdout.py" -v
```

The cutoff is an explicit analysis parameter, not a pre-approved expansion of the CDS retrieval request.
