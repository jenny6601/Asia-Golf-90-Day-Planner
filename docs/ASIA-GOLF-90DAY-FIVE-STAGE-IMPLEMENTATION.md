# Asia Golf Climate — 90-day forecast accuracy improvement

Scope: shared engine for JP, KR, CN, VN, TH, MY, SG and ID. This work is isolated from production UI and deployment.

## Stage 1 — Existing-engine inventory and data-quality baseline
- Inventory forecast providers, model identifiers, initialization cadence, valid-time coverage, temporal resolution, units, missingness, course coordinates and timezone.
- Keep D1–D16 operational forecast separate from D17–D46 subseasonal guidance and D47–D90 seasonal guidance.
- Record whether a value is a forecast, hindcast, reanalysis proxy, or climatology.
- Acceptance: a machine-readable inventory and explicit unsupported/missing fields; no inferred data completeness.

## Stage 2 — Shared paired hindcast verification dataset
- Canonical sample fields are defined in assets/js/shared-forecast-verification.js.
- Pair a forecast only with verification for the exact same valid time, variable, unit and spatial point/grid policy.
- Preserve provider, model/version, initialization time, lead, temporal resolution and verification provenance.
- ERA5 is a reanalysis verification proxy, not a station observation or a forecast issued at the time.
- Do not mix daily totals with 6-hour accumulations or instantaneous fields.
- Acceptance: invalid/incomplete pairs are rejected; sample counts and coverage are reported by D17–30, D31–46, D47–60 and D61–90.

## Stage 3 — Shared calibration and bias-correction engine
- Start with transparent, variable-specific bias estimates from out-of-sample paired hindcasts.
- Do not apply a correction until sample sufficiency, temporal holdout and stability checks pass.
- Rainfall occurrence probabilities require calibration against observed event labels. Ensemble member fraction is not automatically a calibrated probability.
- Keep raw and corrected forecasts side-by-side; corrections must be reversible and versioned.
- Acceptance: a correction is enabled only if held-out performance improves versus raw forecast and climatology baseline without material subgroup degradation.

## Stage 4 — Eight-country shared validation
- Country-specific input is limited to verified course coordinates, timezone and course metadata.
- Reuse the same adapter, sample schema, metrics, quality gates and tests across all markets.
- Flag provisional coordinates and avoid claiming course-level skill until location validation is complete.
- Acceptance: one shared test suite reports country/course coverage, source availability and lead-band sample sufficiency.

## Stage 5 — Before/after skill comparison and release gate
- Compare raw model, corrected model and climatology baseline on identical held-out samples.
- Continuous variables: MAE, bias and RMSE. Rain-event probabilities: Brier score only for explicitly calibrated probabilities; categorical rain events: POD/FAR/CSI with stated threshold.
- Report metrics by country, provider, variable and lead band, with sample counts and uncertainty.
- Acceptance: release only where out-of-sample skill improves; otherwise retain raw forecast and label the horizon as low/very-low confidence.

## Current limitations and honest status
- Existing production-facing long-range feed is ECMWF seasonal seamless weekly/monthly context, not a daily D17–D90 forecast.
- The current Okinawa-only hindcast metrics module computes basic metrics but previously grouped all leads beyond 16 days together. The shared module now separates the four required lead bands.
- A code-level framework and tests do not constitute measured forecast-skill improvement. No calibration is enabled until real paired hindcast data and held-out validation are available.
- No production website, UI, or deployment is changed by this implementation branch.
