# Okinawa Six-Course Acceptance Status — 2026-11-27

## Scope and acceptance sequence

Fixed scope: the six user-approved Okinawa main-island golf courses only. This is a data and weather-engine acceptance exercise. App visual design, page structure, navigation, and forecast/report architecture remain unchanged.

Sequence:
1. GPS consistency
2. 16-day hourly/daily forecast completeness
3. D19-D90 seasonal + historical estimates
4. JMA AMeDAS observation-based forecast comparison
5. Six-hour tee-time suitability analysis
6. North/central/south forecast-grid and microclimate differences

## Stage 1 — GPS consistency

**Result: PASS**

The six exact user-provided Google Maps coordinates are synchronized across:
- `config/okinawa/course-coordinate-candidates.json`
- `config/global/courses.json`
- `assets/js/okinawa-courses.js`

The App runtime directory test confirms the six courses load and that the exact coordinates are passed to Open-Meteo without substitution.

## Stage 2 — 16-day forecast completeness

**Result: PASS — data completeness only, not forecast accuracy**

For all six course points:
- 16 daily rows and 384 hourly rows per course.
- 9 daily fields and 11 hourly fields checked.
- 20/20 fields have 100% numeric coverage for each course.
- Daily timestamps are consecutive; hourly timestamps are consecutive; daily/hourly date ranges align.
- Relative humidity, wind direction, and UV index are included in the strict gate.

No missing values were found in the 20 required fields in the validation sample.

## Stage 3 — D19-D90 seasonal + historical estimates

**Result: PASS with an explicit source-availability fallback**

At reference date 2026-11-27, each course produced 72 daily rows (D19-D90), with ten years (2016-2025) of historical same-calendar-day ERA5 samples.

| Horizon | Seasonal + historical | Historical-only | Core estimate fields missing |
|---|---:|---:|---:|
| D19-D46 | 28/28 | 0 | 0 |
| D47-D90 | 20/44 | 24 | 0 |
| Total | 48/72 | 24 | 0 |

The current seasonal payload provides monthly signals for December 2026 and January 2027, but not February 2027. February dates therefore use historical-only estimates; seasonal wind remains null rather than being carried forward from January.

`rainChanceEstimate` is an adjusted historical wet-day frequency estimate, not calibrated daily precipitation probability. No gust estimate is invented for D19-D90.

## Stage 4 — JMA AMeDAS observation comparison

**Result: observation metadata and forecast/observation pairing PASS; forecast skill remains preliminary**

Observation period: 2026-11-20 through 2026-11-26 (seven complete days).

Official JMA station table metadata matched for all four validation stations:
- Nago (91107)
- Itokazu (91241)
- Yomitan (91121)
- Miyagijima (91166)

All 224 expected station/block files were retrieved. Each station provided 157 valid hourly samples out of 168 possible hours in this seven-day period. JMA quality flags 0 and 1 were accepted; other flags were treated as missing.

Forecast comparison models:
- ECMWF IFS 0.25°
- JMA GSM
- JMA MSM

The archived forecast values were paired to AMeDAS observations by identical Asia/Tokyo valid timestamp and previous-run lead offset. Metrics include temperature, precipitation amount, wind speed, and rain-event POD/FAR/CSI at 0.1, 1, and 5 mm/hour thresholds.

Selected aggregate descriptive results (weighted across available station samples):

| Model | Lead | Temperature MAE | Precipitation MAE | Wind MAE |
|---|---:|---:|---:|---:|
| ECMWF IFS 0.25° | 1 day | 0.97 °C | 0.23 mm/h | 1.16 m/s |
| ECMWF IFS 0.25° | 7 days | 1.32 °C | 0.36 mm/h | 1.84 m/s |
| JMA GSM | 1 day | 1.29 °C | 0.33 mm/h | 1.76 m/s |
| JMA GSM | 7 days | 1.65 °C | 0.44 mm/h | 1.78 m/s |
| JMA MSM | 1 day | 1.12 °C | 0.34 mm/h | 1.62 m/s |
| JMA MSM | 2 days | 1.14 °C | 0.35 mm/h | 1.63 m/s |

JMA MSM had usable previous-run pairs for only lead days 1-2 in this sample; days 3-7 were not available and are not scored.

Course-to-station reference distances:
- Southern Links → Itokazu: 5.11 km
- Palm Hills → Itokazu: 7.47 km
- PGM precipitation → Yomitan: 10.22 km
- PGM temperature/wind → Miyagijima: 18.21 km
- Kanehide Kise → Nago: 8.10 km
- Atta Terrace → Nago: 12.45 km
- Chura Orchard → Nago: 11.88 km

These are station proxies, not on-course sensors. In particular, PGM temperature/wind representativeness is weak at 18.21 km. Station elevation is reported separately; course elevation has not been independently established.

This seven-day sample is a first observed-skill pilot, not a multi-season calibration. It is not sufficient to set production bias corrections or declare one model universally best. AMeDAS gust is a separate daily maximum instantaneous field and is not included in hourly wind MAE; apparent temperature is not directly measured by AMeDAS.

The JMA point JSON feed is an undocumented internal feed used by the JMA website, not a formally documented public API. The validation report records this dependency and its schema-change risk.

## Stage 5 — Six-hour tee-time suitability

**Result: PASS — data completeness and scoring execution; thresholds remain uncalibrated**

The existing hourly report now includes a six-hour overall suitability summary inside the current report section. Navigation and page architecture are unchanged.

For each of the six courses, the validator evaluated all future tee windows for tee hours 06:00-13:00, using six consecutive hours from tee-off through tee-off +5h. Past tee windows on the current day were excluded.

- 120 future windows per course; 720/720 scored.
- All seven required hourly inputs had 100% numeric coverage at every course: precipitation probability, precipitation amount, air temperature, apparent temperature, wind speed, wind gust and weather code.
- Missing hours or missing required values fail closed; no interpolation or partial-field score is allowed.
- Thunderstorm and high-wind/heavy-rain safety overrides are evaluated separately from the A-E score.

| Course | A | B | C | D | E | Average score |
|---|---:|---:|---:|---:|---:|---:|
| Southern Links | 4 | 30 | 40 | 45 | 1 | 76.5 |
| Palm Hills | 5 | 31 | 39 | 44 | 1 | 76.7 |
| PGM | 16 | 13 | 36 | 52 | 3 | 76.0 |
| Atta Terrace | 17 | 13 | 35 | 52 | 3 | 76.1 |
| Chura Orchard | 16 | 14 | 35 | 52 | 3 | 76.1 |
| Kanehide Kise | 11 | 22 | 43 | 37 | 7 | 75.9 |

The A-E grading and rain/environment risk thresholds are transparent prototype rules, not calibrated probabilities of cancellation, injury, or successful play. This stage validates complete input and deterministic execution, not actual play outcomes.

## Stage 6 — North/central/south grid and regional observation contrast

**Result: forecast-grid comparison PASS; regional station observation comparison PASS; microclimate conclusion remains provisional**

### Open-Meteo forecast grids

All six course points returned 16 daily and 384 hourly rows. They map to three unique provider grid cells:

| Grid cell | Courses | Area labels |
|---|---|---|
| 26.18629, 127.69737 | Southern Links, Palm Hills | South |
| 26.467485, 127.863434 | PGM, Atta Terrace, Chura Orchard | Central + North |
| 26.537785, 128.00441 | Kanehide Kise | North |

The requested course point to returned grid offset ranges from 4.50 km to 9.07 km. Same-grid comparisons show:
- Rain probability, wind speed and gust series are identical for courses sharing the same grid.
- Temperature differs by up to 0.30 °C and apparent temperature by up to 0.50 °C in same-grid pairs.
- Returned grid elevations differ between courses sharing a grid (for example, the PGM/Atta/Chura group returns 63 m, 68 m and 41 m). These small temperature differences may reflect provider elevation/downscaling adjustments, not independent microclimate modelling.

Sixteen-day model-grid regional averages:

| Area | Mean temperature | Mean feels-like | Mean rain probability | Mean wind | Mean gust |
|---|---:|---:|---:|---:|---:|
| South | 21.78 °C | 22.65 °C | 22.03% | 4.30 m/s | 9.26 m/s |
| Central | 22.03 °C | 22.98 °C | 23.72% | 4.25 m/s | 9.54 m/s |
| North | 21.70 °C | 22.65 °C | 23.72% | 4.08 m/s | 9.34 m/s |

These are descriptive model-grid averages, not independent regional samples: several courses share a grid cell.

### Ten-station JMA AMeDAS regional observations

The official station table metadata matched for all ten configured Okinawa reference stations. All 560 station/block files were retrieved for 2026-11-20 through 2026-11-26. Each station supplied 156 valid hourly samples out of 168 possible in this run.

| Area | Stations | Mean station rain total | Mean temperature | Mean wind |
|---|---:|---:|---:|---:|
| South | 3 | 20.67 mm | 19.87 °C | 5.72 m/s |
| Central | 3 | 38.50 mm | 19.83 °C | 5.31 m/s |
| North | 4 | 60.00 mm | 18.41 °C | 3.60 m/s |

This one-week sample was wetter and cooler at the northern station group, while the southern station group had higher mean wind. It is an observed weather contrast for this particular week, not a stable microclimate climatology. North includes Oku at 232 m elevation; regional station means are affected by station elevation and exposure.

Course reference station distances remain material: Southern Links 5.11 km, Palm Hills 7.47 km, PGM rain reference 10.22 km and temperature/wind reference 18.21 km, Atta 12.45 km, Chura 11.88 km, and Kise 8.10 km. No station is an on-course sensor.

**Microclimate status:** provisional. The model-grid comparison and seven-day station contrast are complete, but they do not prove fairway-scale sea-breeze, slope, coastal-exposure or localized rainfall differences. A longer seasonal observation record and/or on-course sensors would be needed for that conclusion.

## Current test, deployment and report references

- Node test suite: 120/120 passing, 0 failures.
- Date engine tests: passing.
- Latest six-stage acceptance workflow: [GitHub Actions run 45940448320](https://github.com/jenny6601/Asia-Golf-90-Day-Planner/actions/runs/45940448320).
- Latest Cloudflare preview deployment: [85ae1a67 preview](https://85ae1a67.asia-golf-climate.pages.dev).
- Stable preview alias: [Asia Golf Climate Preview](https://asia-eight-country-shared-en.asia-golf-climate.pages.dev).
- Full acceptance artifacts: [workflow artifact 15172238668](https://github.com/jenny6601/Asia-Golf-90-Day-Planner/actions/runs/45940448320/artifacts/15172238668).
- Development branch: `asia-eight-country-shared-engine`.
- Current code commit at this report: `74f47b080e3a304ee8f727c6554be1f6cc17c898`.

## Final acceptance interpretation

All six planned stages have been executed. GPS, 16-day data completeness, D19-D90 estimate availability, JMA observation pairing, six-hour scoring data, and forecast-grid comparison have passed their stated data/processing gates.

This is not a blanket declaration that forecast accuracy or golf-course microclimate has been fully calibrated. The remaining scientific limitations are:
1. JMA forecast skill comparison currently covers seven complete days and is preliminary.
2. D47-D90 February 2027 has historical-only estimates where the seasonal provider supplies no February monthly signal; seasonal wind is left blank there.
3. Six-hour A-E suitability thresholds are not yet calibrated against a multi-season observed playability dataset.
4. Regional microclimate differences remain provisional because station proxies are several kilometres from courses and the observation sample is only one week.

No global model weights or long-range estimate formulas were changed during acceptance. The only report UI addition is the six-hour summary inside the existing hourly report; page navigation and overall architecture remain unchanged.
