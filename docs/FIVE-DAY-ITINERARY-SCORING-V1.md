# Five-Day / Four-Night Three-Round Itinerary Scoring — V1

## Scope
Evaluate one five-day/four-night Okinawa itinerary using exactly three selected course forecasts. Courses are assigned to rounds in the order the user selected them. Golf rounds are on trip Day 2, Day 3 and Day 4; Day 1 and Day 5 are travel days.

## Forecast window and validity
- Uses each selected course's own Open-Meteo hourly forecast, in Asia/Tokyo local time.
- User selects a common tee-off hour from 06:00 to 13:00.
- Each round evaluates six consecutive hourly periods beginning at tee-off.
- All three rounds must have complete precipitation-probability and precipitation-amount fields. If any round is incomplete, the itinerary score is withheld.
- Only trip start dates whose three golf days fall within the available hourly forecast data are offered.

## Score
For each round, use the current `golf-rain-impact-prototype-v1` score (0–100).

`Itinerary rain impact = 0.70 × mean(three round risks) + 0.30 × maximum(round risks)`

Display labels: <15 low; 15–<35 somewhat low; 35–<60 moderate; 60–<80 high; ≥80 very high.

The 30% worst-round component prevents one very wet round from being hidden by two dry rounds.

## Travel days
Day 1 and Day 5 are shown as travel days. They are not scored in V1 because there is no configured airport, hotel, or route weather point. Do not use golf-course forecasts as a substitute for airport or hotel weather.

## Interpretation limits
- This is a provisional comparative rain-impact index, not a probability of rain during the whole trip, not a cancellation probability, and not an operational booking recommendation.
- The component rain index is uncalibrated and based on forecast inputs; GPS coordinates are still provisional for some courses.
- This version evaluates only the currently available 16-day hourly forecast range. It does not rank the full 90-day horizon.
- Wind, lightning, heat stress, course drainage, course-specific closures, transport disruption, and tee-time availability are not yet included.
- Forecast confidence is not yet calibrated; do not infer confidence from the risk score.

## Next validation
Verify course GPS against official course maps, compare archived forecasts with observed rainfall, calibrate thresholds by forecast lead time and season, and separately add wind/lightning/thermal and travel-day risk before linking this module to the 90-day ranking.