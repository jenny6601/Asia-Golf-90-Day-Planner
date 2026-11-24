# Okinawa Six-Course Live Weather Coverage V1

## Purpose
Run a manual, read-only live API connectivity and hourly coverage check for the six selected Okinawa golf courses. This workflow does not deploy, change production scoring, or rank travel dates.

## Sources
- Open-Meteo Forecast API (no key in this workflow).
- Visual Crossing Timeline API (GitHub Actions secret `VISUAL_CROSSING_API_KEY`).
- Foreca Point Forecast API (GitHub Actions secret `FORECA_API_KEY`).
- JMA MSM is listed separately as not configured. Do not substitute JMA GSM, JMA Seamless, or a city proxy and label it MSM.

## Course-coordinate gate
- Southern Links: verified official map pin; may enter operational course-point analysis.
- Palm Hills, Kanehide Kise, Atta Terrace and Chura Orchard: provisional points; connectivity checks only.
- PGM Okinawa: GPS pending; skipped without substituting a city or proxy point.

## Time and fields
- Course timezone: Asia/Tokyo.
- Display window: 06:00–18:00.
- Standard tee time: 10:00.
- Playability window: 10:00–16:00.
- Normalize temperature, apparent temperature, humidity, precipitation probability, precipitation amount, wind speed, gust, wind direction and weather code.
- Preserve precipitation accumulation interval; do not compare one-hour and three-hour accumulations as if equivalent.
- Missing values remain null. No provider fallback is allowed.

## Run
GitHub Actions → Okinawa Six-Course Live Weather Coverage → Run workflow.
Artifacts: `okinawa-six-course-live-weather-coverage`.

Add repository secrets under Settings → Secrets and variables → Actions:
- `VISUAL_CROSSING_API_KEY`
- `FORECA_API_KEY`

If a secret is absent, that provider is reported unavailable; the workflow still records the other independent sources.

## Limitations
This is a live connectivity/coverage smoke test, not forecast-accuracy validation. Provisional course points must not be used for trip ranking. JMA MSM remains unavailable until a verified MSM point-data ingestion route and parser are implemented.
