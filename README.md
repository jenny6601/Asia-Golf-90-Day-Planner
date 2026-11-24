# Asia-Golf-90-Day-Planner

Asia Golf 90-Day Travel Weather Forecast and Date Recommendation System.

## Current pilot

- Destination: Okinawa Main Island, Japan.
- Course catalogue: six courses.
- Trip format: 5 days / 4 nights.
- Golf rounds: trip days 2, 3 and 4; days 1 and 5 are travel days.
- Primary objective: minimize rainfall risk and return up to three distinct candidate windows.

## Forecast horizons

- **Days 1–16:** daily and hourly course-location forecasts, subject to each provider's actual coverage.
- **Days 17–46:** ECMWF extended-range weekly precipitation signals and anomalies. These are weekly trends, not deterministic daily rain forecasts.
- **Days 47–90:** seasonal/monthly precipitation and climate anomalies. These are broad regional tendencies, not daily rain probabilities or exact rainfall amounts.

Never merge these forecast horizons into one artificial numeric score. Short-range risk indices and long-range tendency tiers are ranked separately.

## Date-selection method

For each golf day, compare the same local six-hour tee-time window across available providers. Require at least two complete, comparable providers for a multi-provider score. Use the provider-wise median of:

- Rainfall risk: 65% (rain probability, accumulated amount and peak hourly amount).
- Wind risk: 15% (wind and gust).
- Temperature comfort risk: 20% (temperature and feels-like temperature).

The five-day itinerary risk is 70% of the mean of the three golf-day risks plus 30% of the worst golf-day risk. Return up to three candidate windows separated by at least five days.

A separate severe-weather override excludes a candidate if any round has a severe thunderstorm signal, extreme wind/gust, or extreme apparent-temperature signal. This is a conservative prototype rule, not a calibrated cancellation probability.

## Coordinate policy

- **Verified:** supported by an official course location/map.
- **Provisional:** reasonable numeric coordinate near the golf course; allowed for preliminary weather forecasts and date selection. Coordinate confidence remains visible and separate from forecast confidence.
- **Pending:** no usable numeric course-vicinity coordinate; excluded until a location is supplied.

A coordinate is a forecast point, not a surveyed course boundary or fairway coordinate.

## Data integrity and limitations

- Missing weather data remains missing; never replace it with zero.
- Do not fill one provider's missing values with another provider's values.
- Keep provider, model, issue time, valid time, timezone and lead time where supplied.
- Forecast disagreement is not forecast accuracy. Accuracy requires observations and historical hindcast verification.
- Current scoring weights and severe-weather thresholds are provisional and require Okinawa hindcast calibration before being treated as operational booking guidance.
- Tee-time availability, course closures and local advisories must be confirmed with the golf course.

## Provider integration

Open-Meteo is called from the browser. Visual Crossing and Foreca are retrieved through the server-side `/api/course-weather` endpoint; configure `VISUAL_CROSSING_API_KEY` and `FORECA_API_KEY` as server-side secrets. Never expose provider credentials in browser code or generated artifacts.

## Local tests

Run `npm test` with Node.js 20 or newer.
