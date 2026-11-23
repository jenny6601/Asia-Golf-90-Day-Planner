# Long-range data-source assessment (Phase 12)

Assessment date: 2026-11-23  
Scope: Okinawa pilot; 17–90 day rainfall-oriented trip-window screening.  
Decision status: research only; no provider has been integrated by this assessment.

## Executive decision (revised after dataset-level verification)

Do not add another wrapper around Open-Meteo and call it independent evidence. The existing Open-Meteo Seasonal API exposes ECMWF EC46 + SEAS5. It is the current baseline, not an independent second forecast centre.

A more useful C3S path than monthly-only data has now been verified: the CDS dataset `seasonal-original-single-levels` provides daily and subdaily seasonal forecast fields, including `total_precipitation`, for multiple originating centres. Its overview specifies global 1° × 1° gridded data, daily (24-hour aggregation) precipitation, forecasts from 2017 onward, hindcasts from 1993–2016, and at least six calendar months of forecast output (actual length can vary by centre). The data therefore may supply daily ensemble precipitation through much of the 17–90 day horizon, subject to each centre's lead-time availability. It is coarse seasonal model output, not a reliable golf-course-scale deterministic forecast.

The dataset lists ECMWF, UK Met Office, Météo-France, DWD, CMCC, NCEP, JMA, ECCC and BOM. This offers genuinely distinct forecast centres. C3S monthly statistics (`seasonal-monthly-single-levels`) remain useful for monthly context and forecast/hindcast climatology. The dataset documentation explicitly requires forecasts to be paired with hindcasts from the same originating centre and system for meaningful verification.

## Candidate matrix

| Candidate | Independence from current ECMWF baseline | Useful horizon / product | Access and integration | Decision |
|---|---|---|---|---|
| Open-Meteo EC46 + SEAS5 | No; this is the current model family | Weekly EC46 to day 46; monthly SEAS5 thereafter | Existing public HTTP API and adapter | Keep as baseline |
| C3S daily/subdaily multi-system data via CDS (`seasonal-original-single-levels`) | Yes; select non-ECMWF centres | Daily total precipitation, 24-hour accumulation; at least 6 calendar months for many systems, exact lead range varies by centre | CDS account, accept terms, CDS API token, GRIB/experimental NetCDF processing | Primary sample-data candidate; verify per-centre lead coverage |\n| C3S monthly statistics via CDS (`seasonal-monthly-single-levels`) | Yes; select non-ECMWF centres | Monthly mean precipitation and forecast/hindcast climate means | Same CDS access; monthly aggregation | Secondary context and climatology / verification layer |
| ECMWF SEAS5 charts / public viewers | No; same ECMWF model family | Seasonal anomaly maps and probabilities | Useful visual cross-check; not a substitute for machine-readable independent data | Reference-only |
| C3S seasonal public charts | Multi-system aggregate and component systems | 1-/3-month precipitation anomaly/probability maps | Public chart interface; structured data is through CDS | Validation/reference layer |

## Important limits

1. C3S does publish daily ensemble total precipitation for seasonal forecasts. This is a real daily-resolution model output, but not proof of reliable day-specific skill at 47–90 days. It must be calibrated against matched hindcasts before displaying an ensemble exceedance probability as actionable rain risk.
2. C3S multi-model output is seasonal-scale evidence. It must not be mapped directly to the three individual golf days as if it were a deterministic daily forecast.
3. C3S multi-system aggregate and its component models are not independent observations. Do not count the aggregate plus its member models as separate votes.
4. Compare forecasts only after matching initialization month, valid period, precipitation variable, units, grid, and climatological reference.
5. Forecast skill varies by region, season, lead time and model. Add a model to scoring only after checking hindcast verification for Okinawa / East Asia and the target season.
6. Keep spatial coverage and temporal coverage separate. Grid cells from one model are not independent forecast centres.

## Proposed integration design

- Keep `open-meteo-ecmwf` as the existing baseline provider.
- First retrieve a small CDS sample from `seasonal-original-single-levels` for `total_precipitation`, selecting at least two non-ECMWF originating centres and one common initialization date. Start with a tight Okinawa bounding box and a short lead-time subset. Confirm each centre's system identifier and available dates in the live CDS form; do not hard-code guessed system IDs.
- Normalize each provider to a common monthly record: `provider`, `model`, `initialization`, `valid_period`, `latitude`, `longitude`, `precipitation_mean`, `precipitation_anomaly`, `probability_category`, `units`, `source_reference`.
- Retain model-level records and a separate multi-model aggregate. Never merge them into a single undocumented value.
- For 47–90 day screening, require at least two genuinely distinct forecast centres with compatible valid periods before producing a cross-model consensus label. Otherwise display the ECMWF baseline alone and mark independent confirmation unavailable.
- Do not combine 17–46 day EC46 weekly EFI with monthly C3S seasonal probabilities as if they had identical temporal meaning.
- Keep recommendations fail-closed when source coverage, initialization, valid period, or regional verification is missing.

## Acceptance gates before implementation

- [ ] CDS account and access to the current seasonal forecast dataset confirmed.
- [ ] Dataset licence / terms accepted by the account holder.
- [ ] Exact CDS dataset identifier, variable names, dimensions, units, update schedule and retrieval API verified (`seasonal-original-single-levels`, `total_precipitation`).
- [ ] At least two non-ECMWF centres return precipitation data for Okinawa / East Asia.
- [ ] Matching hindcast / verification data and reference climatology identified.
- [ ] A reproducible sample download is archived with initialization and retrieval timestamp.
- [ ] A parser test covers missing models, missing months, unit conversion, duplicate grids and partial ensemble data.
- [ ] No daily rain probability is inferred from monthly anomaly fields.

## Sources

- Copernicus Climate Change Service, Seasonal forecasts: https://climate.copernicus.eu/seasonal-forecasts
- C3S daily/subdaily single-level dataset: https://cds.climate.copernicus.eu/datasets/seasonal-original-single-levels\n- C3S monthly single-level dataset: https://cds.climate.copernicus.eu/datasets/seasonal-monthly-single-levels\n- CDS API setup: https://cds.climate.copernicus.eu/en/how-to-api\n- C3S seasonal dataset/API request guidance: https://confluence.ecmwf.int/pages/viewpage.action?pageId=462896337
- Open-Meteo Seasonal Forecast API: https://open-meteo.com/en/docs/seasonal-forecast-api
- ECMWF Long-Range (Seasonal) Forecast guide: https://confluence.ecmwf.int/pages/viewpage.action?pageId=212459706

## Current outcome

Dataset-level research confirms a stronger route: daily ensemble total precipitation from multiple C3S forecast centres, with monthly products for context. No live data has yet been downloaded because CDS account access, terms acceptance, API token and a reproducible Okinawa sample are not available in this workspace. Do not implement an adapter or claim operational skill until those gates pass. Keep production and the PR's merge state unchanged until then.