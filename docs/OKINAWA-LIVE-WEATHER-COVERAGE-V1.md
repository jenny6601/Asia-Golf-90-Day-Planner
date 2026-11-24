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

## Provider consistency analysis
The collector also writes:
- `consistency-report.json`
- `consistency-report.md`

The comparison aligns provider records by the Asia/Tokyo local wall-clock hour. Foreca's ISO timestamp offset is preserved in the source data; the comparison key uses its local date/hour prefix and does not shift it to UTC.

The 10:00–16:00 inclusive window is compared only where all three providers have a matching hour. Pairwise differences are provider disagreement metrics, not forecast accuracy. Forecast accuracy requires time-matched observations.

Apparent/feels-like temperature is not assumed to be methodologically identical across providers. Open-Meteo describes apparent temperature as combining temperature, relative humidity, wind and solar radiation. Visual Crossing describes feels-like as heat-index or wind-chill adjusted. Foreca publishes its own `feelsLikeTemp` field. Therefore, a provider value equal to air temperature is not automatically a missing-data error; report equality frequency and differences without substituting a locally calculated value.

## Phase 11.5 raw-field diagnostics
The collector requests selected raw fields from Visual Crossing and Foreca while keeping credentials out of artifacts and avoiding full-payload retention. The diagnostic output includes raw air temperature, raw feels-like temperature, relative humidity, wind speed/gust, precipitation and precipitation probability, plus normalized values and a preservation check.

Artifacts:
- `raw-field-diagnostics.json`
- `raw-field-diagnostics.md`

The raw equality rate is descriptive only. Equal air/feels-like values do not alone establish an API defect. The preservation check determines whether the normalizer passed the source feels-like value through unchanged. Humidity and wind context are retained for follow-up review.

## Phase 12 outdoor thermal screening
The collector adds Open-Meteo hourly `shortwave_radiation` and `uv_index` where available, while retaining wind speed and gust as separate exposure context.

A derived Humidex is calculated independently for each provider from that provider's air temperature and relative humidity. Published Environment and Climate Change Canada categories are used: 20–29 little discomfort; 30–39 some discomfort; 40–45 great discomfort/avoid exertion; 46+ dangerous/heat-stroke possible. Values below 20 are labelled below the published discomfort ranges, not as a medical or universal comfort guarantee.

Artifacts:
- `outdoor-thermal-screening.json`
- `outdoor-thermal-screening.md`

This screening is not WBGT, UTCI, a medical assessment, or a validated golf-specific index. Solar radiation, UV, wind and gust are retained as separate context and are not combined into an unvalidated composite score. The derived Humidex is not substituted for the providers' apparent/feels-like fields. It is a reproducible cross-source humidity/temperature calculation, not a forecast-accuracy metric.
