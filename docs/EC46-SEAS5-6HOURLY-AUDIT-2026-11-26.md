# EC46 / SEAS5 6-hourly data quality audit — 2026-11-26

## Execution
- GitHub Actions run: https://github.com/jenny6601/Asia-Golf-90-Day-Planner/actions/runs/45776827121
- Result: success
- Artifact: `seasonal-api-audit` (run artifact, 2026-11-26)
- Test point: Southern Links, Okinawa; coordinate status remains provisional.
- Models were requested separately: `ecmwf_ec46`, `ecmwf_seas5`, `ecmwf_seasonal_seamless`.

## Observed 6-hour field coverage

Coverage below is non-null time slots / expected time slots in the selected lead window.

| Model | Lead window | Temperature | Precipitation | Rain | Cloud | Wind |
|---|---|---:|---:|---:|---:|---:|
| EC46 | D17–D46 | 119/120 (99.2%) | 119/120 (99.2%) | 119/120 (99.2%) | 119/120 (99.2%) | 119/120 (99.2%) |
| EC46 | D47–D90 | 0/176 (0%) | 0/176 (0%) | 0/176 (0%) | 0/176 (0%) | 0/176 (0%) |
| SEAS5 | D17–D46 | 120/120 (100%) | 120/120 (100%) | 120/120 (100%) | 120/120 (100%) | 120/120 (100%) |
| SEAS5 | D47–D90 | 176/176 (100%) | 176/176 (100%) | 176/176 (100%) | 176/176 (100%) | 176/176 (100%) |
| Seasonal Seamless | D17–D46 | 120/120 (100%) | 120/120 (100%) | 120/120 (100%) | 120/120 (100%) | 120/120 (100%) |
| Seasonal Seamless | D47–D90 | 176/176 (100%) | 176/176 (100%) | 176/176 (100%) | 176/176 (100%) | 176/176 (100%) |

The EC46 response contains 183 valid 6-hour timestamps overall (45 days plus 3 slots), so its 46th forecast day is partial in this response. Do not silently fill the missing slot.

## Ensemble availability
- All observed valid precipitation slots in D17–D46 and D47–D90 for SEAS5 and Seasonal Seamless contained 50 precipitation ensemble member values.
- EC46 D17–D46 also contained 50 member values at all 119 valid slots.
- EC46 D47–D90 had no forecast values.
- Example ensemble fraction above 0.1 mm per 6-hour slot:
  - EC46 D17–D46 sampled slots: 0.38–0.48.
  - SEAS5 D47–D90 sampled slots: 0.32–0.48.
  - Seasonal Seamless D47–D90 sampled slots: 0.32–0.48.

These fractions are the share of available ensemble members exceeding a threshold. They are **not calibrated precipitation probabilities** and must not be displayed as ordinary rain probability without hindcast calibration.

## Engineering conclusions
1. The Seasonal API provides usable 6-hourly fields for the tested point across D17–D90 through SEAS5 / Seasonal Seamless.
2. EC46 is useful through its available lead window but must be treated as unavailable after its native horizon; the tested response had one missing slot in the D17–D46 window.
3. For the continuous 90-day product, Seasonal Seamless is the simplest single-source candidate; separate EC46 and SEAS5 calls remain valuable for source attribution and cross-checking.
4. API availability and ensemble spread do not establish forecast skill. The next gate is historical hindcast verification, calibration, and uncertainty presentation.
5. This is one provisional Okinawa coordinate only. It does not establish coverage or accuracy at every course or across the eight target countries.

## Product guardrails
- Never infer precipitation probability directly from precipitation amount.
- Preserve missing values as missing; do not interpolate or synthesize them as forecasts.
- Treat ensemble fraction as an uncalibrated model signal until verified against hindcasts.
- No production UI or deployment was changed by this audit.
