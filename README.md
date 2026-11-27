# Asia-Golf-90-Day-Planner

Asia Golf 90-Day Travel Weather Forecast and Date Recommendation System.

## Project status

Phase 1: destination-first 90-day trip-date planning. Initial pilot: Okinawa Main Island, Japan.

## Confirmed planning rules
- 90-day calendar planning horizon, producing 86 complete rolling five-day trip windows.
- 5 days / 4 nights per trip.
- Golf on trip days 2, 3, and 4 (three consecutive rounds); arrival/transfer on day 1 and departure/transfer on day 5.
- Primary date-selection objective: minimize rainfall risk.
- Return three distinct candidate windows.
- Keep weather risk separate from forecast/data confidence.
- Do not represent seasonal outlooks as deterministic daily forecasts.

## Current implementation
The initial date engine is a deterministic planning component. It creates rolling trip windows and ranks them using supplied daily risk inputs. It does not fetch live weather. Demonstration inputs are synthetic and must not be used for booking decisions.

## Forecast horizon policy
- Days 1-16: daily/hourly forecast data, subject to provider coverage.
- Days 17-46: extended-range weekly trends and anomalies; not deterministic daily rainfall forecasts.
- Days 47-90: seasonal probabilities and climatology only; no fabricated daily rain probability.

## Development principles
- Keep this repository independent from Taiwan Golf Weather and World Golf Weather projects.
- Missing weather data must remain missing; never silently convert it to zero rainfall.
- Record provider, model, issue time, valid time, and lead time for forecast verification.
- Calibrate scoring thresholds against historical hindcasts before operational booking advice.

## Local test
Run `npm test` with Node.js 20 or newer. Open `index.html` in a modern browser for the synthetic-data demo.

## Preview deployment

A GitHub Actions workflow is included at `.github/workflows/deploy-pages.yml`.
In repository Settings → Pages, set the build and deployment source to **GitHub Actions**.
After that one-time repository setting, pushes to `main` publish the static preview automatically.

The preview currently uses synthetic demonstration data only. It is not a live forecast or booking recommendation.


## Forecast maturity adapter

`assets/js/forecast-maturity.js` classifies every requested date by lead time and preserves source provenance. It deliberately does not create a numeric V1 risk score or merge historical climate values into a missing short-range forecast. Long-range adjusted wet-day frequency remains labelled as a climate estimate, never as daily rain probability.

## Historical climate trip-date preview

`scripts/rank_golf_trip_dates.py` ranks complete five-day windows using a computed 1991-2020 Japan regional climatology file. A 90-day calendar horizon contains 86 complete windows. Golf days are fixed to the middle three consecutive dates (trip days 2-4); the engine does not cherry-pick three dates from all five days. This remains a historical-climate preview and is not enabled for production booking advice.
