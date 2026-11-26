# Golf Rain Impact Model — Prototype V1

## Purpose
Estimate rain exposure during a selected six-hour golf window from hourly forecast fields. This is a transparent impact index for interface testing, not a calibrated probability of cancellation and not yet an input to the 90-day trip-date ranking.

## Window
- User selects tee-off hour (06:00–13:00).
- Prototype evaluates the next six consecutive hourly periods.
- Forecast timestamps use Asia/Tokyo local time.
- If any required hourly timestamp, precipitation probability, or precipitation amount is missing, return insufficient-data. Missing is never converted to zero.

## Inputs
- Hourly precipitation probability (%)
- Hourly precipitation amount (mm)

## Prototype calculation
First calculate mean hourly precipitation probability over six hours (not the probability of rain at any time during the whole round), sum of six hourly precipitation amounts, maximum single-hour precipitation amount, and count of hours with at least 0.1 mm forecast precipitation.

| Component | Input bands | Impact |
|---|---|---:|
| Mean hourly probability | ≤20 / 21–40 / 41–60 / 61–80 / >80% | 0 / 20 / 45 / 70 / 90 |
| Six-hour total rain | ≤0.1 / >0.1–1 / >1–3 / >3–5 / >5–10 / >10 mm | 0 / 15 / 35 / 60 / 80 / 100 |
| Peak hourly rain | ≤0.1 / >0.1–0.5 / >0.5–1 / >1–2.5 / >2.5–5 / >5 mm | 0 / 15 / 30 / 55 / 80 / 100 |

Prototype index = 0.35 × probability impact + 0.40 × amount impact + 0.25 × intensity impact.

Display bands: <15 low; 15–<35 somewhat low; 35–<60 moderate; 60–<80 high; ≥80 very high.

## Important interpretation limits
- Thresholds and weights are provisional expert-designed assumptions, not empirically calibrated.
- Hourly precipitation probabilities are not independent; do not multiply hourly probabilities or call the mean a six-hour event probability.
- The amount is the provider's forecast hourly accumulation, not a guaranteed measured amount at the course.
- Model grid resolution and forecast uncertainty matter; the three current points are city proxies, not golf-course coordinates.
- The index excludes wind, lightning, heat stress, course drainage, and tournament cancellation policy. These must be developed as separate impact dimensions.
- The index is not used by the 90-day date engine and must not be used alone to book or cancel a trip.

## Validation required before operational use
1. Obtain historical archived forecasts/hindcasts and matching observations for Okinawa.
2. Verify calibration separately by lead time, zone, season, and golf-hour window.
3. Compare forecast precipitation probability and amount with observed wet hours and measured rainfall.
4. Tune thresholds/weights against golf-relevant outcomes and golfer feedback.
5. Report skill, calibration, false-alarm and missed-rain rates; version every model change.