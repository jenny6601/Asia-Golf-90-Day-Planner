# Shared D17-D90 Calibration and Eight-Country Coverage

## Stage 2 — paired verification data
The canonical sample contract is defined in `shared-forecast-verification.js`.
A valid pair must preserve country, provider, model/version, initialization time,
valid time, lead, variable, unit, temporal resolution and verification provenance.
ERA5 is a reanalysis proxy, not station truth. Forecast and verification must
refer to the same valid time and compatible accumulation semantics.

## Stage 3 — guarded bias correction
`shared-bias-correction.js` provides a time-ordered train/holdout split and
additive mean-bias correction. It refuses to fit below 100 valid training pairs.
The model is fit on earlier valid times only. Adoption is permitted only when
later holdout MAE improves. This first correction is a testable baseline, not
a claim that a model has improved. Production use must additionally segment by
country, provider/model, variable, lead band and season, with adequate samples.

## Stage 4 — eight-country coverage
`eight-country-coverage.js` audits all configured countries, including disabled
ones. It reports course and coordinate coverage separately from model skill.
The current course catalogue is Okinawa-only; other country readiness must not
be reported as validated merely because the shared code supports it.

## Stage 5 — acceptance gate
Compare raw forecast, corrected forecast and a same-season climatology baseline
on the same untouched holdout rows. Report sample count and metrics by country,
provider, variable and D17-30 / D31-46 / D47-60 / D61-90. Do not adopt a
correction if holdout MAE fails to improve or any important subgroup degrades.
Brier score requires explicitly calibrated probabilities and observed events.
No accuracy-improvement claim is valid until real paired historical samples
have passed this evaluation.


## SEAS5.1 System 51 pilot retrieval audit — 2026-11-26

A narrowly scoped CDS retrieval was successfully executed automatically in GitHub Actions using the existing repository secret `CDS_API_KEY`; no manual token entry or local CDS setup was required. The retrieved request is one ECMWF System 51 initialization (2016-01-01) over the Okinawa area, at leads 408, 414, 420 and 426 hours, for 10 m u/v wind, 2 m temperature and total precipitation.

The ecCodes audit of the retrieved GRIB found 325 messages:
- 10u, 10v and 2t each have 25 ensemble members at each of the four leads.
- Total precipitation (tp) has 25 members only at lead 408; leads 414, 420 and 426 are absent from this multi-lead response.
- The archived messages expose `stepType=instant` and `stepRange=408` for precipitation at the one returned lead. This is not evidence of a six-hour precipitation accumulation. No rain amount or rain probability calibration may be derived from this field until its accumulation semantics are resolved.
- Wind units are m s**-1 and temperature units are K. Any future extraction must convert temperature to Celsius explicitly and preserve units in metadata.
- The 25 ensemble IDs are 0–24. They are an explicit ensemble member count for the variables/leads present, not a count inferred from the total GRIB message count.

The first audit script did not correctly extract lead hours because this GRIB's `forecastTime` key is absent. The audit was corrected to derive lead from `endStep` / `stepRange`, and a second successful run now reports the coverage above.

A separate single-lead precipitation retrieval probe was added to determine whether the missing tp leads were caused by the multi-lead request form. That probe is still running / must be checked before interpreting missing precipitation fields as dataset unavailability.

This pilot remains insufficient for forecast-skill evaluation: it is one initialization, only four lead times, no resolved precipitation accumulation series, and no independent verification pairs. It demonstrates automated CDS access and GRIB metadata extraction only. It is not yet a D17–D90 hindcast validation dataset.
