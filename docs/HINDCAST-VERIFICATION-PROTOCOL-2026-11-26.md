# Hindcast verification feasibility and protocol — 2026-11-26

## Objective
Measure whether the EC46 / SEAS5 six-hourly ensemble signals add skill for golf-date decisions at the Okinawa pilot point. This is a verification dataset, not a replacement forecast feed.

## Important source distinction
The live Open-Meteo Seasonal Forecast API exposes the operational EC46 / SEAS5 forecasts and notes that its 51 individual members are retained for only one month. The API's `past_days` option is an archive of recent past forecast output, not a multi-decade hindcast archive suitable by itself for robust seasonal skill verification.

For a genuine seasonal hindcast:
- ECMWF SEAS5 re-forecasts are documented for 1981–2016, initialized on the first of each month, with 25 members in the hindcast set and 51 in the operational forecast set.
- ECMWF/Copernicus documentation describes SEAS5.1 hindcast data on a 1-degree grid, requiring the correct system/version pairing with operational forecasts.
- ECMWF extended-range re-forecasts exist for the 15–46 day range, but access and product details differ from the open seasonal forecast API. ECMWF documentation notes S2S hindcasts to 46 days; do not assume a freely accessible Open-Meteo EC46 hindcast endpoint exists.
- These archive datasets have different spatial resolution, model version, member count, and temporal aggregation from the current Open-Meteo 36 km / 51-member operational response. All differences must be recorded; do not pool unlike datasets without harmonization.

## Proposed data sources
1. **SEAS5 hindcast:** Copernicus Climate Data Store (CDS), ECMWF SEAS5.1 seasonal hindcast archive. Use matching hindcast system/version and monthly initializations. Determine whether requested precipitation, temperature and wind fields are available at 6-hourly resolution for the required lead range; if only daily/monthly products are available, report that limitation and do not manufacture 6-hourly samples.
2. **EC46 extended-range hindcast:** ECMWF/S2S reforecast archive for lead days 17–46. Confirm exact model cycle, reforecast dates, ensemble size, and access terms before implementation. Do not substitute unrelated medium-range IFS forecasts.
3. **Verifying observations:** Use a consistent independent observation/reanalysis reference. For a gridded baseline, ERA5/ERA5-Land may be used as a verification proxy with explicit caveat that reanalysis is not a station observation. If reliable Okinawa station observations are available, prioritize them and document station distance/elevation.

## Required validation protocol
- Define initialization date, valid date/time, lead time, model version, member ID, location/grid cell, variable and units for every record.
- Use only forecasts issued before the verifying time (no look-ahead leakage).
- Match forecast and verifying data at the same valid 6-hour interval and local-time convention; retain UTC source timestamps.
- Keep SEAS5 monthly start dates and EC46/S2S reforecast schedules separate.
- Split training/calibration and evaluation chronologically; do not score on the same cases used to fit calibration.
- Evaluate precipitation occurrence and amount separately:
  - occurrence: Brier Score, reliability diagram, ROC/AUC where sample size supports it;
  - amount: MAE, RMSE, bias, wet-period accumulation error;
  - ensemble: CRPS, rank histogram / spread-skill, threshold reliability.
- Evaluate by lead windows D17–30, D31–46, D47–60, D61–90 and by calendar season.
- For golf use, aggregate only the actual selected six-hour tee-time window; separately test 4-hour and 6-hour accumulations if the source time steps permit.
- Report sample counts, missingness, confidence intervals and skill relative to climatology. A model signal with no positive skill over climatology must not drive a ranked-date recommendation.

## Go / no-go gates
1. **Access gate:** confirm lawful, reproducible access to raw hindcast files and metadata.
2. **Resolution gate:** confirm temporal fields genuinely support six-hour verification. Daily/monthly totals cannot be disaggregated into synthetic six-hour rainfall.
3. **Consistency gate:** confirm model cycle/version, grid, ensemble and variable definitions can be paired appropriately with operational forecasts.
4. **Sample gate:** enough independent years/cases for stable metrics and seasonal stratification.
5. **Skill gate:** demonstrate reliability and useful skill against climatology before enabling probability-based date ranking.

## Current status
- Operational API availability/coverage was successfully tested at one provisional Southern Links coordinate.
- Hindcast files have **not** yet been downloaded or validated.
- No forecast skill, probability calibration, or golf-date ranking performance is claimed.
- CDS credentials / terms and any ECMWF archive access requirements have not been supplied or confirmed.
- No production application files or deployment configuration were changed.
