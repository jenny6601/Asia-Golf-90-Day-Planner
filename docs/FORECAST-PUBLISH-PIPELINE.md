# Forecast data publishing pipeline — Phase 1

## Purpose
Make scheduled server-side forecast snapshots available to the static GitHub Pages planner without exposing provider credentials in browser code.

## Current data products
- Open-Meteo Forecast API: 16-day hourly and daily data for Okinawa north, central, and south.
- WeatherAPI.com Forecast API: 3-day hourly data for the same zones (current configured free-tier coverage).
- Cross-provider comparison: only the overlapping future hourly valid times are compared.

## Publication
The Daily Paired Weather Audit workflow:
1. Runs the repository test suite.
2. Fetches WeatherAPI using the GitHub Actions secret `WEATHERAPI_KEY`.
3. Fetches 16-day Open-Meteo forecasts.
4. Saves a complete audit artifact.
5. Publishes the latest JSON to the dedicated `forecast-data` branch at `data/latest.json`.

The public data URL for a static client is:
`https://raw.githubusercontent.com/jenny6601/Asia-Golf-90-Day-Planner/forecast-data/data/latest.json`

The data branch contains forecast data only. It must never contain provider credentials or source code changes.

## Integration status
This PR establishes secure data delivery only. The browser application is not yet switched to consume this URL. A separate UI integration change must:
- Validate schemaVersion and capturedAt freshness.
- Display Open-Meteo D1-D16 and WeatherAPI D1-D3 as separate source records.
- Display cross-provider agreement only for common timestamps.
- Fail closed on stale/malformed data and preserve the current live Open-Meteo fallback.
- Never average uncalibrated provider probabilities into a fabricated single forecast.

## Limitations
- WeatherAPI coverage is 3 days in the configured plan.
- Open-Meteo forecast is up to 16 days.
- The two products must remain separately attributable.
- Provider agreement is not forecast accuracy.
- EC46/SEAS5 17-90 day outlook remains a separate product and must not be merged into deterministic daily values.
