# Long-range data-source assessment (Phase 12)

Assessment date: 2026-11-23  
Scope: Okinawa pilot; 17–90 day rainfall-oriented trip-window screening.  
Decision status: research only; no provider has been integrated by this assessment.

## Executive decision

Do not add another wrapper around Open-Meteo and call it independent evidence. The existing Open-Meteo Seasonal API exposes ECMWF EC46 + SEAS5 (51-member ensemble, approximately 36 km, not bias-corrected). It is the current baseline, not an independent second forecast centre.

The strongest candidate for genuinely additional model evidence is the Copernicus Climate Change Service (C3S) multi-system seasonal forecast data accessed through the Climate Data Store (CDS). C3S currently lists ECMWF, UK Met Office, Météo-France, DWD, CMCC, NCEP, JMA, ECCC and Australia's BOM. It offers deterministic and probabilistic gridded precipitation products for 1-month and 3-month means, plus monthly data products. This can support broad monthly wet/dry anomaly comparison, not daily rainfall probabilities for individual golf dates.

## Candidate matrix

| Candidate | Independence from current ECMWF baseline | Useful horizon / product | Access and integration | Decision |
|---|---|---|---|---|
| Open-Meteo EC46 + SEAS5 | No; this is the current model family | Weekly EC46 to day 46; monthly SEAS5 thereafter | Existing public HTTP API and adapter | Keep as baseline |
| C3S multi-system seasonal data via CDS | Yes; includes several additional forecast centres, alongside ECMWF | Monthly and 1-/3-month precipitation means and probabilities; suitable for 47–90 day context | CDS account, dataset terms and API credentials; download/processing pipeline required | First integration candidate, pending access and schema verification |
| ECMWF SEAS5 charts / public viewers | No; same ECMWF model family | Seasonal anomaly maps and probabilities | Useful visual cross-check; not a substitute for machine-readable independent data | Reference-only |
| C3S seasonal public charts | Multi-system aggregate and component systems | 1-/3-month precipitation anomaly/probability maps | Public chart interface; structured data is through CDS | Validation/reference layer |

## Important limits

1. No source found in this assessment supports reliable day-by-day rainfall probability for every date 47–90 days ahead. Do not manufacture one.
2. C3S multi-model output is seasonal-scale evidence. It must not be mapped directly to the three individual golf days as if it were a deterministic daily forecast.
3. C3S multi-system aggregate and its component models are not independent observations. Do not count the aggregate plus its member models as separate votes.
4. Compare forecasts only after matching initialization month, valid period, precipitation variable, units, grid, and climatological reference.
5. Forecast skill varies by region, season, lead time and model. Add a model to scoring only after checking hindcast verification for Okinawa / East Asia and the target season.
6. Keep spatial coverage and temporal coverage separate. Grid cells from one model are not independent forecast centres.

## Proposed integration design

- Keep `open-meteo-ecmwf` as the existing baseline provider.
- Add a separate CDS ingestion job only after credentials and dataset access are confirmed. Store CDS credentials as GitHub Actions secrets; never place tokens in browser JavaScript or committed files.
- Normalize each provider to a common monthly record: `provider`, `model`, `initialization`, `valid_period`, `latitude`, `longitude`, `precipitation_mean`, `precipitation_anomaly`, `probability_category`, `units`, `source_reference`.
- Retain model-level records and a separate multi-model aggregate. Never merge them into a single undocumented value.
- For 47–90 day screening, require at least two genuinely distinct forecast centres with compatible valid periods before producing a cross-model consensus label. Otherwise display the ECMWF baseline alone and mark independent confirmation unavailable.
- Do not combine 17–46 day EC46 weekly EFI with monthly C3S seasonal probabilities as if they had identical temporal meaning.
- Keep recommendations fail-closed when source coverage, initialization, valid period, or regional verification is missing.

## Acceptance gates before implementation

- [ ] CDS account and access to the current seasonal forecast dataset confirmed.
- [ ] Dataset licence / terms accepted by the account holder.
- [ ] Exact CDS dataset identifier, variable names, dimensions, units, update schedule and retrieval API verified.
- [ ] At least two non-ECMWF centres return precipitation data for Okinawa / East Asia.
- [ ] Matching hindcast / verification data and reference climatology identified.
- [ ] A reproducible sample download is archived with initialization and retrieval timestamp.
- [ ] A parser test covers missing models, missing months, unit conversion, duplicate grids and partial ensemble data.
- [ ] No daily rain probability is inferred from monthly anomaly fields.

## Sources

- Copernicus Climate Change Service, Seasonal forecasts: https://climate.copernicus.eu/seasonal-forecasts
- C3S seasonal forecast dataset documentation: https://confluence.ecmwf.int/spaces/CKB/pages/104239033/C3S+Seasonal+Forecasts+dataset+documentation
- Open-Meteo Seasonal Forecast API: https://open-meteo.com/en/docs/seasonal-forecast-api
- ECMWF Long-Range (Seasonal) Forecast guide: https://confluence.ecmwf.int/pages/viewpage.action?pageId=212459706

## Current outcome

Research supports CDS multi-system data as the best next candidate for independent model evidence. It does not yet support implementing a live adapter: account access, exact dataset schema and a reproducible Okinawa sample have not been verified. Keep production and the PR's merge state unchanged until those gates pass.