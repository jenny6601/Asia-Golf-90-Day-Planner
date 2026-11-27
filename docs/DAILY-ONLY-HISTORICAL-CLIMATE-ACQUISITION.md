# Historical Climate Data — Simplified ERA5 Approach

## Decision
Use the existing Open-Meteo Historical Weather API with the explicit **ERA5** model. Do not use ERA5-Land, CDS credentials, NetCDF downloads, station discovery, or hourly time-series files.

## Reference period
- Fixed baseline: 1991-01-01 through 2020-12-31.
- Geography: the existing 80 representative points in \`config/global/weather-subregions.json\`.
- Each golf-course cluster inherits the climate assessment of its regional representative point.
- Timezone: each representative point's existing IANA timezone.

## Data retrieval
The existing \`fetchCourseHistoricalWeekNormals()\` and \`fetchCourseHistoricalMonthlyClimate()\` functions share one cached daily archive request per coordinate/timezone.

The request returns daily aggregates only:
- Daily minimum and maximum 2 m temperature
- Daily mean 2 m dewpoint
- Daily mean relative humidity
- Daily mean and maximum 10 m wind speed
- Daily precipitation sum and precipitation hours
- Daily weather code

No daily mean air temperature is required for the long-range display. Minimum/maximum air temperature are retained as inputs for the apparent-temperature estimate.

## Daily historical estimate
For D19-D90, use a 31-day rolling calendar window centred on each target month/day, pooled across the 1991-2020 reference period. This provides a stable historical climate tendency rather than pretending to know the exact weather on a future date.

Outputs:
- Historical wet-day frequency (daily precipitation >= 1 mm), explicitly not a future daily rain probability
- Mean daily precipitation and 90th-percentile daily precipitation
- Historical minimum/maximum air-temperature context
- Estimated apparent-temperature low/high range, calculated from daily Tmin/Tmax, mean dewpoint and mean wind
- Historical mean wind and relative humidity
- Valid sample-year counts and data-quality flags

The apparent-temperature calculation uses daily aggregate inputs that are not time-paired and does not include direct solar load. It is a regional estimate, not an hourly golf-course heat-stress measurement.

## Missing data and confidence
- Missing values remain null; missing precipitation is never converted to zero.
- A calendar window is considered usable only when at least 90% of its daily samples are present in a year.
- Confidence is based on valid historical sample years and field completeness.
- Long-range outputs are always labelled as historical estimates, never deterministic daily forecasts.

## Scope protection
- No CDS download workflow or credentials.
- No ERA5-Land.
- No station discovery or station observation ingestion.
- No hourly historical time-series download or storage.
- No changes to the App layout, navigation, interactions, or D01-D16 forecast.
- No automatic date selection or booking.
