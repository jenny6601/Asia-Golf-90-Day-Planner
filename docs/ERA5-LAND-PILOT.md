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

The request includes one extra UTC day before and after the selected JST period so the first and last local calendar days can be assembled completely.

## 4. Download one pilot year

```bash
python scripts/era5_land_pilot.py --subregion JP-KNT-NORTH --start 1991-01-01 --end 1991-12-31
```

Default output: `data/raw/era5-land-pilot/`. The downloaded file is marked `downloaded-unvalidated`; do not use it in date recommendations until inspection and quality checks are complete.

## 5. Next validation

Inspect the archive for:
- actual returned latitude/longitude versus the expected 0.1-degree grid point;
- variable names and units;
- UTC timestamp coverage, duplicates and missing hours;
- precipitation metadata confirming hourly de-accumulated values;
- full 24-hour coverage after conversion to Asia/Tokyo local dates.

No credentials, downloaded weather values, or fabricated climate statistics belong in Git.
