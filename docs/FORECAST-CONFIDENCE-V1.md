# Forecast Confidence Engine — V1

## Purpose
Keep forecast confidence separate from weather risk/suitability. Confidence labels describe the temporal scale and evidence limitations of the available forecast product; they are not probabilities that the forecast is correct.

## Provisional horizon policy
| Lead time | Data product | Confidence label | Reason |
|---|---|---|---|
| 1–16 days | Daily/hourly deterministic forecast | Medium (uncalibrated) | Higher temporal detail, but Okinawa-specific hindcast calibration is not complete |
| 17–46 days | EC46 weekly sub-seasonal outlook | Low | Weekly aggregation cannot resolve a specific golf day or tee time |
| 47–90 days | SEAS5 monthly seasonal outlook | Very low | Monthly regional tendencies cannot resolve daily rain events |

Missing data or completeness below 80% is classified very low. Dates outside the 90-day planning horizon are out of scope.

## Evidence gates
- No horizon is assigned high confidence in V1.
- Ensemble spread is not currently extracted and displayed, so its absence is stated as an uncertainty limitation.
- Okinawa-specific hindcast/reforecast verification and calibration are not complete.
- Model skill, reliability, false alarm rate, missed-rain rate, and performance by lead time/season must be evaluated before any confidence upgrade.

## Itinerary aggregation
An itinerary confidence must follow the weakest of its three golf days, not an arithmetic average. This avoids hiding a very-low-confidence seasonal date behind higher-confidence short-range days.

## Prohibited interpretations
- Confidence is not rain risk.
- Confidence is not probability of no rain.
- A low-rain seasonal anomaly does not imply a high probability of a dry round.
- Do not numerically convert qualitative confidence labels into risk-score adjustments until hindcast validation supports that relationship.

## Future calibration plan
1. Acquire archived forecasts/hindcasts and matched observations for Okinawa.
2. Stratify by lead time (1–3, 4–7, 8–16, 17–30, 31–46, 47–90), season, and region.
3. Evaluate precipitation probability reliability, rainfall amount error, wet-hour detection, Brier score, CRPS/ensemble spread where appropriate.
4. Publish sample counts, calibration curves, uncertainty intervals and model version.
5. Upgrade confidence labels only when pre-defined validation thresholds are met.