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

## Test and workflow references

- Node test suite: 108/108 passing, 0 failures.
- Date engine tests: passing.
- Okinawa six-course acceptance workflow: [GitHub Actions run 45939563902](https://github.com/jenny6601/Asia-Golf-90-Day-Planner/actions/runs/45939563902).
- Code branch: `asia-eight-country-shared-engine`.
- Stage 4 report artifact is attached to the workflow run above.

## Remaining stages

- Stage 5: verify six-hour tee windows, rainfall, temperature, apparent temperature, wind, gust, and suitability grade calculations.
- Stage 6: compare the north, central, and south forecast grid cells and distinguish grid-cell differences from actual microclimate differences.

No production scoring thresholds, model weights, or App UI have been changed as a result of this validation.
