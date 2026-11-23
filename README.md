# Asia-Golf-90-Day-Planner

Asia Golf 90-Day Travel Weather Forecast and Date Recommendation System.

## Project status

Phase 1: destination-first 90-day trip-date planning. Initial pilot: Okinawa Main Island, Japan.

## Confirmed planning rules
- 90-day planning horizon.
- 5 days / 4 nights per trip.
- Golf on trip days 2, 3, and 4; travel on days 1 and 5.
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
