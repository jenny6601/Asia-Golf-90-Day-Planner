# ERA5 proxy metric report

This report calculates descriptive MAE, bias and RMSE for exact CDS–ERA5 paired samples. It groups results by country, variable, unit and the four long-range lead bands D17–30, D31–46, D47–60 and D61–90.

All metric groups carry the label `descriptive-proxy-metrics-not-station-validated`. ERA5 is a reanalysis proxy, not course-station truth. Sample counts are always shown; the report does not infer statistical significance, calibrated probabilities or forecast skill from small samples.

No Brier score is calculated and no bias correction is fitted or applied. The existing holdout/correction workflow must only be considered after multiple initializations, adequate sample support and independent temporal holdout data exist.

Run:

```bash
python scripts/report_cds_era5_proxy_skill.py --input artifacts/cds-era5-paired-verification.json
python -m unittest discover -s tests -p "test_report_cds_era5_proxy_skill.py" -v
```
