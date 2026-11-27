# Japan ERA5-Land pilot download and daily conversion

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

## 3. Print request and download one pilot year

```bash
python scripts/era5_land_pilot.py --subregion JP-KNT-NORTH --start 1991-01-01 --end 1991-12-31 --print-request
python scripts/era5_land_pilot.py --subregion JP-KNT-NORTH --start 1991-01-01 --end 1991-12-31
```

Default output: `data/raw/era5-land-pilot/`. A downloaded file is marked `downloaded-unvalidated`; do not use it in date recommendations until inspection and quality checks are complete.

## 4. Structural inspection

```bash
python scripts/inspect_era5_land_pilot.py data/raw/era5-land-pilot/JP-KNT-NORTH_1991-01-01_1991-12-31.zip --subregion JP-KNT-NORTH --start 1991-01-01 --end 1991-12-31 --report data/reports/JP-KNT-NORTH-1991-inspection.json
```

The inspector verifies ZIP integrity, NetCDF presence, returned grid coordinates, all five variables, units, hourly coverage, duplicate/missing timestamps, and precipitation units. A successful result is structural validation only.

## 5. Convert to daily JST records

```bash
python scripts/aggregate_era5_land_daily.py data/raw/era5-land-pilot/JP-KNT-NORTH_1991-01-01_1991-12-31.zip --subregion JP-KNT-NORTH --start 1991-01-01 --end 1991-12-31 --output data/processed/JP-KNT-NORTH-1991-daily.json
```

The converter reruns structural inspection and refuses conversion if inspection fails. It:
- converts UTC timestamps to Asia/Tokyo and groups local dates;
- requires 24 valid hourly values for each of the five source variables before publishing daily metrics;
- converts temperature K to °C and precipitation m to mm;
- sums hourly de-accumulated precipitation without de-accumulating again;
- derives relative humidity from temperature/dewpoint with the Magnus approximation;
- derives wind speed and meteorological wind-from direction from U/V components;
- writes provenance, grid metadata and quality flags;
- keeps incomplete-day metrics null (never zero-fills missing precipitation).

A successful conversion is a **pilot daily file only**. `climatologyEligible` remains false until 30-year completeness and independent JMA QA are complete.
