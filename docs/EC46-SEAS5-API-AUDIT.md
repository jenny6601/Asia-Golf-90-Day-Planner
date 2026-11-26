# EC46 / SEAS5 Seasonal API Audit

## Scope
This audit probes the Open-Meteo Seasonal Forecast API at the currently catalogued Southern Links Okinawa pilot coordinate. The coordinate is marked provisional in `config/global/courses.json`; this report must not be interpreted as course-pin validation.

## Models probed
- `ecmwf_ec46`
- `ecmwf_seas5`
- `ecmwf_seasonal_seamless`

The probe requests 90 forecast days, daily temperature/precipitation/rain/cloud/wind fields, and 6-hourly temperature/precipitation/rain/cloud/wind fields. It records HTTP status, returned date coverage, non-null counts, available field names, and possible member-like field names.

## Interpretation guardrails
- A successful HTTP response proves endpoint access and returned schema/coverage only; it does not prove forecast accuracy.
- Precipitation amount is not precipitation probability. No daily probability is derived.
- EC46's native forecast horizon is 46 days; SEAS5 supplies the longer-range seasonal component. Seasonal Seamless combines the two.
- The API is a 36 km ensemble product and is not bias-corrected; it must not be represented as precise course-scale weather.
- Historical/reanalysis data is not substituted for future forecasts.
- No production website files, UI, or deployment workflow are changed by this audit branch.

## Output
GitHub Actions publishes `seasonal-api-audit.json` as a downloadable artifact. A later stage should add hindcast-based verification and calibrated confidence only after this endpoint/schema audit is reviewed.
