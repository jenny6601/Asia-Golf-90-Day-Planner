# Phase 12 — Okinawa multi-provider golf date decision

## Goal

Turn the existing independent forecast feeds into an auditable decision aid for a five-day/four-night Okinawa trip with golf on Days 2–4. The user's primary objective is to minimize rainfall exposure while retaining explicit wind, thermal-comfort and severe-weather screening.

## Required evidence

- Open-Meteo hourly course-vicinity forecast.
- Visual Crossing hourly forecast.
- Foreca hourly forecast where available. Foreca three-hourly accumulations are not coerced into hourly amounts.
- Identical local tee-off window (six hours beginning at the selected tee hour).
- At least two complete, comparable providers for each golf day.
- Complete playability overlay inputs: wind, gust, apparent temperature and weather code.

## Ranking method

Each provider is independently scored:
- Rainfall: 65% of the weather score, using mean hourly precipitation probability, six-hour accumulated precipitation and peak hourly precipitation.
- Wind: 15%, using peak gust (or wind when gust is absent).
- Thermal comfort: 20%, using the worst feels-like temperature across the six-hour window.

For each component, the multi-provider consensus is the median across complete providers. Itinerary risk is 70% of the mean of the three golf-day risks plus 30% of the worst golf-day risk. Lower values rank earlier. Up to three trip windows are returned, separated by at least five days.

## Safety exclusion

A trip window is excluded if any golf day has severity 3 in the playability overlay, including thunderstorm codes, strong wind/gust or extreme apparent temperature. Severity 2 is displayed as a caution and does not automatically veto the window. This is a conservative prototype screen, not an official warning service or a calibrated safety/cancellation model.

## User-facing decision details

Phase 12 displays:
- Total candidate windows, fully scored windows, severe-weather exclusions and insufficient-data windows.
- The recommended five-day/four-night date range.
- A separate row for each golf day with weighted risk, component risks, provider count and names, provider spread, playability grade/reasons and coordinate confidence.
- An explicit no-recommendation explanation when complete provider coverage is insufficient.
- Automatic recalculation after changing tee-off time.

## Coordinate confidence

Verified and provisional course-vicinity coordinates are allowed for preliminary forecasts. Provisional coordinates are labeled separately; they do not imply a surveyed course boundary or exact fairway point. Coordinates without numeric latitude/longitude remain excluded.

## Limitations and next validation

- Connectivity and passing unit tests do not establish forecast accuracy.
- Weights and thresholds are provisional and need hindcast calibration against observed weather at the selected course locations.
- Provider count is not the same as provider independence or accuracy.
- A 16-day forecast window is the only horizon currently eligible for this numerical multi-provider ranking. Days 17–46 and 47–90 remain separate weekly/monthly tendency products and must not be combined into the short-range numeric risk score.
- Confirm tee-time availability, course closures and official weather warnings directly before booking.
