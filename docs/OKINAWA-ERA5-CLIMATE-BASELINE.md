# Okinawa ERA5 Monthly Climate Baseline

## Purpose
Build a reproducible recent climate reference for the six-course Okinawa pilot, using three existing regional representative points (north/Nago, central/Okinawa City, south/Naha). This is a climate context baseline, not a hindcast of historical EC46/SEAS5 forecasts.

## Method
- Retrieve daily ERA5 reanalysis precipitation for the latest ten complete calendar years.
- Aggregate each calendar month separately for each year.
- A year-month is eligible only with at least 90% valid daily precipitation values.
- Missing daily values are not converted to zero. A genuine observed/modelled dry day with value 0 remains a valid sample.
- Retain valid year-month totals, mean, P10, median, P90, and mean number of days with precipitation >=1 mm.
- Require at least seven eligible years for each calendar month and each region.

## Interpretation boundaries
- ERA5 is a reanalysis reference, not JMA AMeDAS station observations.
- Ten years is a recent reference window, not a 30-year WMO climate normal.
- It does not establish EC46/SEAS5 forecast accuracy and must not be used as a substitute for archived historical seasonal forecast vintages.
- No daily forecast, rain probability, course-level weather, or 0–3 calibrated score is generated.
- This work does not change App UI or the existing forecast scoring.

## Run
`node scripts/archive-okinawa-era5-climate-baseline.mjs`

Output:
- `data/okinawa/era5-climate-baseline/YYYY-MM-DD.json`
- `data/okinawa/era5-climate-baseline/YYYY-MM-DD.md`
