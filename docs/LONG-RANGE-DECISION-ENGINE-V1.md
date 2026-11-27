# Asia Golf Climate — Long-Range Decision Engine V1

## Objective

Build an eight-country decision-support engine that ranks the most suitable **rolling seven-day departure windows** for a five-day/four-night trip with three golf rounds. The product is not a daily weather forecast beyond day 16. It is a regional probability and relative-suitability assessment using historical climate distributions and long-range ensemble forecast signals.

## Hard product boundaries

- Keep the existing D01–D16 forecast source, data, presentation and behavior unchanged.
- Do not change App screens, layout, navigation or interaction logic.
- One existing representative point per subregion; all courses in that subregion share the same regional climate result.
- Stop JMA/KMA station discovery, station boundary/history investigation and daily station-observation ingestion as active workstreams.
- No daily real-time observation feed is required for this decision product.
- Do not describe D19–D90 output as deterministic daily weather.

## Forecast horizon and source selection

| Horizon | Primary source | Native signal | Decision use |
|---|---|---|---|
| D19–D46 | ECMWF IFS extended-range ensemble | Weekly precipitation and temperature anomalies/probabilities, ensemble spread | Adjust regional historical wet-day and temperature distributions by week |
| D47–D90 | C3S seasonal multi-system | Monthly precipitation and temperature anomalies/tercile probabilities, model agreement and hindcast skill | Adjust regional historical seasonal distributions; rank broad departure windows |
| D19–D90 supporting baseline | ERA5-Land 1991–2020 | Historical daily climate distributions | Establish each subregion's normal seasonal risk and variability |
| Optional research stream | Open-Meteo Seasonal API | Daily-shaped fields and six-hourly precipitation estimates | Compare model signals only; not an authoritative daily forecast until validated |

ECMWF extended-range products provide weekly outlooks through day 46. C3S seasonal forecasts combine several forecast centres and expose both real-time forecasts and hindcasts. Their valid interpretation is anomaly/probability relative to climate, not exact local daily weather. Open-Meteo's seasonal API may provide daily-shaped values, but field availability alone does not establish forecast skill.

## Decision algorithm

1. **Historical prior:** For each of the 80 regional points, derive 1991–2020 day-of-year distributions for daily precipitation, wet-day occurrence (at least 1 mm), Tmin, Tmax and temperature comfort. Preserve quantiles and interannual spread, not just averages.
2. **Forecast signal:** Map ECMWF weekly anomaly/probability products to D19–D46 seven-day blocks. Map C3S monthly anomalies/tercile probabilities to D47–D90 windows. Keep model identity, initialization, valid period and ensemble statistics.
3. **Calibration:** Use each system's matching hindcasts/reforecasts to estimate regional, seasonal and lead-time-specific bias and reliability. Apply quantile mapping or probability calibration only where sample size and skill support it.
4. **Daily risk distribution:** Adjust historical daily distributions using calibrated forecast anomaly signals. Do not distribute a monthly anomaly into fabricated deterministic daily weather. The output is a probability distribution or category for a period, not a day-specific forecast.
5. **Trip aggregation:** Evaluate every rolling seven-day window. Estimate the chance of at least three playable days, temperature comfort, wet-day risk and extreme-weather risk. Where daily dependence cannot be estimated reliably, use conservative bounds or categorical rankings rather than assuming independent days.
6. **Ranking:** Rank windows within the same destination and horizon. Display the leading periods, relative advantage, major risks and evidence confidence. Cross-country ranking is allowed only after the same metrics and calibration gates are available for both regions.

## Output semantics

- **Weather tendency** describes the predicted regional anomaly and historical risk context.
- **Suitability** ranks candidate seven-day windows for golf travel.
- **Confidence** describes hindcast skill, model agreement, ensemble spread and data completeness. It is not the probability of good weather.
- Do not publish numeric daily rain probability or numeric playable-day probability until the relevant hindcast validation passes.
- Do not convert a dry anomaly into a claim that a particular day will be dry.

## Refresh policy

- D19–D46: ingest when a new ECMWF extended-range cycle is available (normally twice weekly); no daily station observations.
- D47–D90: ingest when a new C3S seasonal cycle is available (monthly); retain model/system versions and corresponding hindcasts.
- Historical baseline is static between intentional dataset/reference-period revisions.
- D01–D16 remains on the existing application forecast pipeline.

## Current implementation status

- Eight countries and 80 regional representative points: registered.
- ERA5-Land 1991–2020 full production request plan: prepared, but the complete regional historical dataset has not yet been acquired.
- Okinawa seasonal API field-availability probe: completed for three nominal points; only two unique model grid cells were returned. This is an availability test, not forecast verification.
- ECMWF extended-range and C3S source selection: specified; ingestion and hindcast calibration remain to be implemented.
- No long-range numeric probability or suitability score is activated by this specification.

## Immediate next implementation stage

1. Inventory existing ERA5-Land manifests and any already acquired regional climate files; reuse existing data rather than rebuild it.
2. Build a compact forecast-source adapter contract for ECMWF extended-range and C3S seasonal multi-system, including matching hindcast metadata.
3. Implement D19–D46 and D47–D90 regional period aggregation and provenance checks.
4. Backtest before activating any numerical recommendation.

## References

- ECMWF Forecast User Guide, sub-seasonal range ensemble (16–46 day): https://confluence.ecmwf.int/pages/viewpage.action?pageId=673561457
- ECMWF C3S Seasonal Forecasts: https://www.ecmwf.int/en/forecasts/datasets/c3s-seasonal-forecasts
- Copernicus, How to read C3S seasonal forecasts: https://climate.copernicus.eu/how-read-c3s-seasonal-forecasts
- Open-Meteo Seasonal API: https://open-meteo.com/en/docs/seasonal-forecast-api
