# Okinawa Five-Day / Three-Round Trip Decision Engine

## Scope
Fixed six-course Okinawa Main Island pilot. This backend report screens five-day/four-night travel windows, with golf on Days 2, 3 and 4 and arrival/departure on Days 1 and 5.

## Inputs
- Existing three-zone EC46 weekly EFI / SEAS5 monthly anomaly signals.
- Existing seasonal snapshot archive for descriptive revision stability.
- Existing monthly context report containing separate ERA5 P10/median/P90 and ECMWF anomaly direction.
- Existing six-course catalog, grouped into south/central/north regional options.

## Ranking
The existing long-range 0–3 ordinal seasonal tendency tier remains the only ranking metric. The wettest regional signal is retained for each golf date. The three golf dates are combined conservatively using the existing trip-window engine. Lower ordinal tier ranks first; ties are ordered by earlier start date.

ERA5 monthly historical distributions and forecast revision stability are attached as context only. They are not added to the ECMWF tier, not converted into confidence, and do not change the ranking.

## Course options
Each golf date lists the six existing courses with their regional proxy signal. Courses in the same region share the same regional seasonal signal. This is not a course-level 17–90 day forecast and must not be represented as one.

## Horizon
The five-day trip window is generated so its three golf dates fall within the D17–D90 screening horizon. Windows with missing required regional signals are unscored; no zero-fill or synthetic fallback is used.

## Output
- `data/okinawa/trip-window-decision/YYYY-MM-DD.json`
- `data/okinawa/trip-window-decision/YYYY-MM-DD.md`

## Restrictions
- The long-range ordinal 0–3 tier is not rain probability, daily rainfall, cancellation probability or calibrated risk.
- The short-range 0–100 six-hour playability score is not combined with the long-range tier.
- ERA5 is reanalysis, not on-course observation or ECMWF model climatology.
- Revision stability is descriptive snapshot frequency, not forecast skill or confidence.
- Flight/hotel availability, course operating days, travel-day conditions and budget are not modelled.
