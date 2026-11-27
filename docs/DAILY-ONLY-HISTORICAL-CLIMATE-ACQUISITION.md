# Long-Range Daily Outlook — Seasonal Forecast + Historical Climate

## Purpose
Keep the original multi-source forecast design. Historical climate is the regional baseline; available weekly and monthly seasonal forecast signals adjust that baseline. Historical records alone must not be presented as a deterministic forecast.

## Horizon
- D01-D16: existing daily forecast, unchanged.
- D17-D18: transition/reference period; use available extended-range signal and historical context only where supported.
- D19-D46: weekly extended-range forecast signals combined with historical daily climate.
- D47-D90: monthly/seasonal forecast signals combined with historical daily climate.

## Historical baseline
- Source: Open-Meteo Historical Weather API, ERA5 reanalysis.
- Reference period: 1991-01-01 to 2020-12-31.
- Spatial scope: one existing representative coordinate per each of the 80 subregions.
- All courses in the same subregion share that representative point.
- Daily aggregates only; no ERA5-Land, CDS credentials, hourly bulk files, or station discovery/ingestion.

## Historical daily fields
- Daily minimum and maximum 2 m air temperature
- Daily mean 2 m dewpoint
- Daily mean relative humidity
- Daily mean and maximum 10 m wind speed
- Daily precipitation sum, precipitation hours and weather code

The historical adapter caches one archive request per representative coordinate and timezone within the current App session. It retrieves historical data when the user opens a region/monthly or long-range report; the full 80-region archive is not currently stored as static repository files.

## Feels-like range
Calculate an apparent-temperature low/high estimate from historical daily Tmin/Tmax, mean dewpoint and mean wind. Apply the available seasonal temperature anomaly as a broad adjustment to the historical feels-like range. These daily aggregate inputs are not time-paired and do not include direct solar load; display as an estimate, not an observed or hourly value.

## Combining seasonal and historical evidence
- D19-D46: use the available weekly precipitation and temperature anomalies/probability signals to adjust historical wet-day frequency, rainfall amount and temperature context.
- D47-D90: use the available monthly/seasonal precipitation and temperature anomalies to adjust the same historical baseline.
- Do not invent daily rain probabilities from weekly/monthly aggregates. Historical wet-day frequency adjusted by a seasonal signal remains a long-range tendency indicator, not a calibrated daily probability.
- If a seasonal signal is unavailable, retain historical context and lower confidence. If historical fields are unavailable, leave them null; do not substitute zero or fabricate values.
- Confidence must remain low/medium-low for long-range daily estimates and must not be upgraded without hindcast validation.

## Golf-use outputs
- Regional daily rain tendency and rainfall amount
- Feels-like temperature high/low range
- Wind context where available
- Historical sample-year counts, source provenance and per-field quality
- Advisory playability wording; no automatic date selection or booking

## Scope protection
- Keep the App UI and navigation unchanged.
- Keep D01-D16 unchanged.
- Do not add new download workflows or credentials.
- Do not use ERA5-Land or station discovery/ingestion.
- No per-course microclimate; use one representative point per subregion.
