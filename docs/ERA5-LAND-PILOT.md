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


## 6. Build rolling 1991-2020 regional climatology

After daily files have been generated for the complete reference period, run:

```bash
python scripts/build_regional_climatology.py data/processed/JP-KNT-NORTH-*-daily.json --start-year 1991 --end-year 2020 --window-days 15 --minimum-valid-years 24 --minimum-completeness 0.90 --output data/processed/JP-KNT-NORTH-climatology-1991-2020.json
```

The builder creates a 365-day month/day calendar for each subregion. Each target date uses a rolling 31-calendar-day window (15 days before and after). February 29 is positioned midway between February 28 and March 1 and contributes to adjacent windows.

For each metric independently, a baseline year qualifies only when at least 90% of the 31 calendar-day records have a valid value (at least 28 days). At least 24 qualifying seasonal years are required. Windows that include February 29 require 29 valid days (90% of 32) in leap years; other windows require 28 valid days (90% of 31). December/January samples are assigned to the target season year rather than their raw calendar year. Rainfall statistics include dry days; missing rainfall is excluded rather than converted to zero. Output includes median, mean, P90, wet-day frequency and 10/30 mm heavy-rain frequencies, plus temperature, humidity and wind summaries.

The output is explicitly marked `historical-climatology-computed-not-activated`; both `climateBaselineEnabled` and `forecastEnabled` remain false. This is historical context only, not a deterministic 19-90 day forecast.


## 7. Preview 5-day/4-night, 3-round departure-date ranking

Once a region has a computed 1991-2020 climatology JSON, run:

```bash
python scripts/rank_golf_trip_dates.py --climatology data/processed/JP-KNT-NORTH-climatology-1991-2020.json --subregion JP-KNT-NORTH --from-date 2027-01-01 --horizon-days 90 --output data/processed/JP-KNT-NORTH-trip-date-ranking.json
```

For a 90-day calendar horizon, the preview evaluates 86 complete rolling five-day trip windows:
- day 1 is arrival/transfer; days 2, 3 and 4 are the fixed consecutive golf days; day 5 is departure/transfer;
- all five dates require usable historical rainfall statistics; February 29 uses the midpoint of the February 28 and March 1 climatology values;
- ranking uses only the fixed three golf dates: average wet-day frequency, then >=10 mm frequency, >=30 mm frequency, then P90 rainfall;
- missing rainfall metrics block a candidate; missing values are never filled with zero.

This is a historical seasonal-climate prior, not a deterministic daily forecast or a guarantee of future conditions. It does not change the live 1-16 day forecast path. Production activation remains disabled until the historical source data and independent quality checks are complete.


## 8. Forecast maturity and source separation

The `assets/js/forecast-maturity.js` adapter establishes the lead-time contract:
- D1-D16: short-range daily forecast, and no historical fallback if a forecast date is missing;
- D17-D18: weekly trend only; no daily risk score;
- D19-D46: historical same-calendar-day baseline plus seasonal trend estimate, not a deterministic daily forecast;
- D47-D90: seasonal outlook and historical climate reference, not a deterministic daily forecast or daily rain probability.

The adapter retains data confidence/source coverage separately from weather risk. It does not alter the formal V1 scoring weights and is not yet wired into the app UI.


## 9. Export the 365-day climatology into date-addressable regional evidence

After the historical climatology JSON has been built, export a rolling date range for the downstream Asia Golf Climate evidence contract:

```bash
python scripts/export_regional_climate_evidence.py data/processed/JP-KNT-NORTH-climatology-1991-2020.json --start-date 2027-01-01 --days 90 --output data/processed/JP-KNT-NORTH-historical-evidence-90d.json
```

The exporter maps each target date to its month/day climatology record and emits the normalized historical fields used by the regional daily evidence contract: wet-day frequency, mean/P90 rainfall, mean daily high/low temperature and metric-specific valid-year counts. Metrics below the climatology minimum-valid-year threshold remain null. February 29 uses the midpoint of February 28 and March 1 for means/frequency, but withholds P90 and heavy-rain frequencies because those percentiles cannot be reconstructed by averaging adjacent percentiles.

The exported records remain explicitly non-activated: `climateBaselineEnabled=false`, `forecastEnabled=false`, and `decisionUseEligible=false`. The exporter does not make a forecast or rank travel dates.


## 10. Resumable Japan 19-subregion / 1991-2020 acquisition

The mapping now contains 16 mainland and 3 Okinawa representative points (19 total). These remain expected grid mappings until each returned NetCDF coordinate is checked by the inspector.

The batch runner creates one CDS request per subregion/year: 19 regions x 30 years = 570 annual tasks. Each request is intentionally limited to one calendar year and includes UTC boundary padding to build complete JST days. The runner defaults to **one task per execution**; this prevents accidentally launching hundreds of CDS requests at once.

Preview the first task without downloading:

```bash
python scripts/batch_era5_land_japan.py --start-year 1991 --end-year 2020 --limit 1 --dry-run
```

Run one region/year at a time (first recommended pilot: north Kanto, 1991):

```bash
python scripts/batch_era5_land_japan.py --subregions JP-KNT-NORTH --start-year 1991 --end-year 1991 --limit 1
```

After validating the pilot and confirming the CDS endpoint is stable, expand to a region across 30 years:

```bash
python scripts/batch_era5_land_japan.py --subregions JP-KNT-NORTH --start-year 1991 --end-year 2020 --limit 1
```

Then process all Japan regions gradually:

```bash
python scripts/batch_era5_land_japan.py --start-year 1991 --end-year 2020 --limit 1
```

Repeat the command to advance to the next pending task. The runner writes an atomic `batch-state.json` after each task and resumes by skipping validated daily outputs. Failed tasks remain recorded and are retried on a later invocation. Per task, it retries transient errors up to three times with increasing wait intervals, then runs structural inspection and daily JST aggregation. Raw archives, inspection reports and normalized daily JSON are stored separately under `data/era5-japan-1991-2020/`.

The batch runner never sets `climatologyEligible=true`. It only records successful structural validation and daily conversion. Full 30-year completeness, JMA cross-check, station consistency and regional QA are separate gates before climatology activation.


## 11. Japan 19-region daily QA and independent JMA comparison

Run the regional completeness and climate-window QA after daily files have been acquired:

```bash
python scripts/audit_japan_era5_daily.py
```

The report is written to `data/processed/japan-era5-1991-2020-qa.json`. It reports, by region and year: missing dates, annual valid-day coverage, metric-specific coverage and ranges, monthly coverage, and 365 calendar-day rolling-window readiness for each metric. The rolling-window gate follows the climatology builder's 31-day window, 90% daily completeness and 24-valid-year threshold. It identifies which month/day/metric combinations have sufficient history; it does not activate the baseline.

To provide an independent observation comparison, prepare a JMA daily-observation JSON file using the schema below. Assign each station to one regional ID and provide station coordinates and daily rainfall / Tmin / Tmax. The nearest supplied station is selected for each subregion; the default maximum distance is 75 km and at least 365 paired rainfall days are required for a comparison to be labelled available.

```json
{
  "sourceId": "JMA_DAILY_OBSERVATION",
  "stations": [
    {
      "stationId": "station-code",
      "name": "station-name",
      "latitude": 35.0,
      "longitude": 139.0,
      "regionId": "JP-KNT-SOUTH",
      "records": [
        {
          "validDate": "1991-01-01",
          "precipitationMm": 0.0,
          "temperatureMinC": 2.1,
          "temperatureMaxC": 8.4
        }
      ]
    }
  ]
}
```

Run the comparison:

```bash
python scripts/compare_jma_station_daily.py path/to/jma-daily.json
```

Output: `data/processed/japan-jma-crosscheck.json`. The report includes station distance, paired-day counts, rainfall MAE/bias, wet-day hit/miss/false-alarm/correct-negative counts at 1 mm, and Tmin/Tmax MAE/bias. The interface does not automatically correct ERA5 values. Station metadata, station relocation/homogeneity, missingness and observation provenance must be checked before interpreting the comparison. A missing JMA input is reported as not available, not as a pass.

**Important:** ERA5-Land is reanalysis, not a rain-gauge observation. Annual coverage and plausibility QA is not a substitute for independent JMA validation. All QA and cross-check outputs keep `climateBaselineEnabled=false`, `forecastEnabled=false` and `decisionUseEligible=false`.
