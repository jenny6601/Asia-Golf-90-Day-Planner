# Japan ERA5-Land pilot download

This workflow downloads **one subregion and at most one year per request** for schema validation. It does not download the full 1991-2020 archive and does not enable the climate baseline.

## 1. CDS account and credentials

1. Register/log in at https://cds.climate.copernicus.eu/.
2. Open the ERA5-Land hourly time-series dataset page: https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-timeseries.
3. Accept the dataset licence/terms in the dataset page.
4. Configure CDS API credentials according to the current CDS API instructions. Do not put keys in this repository.

The time-series endpoint is convenient for a single-point pilot but ECMWF marks it experimental and not recommended for production. Its response structure may change. The full ERA5-Land hourly dataset remains the production fallback.

## 2. Install

```bash
python -m venv .venv
# Windows PowerShell:
.venv\\Scripts\\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements-data.txt
```

## 3. Print the pilot request without downloading

```bash
python scripts/era5_land_pilot.py --subregion JP-KNT-NORTH --start 1991-01-01 --end 1991-12-31 --print-request
```

## 4. Download one pilot year

```bash
python scripts/era5_land_pilot.py --subregion JP-KNT-NORTH --start 1991-01-01 --end 1991-12-31
```

Default output: `data/raw/era5-land-pilot/`. The downloaded file is marked `downloaded-unvalidated`; do not use it in date recommendations until inspection and quality checks are complete.

## 5. Inspect and validate the ZIP

```bash
python scripts/inspect_era5_land_pilot.py data/raw/era5-land-pilot/JP-KNT-NORTH_1991-01-01_1991-12-31.zip --subregion JP-KNT-NORTH --start 1991-01-01 --end 1991-12-31 --report data/reports/JP-KNT-NORTH-1991-inspection.json
```

The inspector verifies:
- ZIP integrity and presence of NetCDF files;
- actual returned latitude/longitude against the expected 0.1-degree grid point (0.001-degree tolerance);
- all five required variables and their reported units;
- complete hourly UTC coverage for every requested JST date, including all 24 hourly samples per local date;
- duplicate or missing timestamps;
- total precipitation units are metres.

The CDS time-series product documents total precipitation as hourly de-accumulated values. The inspector therefore does not de-accumulate or transform precipitation. A successful result is only **structural validation**, not proof of climate quality or permission to activate the 30-year baseline.

## 6. Next validation

After structural validation, independently review variable ranges, missing-value fractions, physical plausibility and agreement with JMA station/monthly normals. Keep the production climate baseline disabled until that QA is complete.
