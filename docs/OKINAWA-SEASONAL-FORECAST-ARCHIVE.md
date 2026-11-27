# Okinawa ECMWF Seasonal Forecast Snapshot Archive

## Purpose
Retain each daily issue retrieval of the existing 17–90 day seasonal outlook so that later verification can compare what was available at the time with subsequent observations.

## Coverage
- North: Nago representative point.
- Central: Okinawa City representative point.
- South: Naha representative point.
- Model: Open-Meteo Seasonal Forecast API, ECMWF seasonal seamless.
- 17–46 days: weekly EC46 precipitation EFI/anomaly fields.
- 47–90 days: monthly SEAS5 precipitation mean/anomaly fields.

## Quality gates
All three regional points must return weekly and monthly time arrays, weekly precipitation EFI/mean, and monthly precipitation mean/anomaly. A partial regional response is rejected rather than silently archived as complete.

## Interpretation
- Archive timestamp is retrieval time, not model initialization or provider issue time.
- The archive is a forecast snapshot, not a hindcast dataset.
- No daily rainfall probability or daily rainfall total is derived from weekly/monthly data.
- The existing 0–3 seasonal tendency classes remain ordinal and uncalibrated.
- Short-range hourly forecasts and long-range seasonal fields are not merged into one numeric score.

## Future verification
As snapshots accumulate, pair each archived weekly/monthly target period with later observed JMA regional precipitation summaries. Evaluate wet/dry anomaly direction and category reliability at the native weekly/monthly temporal scale. Do not treat weekly/monthly products as daily forecasts.
