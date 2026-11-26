# Okinawa 17–90 Day Outlook — V1

## Data source
Open-Meteo Seasonal Forecast API using ECMWF Seasonal Seamless (EC46 + SEAS5), requested for Okinawa north/Nago, central/Okinawa City, and south/Naha representative points.

## Model characteristics
- EC46 provides sub-seasonal forecasts up to 46 days.
- SEAS5 provides seasonal forecasts beyond the EC46 horizon.
- The seasonal product is a coarse regional model output; it is not a course-local forecast.
- The model output is not bias-corrected. Keep regional resolution, ensemble uncertainty, model issue time and returned grid coordinate visible where available.

## Verified daily data availability — 2026-11-26
A read-only live API probe was completed for all three existing Okinawa proxy points. Each request returned 90 daily records and 360 native 6-hourly timestamps.

Available daily fields with complete coverage in both D17–D46 and D47–D90:
- weather code
- maximum, minimum and mean 2 m temperature
- mean 10 m wind speed
- mean cloud cover
- sunshine duration

Available 6-hourly fields with complete coverage in both periods:
- precipitation, rain and showers
- temperature and apparent temperature
- weather code
- wind speed
- cloud cover and relative humidity

The six-hourly precipitation/rain/showers series can be aggregated by destination-local calendar date to derive a seasonal-model daily rainfall amount estimate. This is not a calibrated daily rain probability. No daily precipitation probability was returned by the probe.

Wind gusts were present for 119/120 D17–D46 samples but 0/176 D47–D90 samples. Do not use gust-based scoring after D46 and never replace missing gust values with zero.

The central and south requested coordinates resolved to the same seasonal model grid coordinate; the three nominal regions represented only two unique grid cells in this probe. Regional comparisons must disclose this limitation.

Detailed results: [Seasonal Daily Data Availability Probe — 2026-11-26](./SEASONAL-DAILY-DATA-PROBE-2026-11-26.md).

## Product separation
- Days 1–16: retain the existing daily/hourly Open-Meteo Forecast API product unchanged.
- Days 17–46: use native seasonal daily fields and six-hourly ensemble fields, plus weekly EC46 anomalies/EFI as supporting context.
- Days 47–90: use native seasonal daily fields and six-hourly precipitation/rain/showers fields, plus monthly SEAS5 anomalies as supporting context.
- Daily precipitation amount is aggregated from six-hourly model values. It must not be presented as a calibrated rain probability.
- Do not infer gusts after D46 where the provider returns no gust values.
- Keep seasonal daily estimates distinct from deterministic short-range forecasts.

## Interpretation and scoring
- Weather code and daily temperature/wind/cloud/sunshine fields provide a daily approximate weather picture.
- Daily rainfall amount is a model-derived seasonal estimate, not a probability.
- EFI and anomaly fields describe departures from model climatology; they are not rain probabilities.
- Daily playability guidance must be qualitative and carry a seasonal/low-daily-specificity label until hindcast verification supports calibrated scores.
- Forecast confidence remains separate from weather risk.
- Keep missing values missing; do not silently replace them with zero.
- Do not claim improved accuracy until out-of-sample hindcast verification demonstrates skill.

## Next implementation steps
1. Extend the existing seasonal API adapter to request the verified daily and 6-hourly fields while retaining weekly/monthly diagnostics.
2. Normalize the six-hourly fields into destination-local daily records with provenance and completeness flags.
3. Add a separate seasonal daily playability-tendency engine; do not reuse the short-range numeric rain-impact score without validation.
4. Integrate daily seasonal records into the existing Asia Golf Climate calendar and date-detail navigation without changing its app architecture.
5. Add hindcast evaluation by lead band and season before activating stronger recommendation language.
