# Unified 1–90 Day Decision View — V1

## Objective
Present short-range course-level recommendations and long-range regional seasonal candidates in one decision view while preserving the fact that their metrics are not comparable.

## Short range (1–16 days)
- Input: three selected course-coordinate hourly forecasts.
- Trip: five days/four nights, golf Day 2–4.
- Metric: prototype golf rain-impact index (0–100), itinerary aggregation 70% mean + 30% worst round.
- Ranking: up to three windows, at least five days apart.
- Confidence: medium (uncalibrated); Okinawa-specific hindcast validation is pending.

## Long range (17–90 days)
- Input: north/central/south Okinawa seasonal outlook.
- 17–46 days: weekly EC46 precipitation EFI.
- 47–90 days: monthly SEAS5 precipitation anomaly relative to mean.
- Metric: ordinal regional wetness tendency tier (0–3), not a probability or calibrated risk score.
- Ranking: up to three windows, at least five days apart.
- Confidence: low / very low depending on the candidate horizon.

## Unified view rules
- Display both horizon groups in one page and order their candidates chronologically in the data structure.
- Preserve each group's internal ranking only.
- Never compare or add the short-range 0–100 impact index to the long-range 0–3 seasonal tendency tier.
- Do not create a single overall best/second/backup rank across the two products.
- If either source is missing or stale, display only the available group and disclose the missing input.
- When the selected golf courses change, invalidate the previously fetched course forecast and require a refresh.

## Known limitations
- The short-range rain-impact index is not a cancellation probability and is not hindcast-calibrated.
- The seasonal tendency thresholds are provisional and not Okinawa-hindcast-calibrated.
- The 90-day view does not yet model flight/hotel availability, course operating days, travel-day weather, or budget.
