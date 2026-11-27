# Daily-Only Historical Climate Acquisition Plan

## Decision
The eight-country engine requires daily climate records, not downloadable hourly time series. The former full ERA5-Land hourly/GRIB acquisition pilot is retired for operational acquisition. Its manual download entry point has been disabled. Keep the script only as legacy research code; do not dispatch it.

## Daily source architecture
1. **ERA5-Land post-processed daily statistics** — daily minimum, mean and maximum for 2 m temperature, 2 m dewpoint and 10 m wind components. The CDS service computes daily statistics during retrieval; returned NetCDF files contain daily aggregates. The request uses 1-hourly internal sampling to preserve daily extrema, but the application does not download or store hourly time series.
2. **ERA5 single-level post-processed daily statistics** — daily sum of total precipitation. ERA5-Land's daily-statistics catalogue omits accumulated variables, so precipitation is sourced separately from ERA5. Preserve the source distinction and grid resolution in every normalized record.
3. **Optional daytime-specific statistics** — consider only if a documented source can provide a consistent local daytime window (for example 06:00–18:00) for all eight countries. Do not infer daytime maxima from a full-day statistic.

## Important scientific distinction
- ERA5-Land daily statistics are on a 0.1-degree grid; ERA5 atmospheric daily statistics are on a 0.25-degree grid.
- ERA5-Land daily statistics do not include accumulated precipitation. The separate ERA5 daily-sum request is deliberate, not a missing-field workaround.
- The CDS daily-statistics service computes daily aggregates at retrieval time. The selected timezone aligns the daily boundary to the fixed local UTC offset.
- The frequency setting of 1-hourly controls the source samples used internally by CDS; it does not mean hourly time-series files are downloaded.
- Country time zones in this project use fixed offsets. Any unsupported or daylight-saving timezone must fail closed until explicitly mapped and tested.

## Pilot workflow
Use .github/workflows/daily-climate-statistics-pilot.yml:
- First pilot: JP-OKI-MAIN-NORTH, year 1991.
- Four daily-only requests: ERA5-Land daily min, mean, max; ERA5 daily precipitation sum.
- The workflow stores zipped NetCDF daily-statistics archives and a request manifest as an artifact.
- Current pilot performs ZIP/NetCDF structural checks only. It does not yet validate daily date coverage, returned grid selection, units, or cross-source alignment.
- productionEligible remains false.

## Acceptance gates before scaling
1. Confirm CDS request forms and returned NetCDF schemas for both datasets.
2. Verify one output record per requested local calendar day, including leap day and year boundaries.
3. Verify each variable name, units, missing values, daily statistic and timezone alignment.
4. Inspect returned coordinates and regional representativeness independently for the 0.1-degree ERA5-Land and 0.25-degree ERA5 grids.
5. Confirm ERA5 daily precipitation sum semantics and compare selected days with independent gauges where available.
6. Normalize into separate source contributions without pretending the two grids are identical.
7. Run completeness, bias, MAE/RMSE, wet-day contingency and 30-year calendar-window checks before baseline activation.

## Scope protection
- No full hourly ERA5-Land download.
- No App UI, navigation, interaction or D01–D16 changes.
- No automatic date recommendation or booking.
- D17–D90 daily estimates remain disabled until historical inputs and forecast-source hindcast calibration pass.
