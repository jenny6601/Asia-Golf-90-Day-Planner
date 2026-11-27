# Asia Golf Climate — Daily Long-Range Weather Decision Engine V2

## Objective

Generate a date-by-date estimated weather dataset for every local calendar day from D19 through D90 across the eight countries and 80 regional subregions. The daily series is the primary decision material. The App's analysis and departure-window ranking are advisory only; the user reviews the daily records and makes the final departure-date decision.

## Product boundaries

- D01–D16 forecast source, data, UI and behavior remain unchanged.
- No App screen, layout, navigation or interaction changes in this data-engine phase.
- One regional representative point per subregion; courses in that subregion share the same regional daily estimates.
- No station discovery, station-boundary investigation or daily real-time station observation ingestion.
- D19–D90 daily records are model-derived estimates with uncertainty, not deterministic local forecasts.
- A weekly or monthly anomaly must never be copied as the same daily weather value across its valid dates.
- The App must not automatically select or book a date. Its recommendation is an aid, not a decision.

## Multi-source data design

| Source | Horizon | Role in daily estimate | Limitation |
|---|---|---|---|
| ERA5-Land 1991–2020 | All D19–D90 | Regional day-of-year daily distributions and historical multi-day sequences | Historical prior, not a forecast |
| ECMWF IFS extended-range ensemble | D19–D46 | Weekly precipitation/temperature anomaly and probability conditioning | Weekly signal cannot independently resolve exact daily weather |
| C3S seasonal multi-system | D47–D90 | Monthly precipitation/temperature anomaly, tercile probability and model agreement conditioning | Monthly signal has weak day-specific discrimination |
| Validated daily-shaped seasonal model streams | D19–D90 where available | Supply additional date-level structure and independent model evidence | Use only after region/season/lead-specific hindcast skill is demonstrated |

Multiple products from the same underlying model family are not counted as independent votes. Every record retains provider, dataset, model/system, initialization, valid period, retrieval time, grid/representative point and transformation provenance.

## Daily generation method

1. **Historical daily prior:** For each representative point, build 1991–2020 day-of-year distributions for precipitation, wet-day occurrence, Tmin, Tmax, mean temperature, wind and other available variables. Retain quantiles, year-to-year spread and multi-day sequences.
2. **Forecast conditioning:** For each date, map the overlapping ECMWF weekly or C3S monthly anomaly signal onto the date's historical distribution. Use calibrated hindcast relationships to estimate how the signal changes the distribution, not as a deterministic daily override.
3. **Daily disaggregation:** Generate daily weather estimates using conditional historical analogue sequences or a calibrated stochastic weather generator. Analogue selection is conditioned on season, region, lead-time band and forecast anomaly regime. Where a validated daily-shaped model signal exists, it may contribute additional daily structure.
4. **Sequence coherence:** Sample whole multi-day sequences or calibrated ensemble trajectories. Preserve wet/dry spell persistence and dependence among precipitation, temperature, cloud and wind. Do not independently randomize each day.
5. **Daily summary:** For each date, retain median/central estimate, prediction interval or categorical uncertainty, analogue/member count, confidence by variable and source contribution. Keep the ensemble/analogue traces for audit.
6. **Seven-day context:** In addition to the daily table, calculate a rolling seven-day summary for a five-day/four-night trip with three golf rounds. This summary must not replace or hide the daily records.

### Daily output fields

Each subregion/date record must include:

- Local date, lead day, country, subregion and representative point.
- Weather tendency/category.
- Estimated precipitation amount (mm) and uncertainty range.
- Precipitation risk category; numeric probability only after date-level calibration passes.
- Estimated Tmin, Tmax and mean temperature with uncertainty.
- Wind estimate, cloud and sunshine tendency where supported by source data.
- Daily golf-conditions advisory.
- Confidence by variable, model/analogue contribution, valid period and model-run identifiers.

If a variable is unsupported or missing, retain null/unknown and lower the relevant confidence. Never turn missing precipitation into zero. Do not infer a rain probability from a rainfall amount.

## Advisory and user decision policy

- The daily estimated weather series is the primary material shown to the user.
- App analysis may summarize favorable dates, unfavorable dates, risks and candidate seven-day windows.
- The App may rank or recommend candidate departure windows, but must label this as an advisory.
- The user reviews the individual daily estimates and makes the final departure-date decision.
- The recommendation must never be represented as a guaranteed weather outcome, a booking instruction or an automatic decision.

## Calibration and validation

Validate separately by region, season and lead band: D19–D30, D31–D46, D47–D60 and D61–D90. Required checks include daily precipitation MAE/bias, wet-day Brier score and reliability, Tmin/Tmax MAE/bias, prediction-interval coverage, weather-category skill, wet-spell duration/persistence and seven-day sequence skill. Only publish numeric daily precipitation or playable-day probabilities after relevant date-level hindcast calibration passes. Until then, show estimated amounts/ranges, categorical risk and explicit uncertainty.

Do not assume daily independence when estimating the chance of three playable days. Validate that statistic against complete hindcast seven-day windows or provide categorical guidance instead.

## Refresh policy

- D19–D46: ingest each available ECMWF extended-range cycle (normally twice weekly).
- D47–D90: ingest each available C3S seasonal cycle (monthly).
- Historical climate prior is static between intentional dataset/reference-period revisions.
- No daily real-time station observation refresh is required.
- D01–D16 remains on the existing forecast pipeline, unchanged.

## Current implementation status

- Eight countries and 80 regional representative points are registered.
- ERA5-Land 1991–2020 full production request plan exists; complete regional historical acquisition is not yet confirmed.
- Okinawa Open-Meteo seasonal field-availability probe exists; it demonstrated field availability, not forecast skill, and three nominal points resolved to two unique grid cells.
- ECMWF and C3S source strategy is specified; ingestion, coherent daily disaggregation and hindcast calibration remain to be implemented.
- The daily-output contract is specified, but production daily estimates are not yet activated.

## Next implementation stage

1. Inventory existing ERA5-Land and seasonal forecast files; reuse existing data.
2. Build source adapters and normalized daily/period input contracts for ERA5-Land, ECMWF, C3S and validated daily-shaped model streams.
3. Implement conditional analogue sequence generation for D19–D90 with daily uncertainty outputs.
4. Create a complete daily dataset for each of the 80 regional subregions.
5. Backtest all four lead bands and validate seven-day sequences before activating numeric probabilities or recommendation scores.
6. Keep App UI and D01–D16 untouched; expose the daily series through the existing data contract only after validation.

## References

- ECMWF Forecast User Guide, sub-seasonal range ensemble (16–46 day): https://confluence.ecmwf.int/pages/viewpage.action?pageId=673561457
- ECMWF C3S Seasonal Forecasts: https://www.ecmwf.int/en/forecasts/datasets/c3s-seasonal-forecasts
- Copernicus, How to read C3S seasonal forecasts: https://climate.copernicus.eu/how-read-c3s-seasonal-forecasts
- Open-Meteo Seasonal API: https://open-meteo.com/en/docs/seasonal-forecast-api
