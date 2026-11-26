# Asia Golf 90-Day Planner — five-stage accuracy improvement plan

## Product purpose

Help users choose golf-travel dates by showing the weather outlook around each selected golf course. For D17-D90, nearby regional weather guidance is sufficient. It is not expected to be a precise forecast for the exact course, fairway or green. Do not spend project effort pursuing survey-grade course coordinates or treating grid-to-course distance as a blocking quality gate.

Keep the forecast horizons honest:
- D1-D16: operational forecast, with daily/hourly detail only where the source supports it.
- D17-D30 and D31-D45: longer-range regional outlook; communicate broad temperature, precipitation and weather-pattern tendencies.
- D46-D60 and D61-D90: increasingly broad subseasonal/seasonal context; avoid presenting these as deterministic daily weather.
The exact source temporal resolution and forecast semantics must remain visible.

## Stage 1 — Existing forecast architecture and data-source audit
- Inventory providers, model identifiers, update cadence, horizon, temporal resolution, units and missingness.
- Distinguish forecast, hindcast, reanalysis proxy and climatology.
- Record what each source can and cannot support.
- Status: substantially completed.

## Stage 2 — Shared verification framework
- Use common sample definitions and metrics across providers, countries and lead bands.
- Pair values by compatible valid time, variable, unit and temporal semantics.
- Separate D17-D30, D31-D45, D46-D60 and D61-D90 reporting where source data supports those bands.
- Use ERA5 only as a clearly labeled reanalysis proxy, not station truth.
- Status: core modules and tests implemented.

## Stage 3 — Historical data and verification dataset
- Build repeatable, multi-initialization historical batches with provenance and explicit missingness.
- Preserve the nearby grid point used for each course-region association, but treat coordinates and distance as descriptive metadata, not a hard rejection gate for D17-D90.
- Do not fabricate values for courses outside the source coverage.
- Keep precipitation accumulation, instantaneous fields and other temporal semantics distinct.
- Establish adequate date coverage and sample counts before skill claims.
- Status: pilot archive and processing pipeline exist; current one-initialization sparse-lead pilot is not sufficient for skill validation. Continue this stage.

## Stage 4 — Bias correction and confidence evaluation
- Evaluate raw forecasts against independent verification data and climatology baselines.
- Use chronological holdout and prevent target-time leakage.
- Apply variable-specific correction only when sample size and out-of-sample evidence support it.
- Do not treat raw ensemble fractions as calibrated probabilities.
- Status: framework exists; no correction or measured improvement claim is approved yet.

## Stage 5 — Integration, testing and production readiness
- Integrate only validated signals into the shared planning engine.
- Present horizon-appropriate guidance and uncertainty clearly.
- Run country/provider/lead-band regression and data-quality tests.
- Production changes require separate explicit authorization.
- Status: not started for release acceptance.

## Working rules
- Keep the work on `feature/90day-accuracy-five-stage`.
- Do not merge, deploy or change production/main without explicit authorization.
- Do not expand the approved CDS pilot request scope without review.
- Do not let coordinate precision or grid-distance diagnostics displace the product objective.
- Do not claim D17-D90 daily precision, forecast-skill improvement or durable archive storage without evidence.
