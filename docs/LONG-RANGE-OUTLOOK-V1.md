# Okinawa 17–90 Day Outlook — V1

## Data source
Open-Meteo Seasonal Forecast API using ECMWF Seasonal Seamless (EC46 + SEAS5), requested for Okinawa north/Nago, central/Okinawa City, and south/Naha representative points.

## Model horizon
- EC46 provides sub-seasonal forecasts up to 46 days and is updated daily.
- SEAS5 provides seasonal forecasts up to seven months and is updated monthly.
- Seasonal API model grid is approximately 36 km and provides ensemble forecasts. Data are not bias-corrected and should be interpreted as regional tendencies, not course-local deterministic forecasts.

## Product separation
- Days 1–16: retain the existing daily/hourly Open-Meteo forecast product.
- Days 17–46: use weekly EC46 trend fields, including precipitation mean/anomaly, precipitation EFI and precipitation-anomaly ensemble diagnostics, plus temperature/wind weekly context.
- Days 47–90: use monthly SEAS5 precipitation, temperature, wind, cloud and sunshine means/anomalies as broad seasonal context. Do not downscale a monthly anomaly into daily rain amounts or probabilities.

## Interpretation
- Precipitation EFI describes how unusual a precipitation forecast is relative to model climatology; it is not a rainfall probability.
- `precipitation_anomaly_gt0`, `gt10`, and `gt20` are ensemble anomaly diagnostics and must be labeled according to the provider's definition; do not present them as chance of rain without confirming units/semantics.
- Weekly/monthly means and anomalies are regional averages, not a prediction for a particular tee time.
- This V1 panel displays the provider's weekly and monthly outputs and qualitative EFI wording only. It does not yet create a numerical 90-day golf risk score or change trip-date rankings.

## Limitations
- Approx. 36 km resolution is coarse for individual golf courses and Okinawa's coastal/topographic variation.
- Seasonal data are not bias-corrected; model climatology and ensemble uncertainty must remain visible.
- Do not infer daily weather for dates 17–90 from weekly/monthly averages.
- No historical skill validation or probability calibration has been completed.

## Next work
1. Verify exact semantics and units for all ensemble anomaly diagnostics in the provider metadata.
2. Add hindcast/reforecast verification by lead time and season.
3. Compare multiple ensemble members and report spread/consensus, not only a single mean.
4. Only after validation, design a coarse date-window suitability tier for 17–90 days with an explicit low-confidence label; keep 1–16-day deterministic forecast scoring separate.