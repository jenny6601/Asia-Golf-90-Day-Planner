# Daily-Only Historical Climate Acquisition Plan — ERA5 Only

## Decision
ERA5-Land is removed from the operational source architecture. The eight-country historical daily climate pipeline uses **ERA5 single-level post-processed daily statistics only**. No ERA5-Land dataset is requested, downloaded, blended or used as a fallback.

## Sole source
Dataset: derived-era5-single-levels-daily-statistics (Copernicus CDS / ECMWF).

ERA5 daily statistics provide daily minimum, mean, maximum and sum, with configurable local UTC offset and sub-daily sampling frequency. Daily aggregation is performed by CDS during retrieval; the returned NetCDF archives contain daily aggregates, not hourly time-series output. The dataset is global, has 0.25-degree atmospheric resolution and coverage from 1940 onward. See the official CDS dataset description and ERA5 family daily-statistics documentation:
- https://cds.climate.copernicus.eu/datasets/derived-era5-single-levels-daily-statistics
- https://confluence.ecmwf.int/spaces/CKB/pages/462888259/ERA5%2Bfamily%2Bpost-processed%2Bdaily%2Bstatistics%2Bdocumentation

## Daily request design
For each regional representative point and year, request four daily-statistic groups:
1. daily_min: 2 m air temperature.
2. daily_mean: 2 m air temperature, 2 m dewpoint, 10 m U/V wind components, total cloud cover and mean sea-level pressure.
3. daily_max: 2 m air temperature.
4. daily_sum: total precipitation.

The request uses the point's local fixed UTC offset. The CDS frequency=1_hourly option controls the samples used internally to compute daily aggregates; it does not request or return hourly time-series files. No hourly data is stored by this project.

## Pilot
Workflow: .github/workflows/daily-climate-statistics-pilot.yml.
- First pilot: JP-OKI-MAIN-NORTH, year 1991.
- Four requests, all against the same ERA5 daily-statistics dataset.
- API credentials continue to use the existing CDS_API_KEY repository secret.
- The current pilot checks ZIP integrity and presence of NetCDF files only.
- It does not yet prove complete daily coverage, correct units, correct returned grid, or climate skill.
- productionEligible remains false.

## Quality gates before 80-region scale-up
1. Confirm returned NetCDF schemas and variable names for all four statistic groups.
2. Verify exactly one record per requested local calendar day, including leap days and year boundaries.
3. Validate units, missing values, daily statistic and timezone alignment.
4. Inspect returned 0.25-degree coordinates and regional representativeness for each region.
5. Validate precipitation daily-sum semantics and compare selected periods with independent gauge observations where available.
6. Normalize all daily records with source, dataset, grid, timezone, run and quality provenance.
7. Run completeness, bias, MAE/RMSE, wet-day contingency and 30-year calendar-window checks before enabling the historical baseline.

## Scope protection
- ERA5-Land is not used anywhere in the operational pipeline.
- No full hourly time-series download.
- No App UI, navigation, interaction or D01–D16 changes.
- No automatic date selection or booking.
- D17–D90 daily estimates remain disabled until historical inputs and forecast-source hindcast calibration pass.
