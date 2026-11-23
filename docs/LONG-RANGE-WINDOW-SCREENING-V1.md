# 17–90 Day Seasonal Window Screening — V1

## Purpose
Provide coarse date-window screening when deterministic daily/hourly forecasts are unavailable. This engine is deliberately separate from the 1–16 day course-GPS rain-impact ranking.

## Inputs and horizon split
- 17–46 day golf dates: ECMWF EC46 weekly precipitation EFI.
- 47–90 day golf dates: ECMWF SEAS5 monthly precipitation mean and anomaly.
- Three Okinawa representative zones: north, central and south.
- Trip: five days/four nights; golf on Day 2, Day 3 and Day 4.

## Regional aggregation
For each golf date, the engine retains the wettest regional signal rather than allowing a dry-zone average to hide a wet-zone signal. The three golf dates are then combined conservatively using the worst date plus the mean ordinal tendency tier.

## Ordinal classes (not probabilities)
Weekly EFI:
- >= 0.8: markedly wet tendency
- >= 0.5: wet tendency
- <= -0.5: dry tendency
- otherwise: near-baseline / no strong signal

Monthly anomaly:
- precipitation anomaly / precipitation mean >= +20%: markedly wet tendency
- >= +5%: wet tendency
- <= -20%: dry tendency
- otherwise: near-baseline / no strong signal

These are provisional screening thresholds. The resulting 0–3 tendency tier is an ordinal class, NOT a calibrated risk score, rain probability, daily rainfall forecast or cancellation probability.

## Ranking
Up to three windows are selected, with at least five days between start dates. Ranking sorts by the coarse tendency tier only; dates within the same tier are effectively tied. The system must not imply day-level precision from weekly/monthly products.

## Confidence
- 17–46 days: low.
- 47–90 days: very low.
- Missing any required date/zone signal: window is not scored.
- No use of synthetic data to fill missing values.

## Limitations / future validation
- Seasonal data are regional (~36 km) and not golf-course-scale.
- Monthly anomaly ratio thresholds are provisional and not Okinawa-hindcast calibrated.
- No ensemble spread/skill calibration is applied to this ranking.
- Do not combine this ordinal tendency tier numerically with the 1–16 day rain-impact index.
- Validate against archived seasonal forecasts and observed precipitation before changing thresholds or confidence labels.
