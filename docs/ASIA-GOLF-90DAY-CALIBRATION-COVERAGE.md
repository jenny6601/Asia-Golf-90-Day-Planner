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
