# JMA ObsDL Daily Record Quality Audit (1991–2020)

## Official source and export settings
Use the Japan Meteorological Agency **過去の気象データ・ダウンロード (ObsDL)** portal:
https://www.data.jma.go.jp/risk/obsdl/

For each selected candidate station, export **日別値** for 1991-01-01 through 2020-12-31 and select:
- 降水量の日合計 (daily precipitation total)
- 日最高気温
- 日最低気温

In display options:
- Include values requiring caution so the quality code is retained.
- Include all periods across observation-environment changes and retain the homogeneity number.
- Choose numeric CSV output so values, quality information and homogeneity number are separate columns.
- Export one station per CSV and rename the file to its numeric JMA station ID, e.g. `47412.csv`.
- Place exports in `data/observation-stations/input/jma-daily/`.

JMA limits each ObsDL request size and asks users not to make excessive automated requests. This pipeline therefore audits supplied official exports; it does not scrape or repeatedly query the portal.

## Quality interpretation
JMA quality codes are preserved per element:
- 8: normal value; counted as strict valid observation.
- 5: quasi-normal; retained separately, not promoted into strict coverage.
- 4: insufficient-data value; excluded from strict coverage.
- 2: suspicious value; excluded.
- 1: missing.
- 0: no observation/statistical item.

The strict coverage denominator is all 10,958 calendar days in 1991–2020. Annual coverage requires at least 292 quality-8 days. PRCP, TMAX and TMIN are evaluated independently. Homogeneity-number counts are retained as a review signal; changes are not automatically treated as relocations.

## Run
```bash
python scripts/audit_jma_obsdl_daily_records.py --input-dir data/observation-stations/input/jma-daily
```

Output:
`data/observation-stations/jma-daily-record-quality-1991-2020.json`

## Approval
Every output remains `stationApproved=false` and `weatherIngestionEnabled=false`. Actual station approval still requires cross-checking the original JMA AMeDAS station-history files (amdmaster.index / amdmaster.index4), relocation metadata, regional representativeness, and review of element quality and homogeneity changes.
