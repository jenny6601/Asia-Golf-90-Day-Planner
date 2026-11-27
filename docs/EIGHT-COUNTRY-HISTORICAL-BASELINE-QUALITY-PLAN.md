# Eight-Country Historical Baseline — Phase 1 Quality Plan

## Objective
Establish an auditable 1991–2020 historical climate baseline for the 80 approved regional representative points across Japan, South Korea, China, Vietnam, Thailand, Malaysia, Singapore and Indonesia. One point represents each golf-destination subregion; exact golf-course-centre coordinates are not required.

## Phase 1A — Representative-point and grid preflight
- Input registry: `config/global/weather-subregions.json`.
- Audit output: `data/era5-land-eight-country-1991-2020/representative-point-quality-audit.json`.
- Rebuild command: `python scripts/build_representative_point_quality_audit.py --write`.
- The nearest 0.1-degree coordinate is only a candidate. The ERA5-Land guide states that requested coordinates are rounded to the nearest 0.1-degree grid point; the actual coordinates returned in each downloaded file must be recorded and compared before accepting a point.
- Do not infer a valid land cell from rounded coordinates alone. Preserve returned coordinates, distance, land/ocean context and quality flags.
- No universal radius cutoff is imposed; review regional representativeness, coastal/inland setting and terrain context.

## Phase 1B — Independent observation source discovery
The initial source inventory is in `config/global/observation-source-readiness.json`.

| Country | Initial evidence | Current limitation / next action |
|---|---|---|
| Japan | JMA station portal is already specified in the engine plan | Build station inventory and verify per-element history and station moves |
| South Korea | KMA ASOS portal documents minute/hour/day/month/year data and historical records from 1904 for some station/element combinations; selected elements have QC flags | Download station inventory; verify record continuity and QC semantics |
| China | No verified archive endpoint in this pass | Official archive discovery required |
| Vietnam | National service response says station records generally start 1977 onward, hourly/daily formats are possible, and access is fee-based | Request access, pricing and license terms |
| Thailand | No verified archive endpoint in this pass | Official archive discovery required |
| Malaysia | No verified archive endpoint in this pass | Official archive discovery required |
| Singapore | NEA/MSS publishes historical daily station records; duration varies by station; some additional extraction is paid | Obtain station list and element coverage |
| Indonesia | SACA&D provides some daily station series for non-commercial research; BMKG access restrictions apply to some products | Check licensing and commercial-use rights before acquisition |
| Global fallback | NOAA GHCN-Daily provides quality-reviewed daily station records across many countries | Coverage varies by station and element; many stations report precipitation only |

A portal being found is not proof that a suitable station exists near a representative point or that 1991–2020 data can be downloaded under an acceptable license.

## Phase 1C — Station matching
For each representative point:
1. Enumerate candidate stations from official national station metadata first.
2. Record station ID, name, coordinates, elevation, operating period, relocation history and element availability.
3. Calculate distance and elevation difference from the regional point.
4. Review coastal exposure, mountain/valley setting and local climate representativeness.
5. Select the nearest *representative* station, not automatically the nearest station.
6. Use NOAA GHCN-Daily only as a documented fallback when official access or element coverage is inadequate.

Do not collapse station observations into ERA5-Land records. Keep source observations and reanalysis separate.

## Phase 1D — ERA5-Land pilot and production acquisition
ERA5-Land provides hourly land-surface reanalysis, globally, on a 0.1-degree grid. The time-series product documents 2 m temperature, 2 m dewpoint, total precipitation and 10 m wind components. Its guide documents de-accumulated hourly precipitation for that time-series product. Do not reuse that precipitation rule blindly for the separate full-dataset GRIB product.

Recommended execution:
1. Run a multi-year pilot for one representative point in each distinct time-zone regime and climate setting.
2. Inspect returned coordinates, GRIB variable metadata, time axis, precipitation accumulation semantics and local-day boundaries.
3. Aggregate hourly UTC samples to each point's IANA local time.
4. Require explicit hourly completeness and preserve missing values as null.
5. Compare the pilot's daily totals against an independent station series before scaling.
6. Only after the pilot passes, expand to all 80 points and the full 1991–2020 period.

The current 240-request manifest is a prepared plan only; no full 80-point historical dataset has been acquired. Do not submit all requests before the pilot's returned-grid and precipitation semantics are validated.

## Acceptance gates
- 80/80 regional points and IANA timezones present.
- Actual returned grid coordinates inspected and stored.
- Every dataset variable has unit and accumulation semantics documented.
- Daily local-time aggregation passes boundary-day tests.
- Missing or invalid observations are never replaced by zero.
- Each station comparison reports sample count, element completeness, bias, MAE/RMSE and wet-day contingency; station distance, elevation difference and relocation history remain visible.
- Coverage gaps are explicit; no unverified station is treated as ground truth.
- Historical climate and independent station observations remain separate.
- Climate baseline and decision use remain disabled until QA gates pass.

## Current execution state
- Point preflight audit: created for all 80 points.
- Missing coordinates/timezones in the registry: 0.
- Actual returned grid points verified: 0.
- Independent station matches: 0.
- Historical 1991–2020 records acquired for the eight-country engine: 0.
- App screens and interaction flow changed: no.
- D01–D16 forecast behavior changed: no.

## References
- [ERA5-Land dataset](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land)
- [ERA5-Land time-series Product User Guide](https://confluence.ecmwf.int/pages/viewpage.action?pageId=690470575)
- [KMA ASOS historical observations](https://data.kma.go.kr/data/grnd/selectAsosRltmList.do)
- [Vietnam National Hydro-Meteorological Service data access response](https://vnmha.mae.gov.vn/chi-tiet-hoi-dap-12.htm)
- [Singapore historical daily records](https://www.weather.gov.sg/climate-historical-daily)
- [SACA&D daily station data](https://sacad.bmkg.go.id/dailydata/index.php)
- [NOAA GHCN-Daily](https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily)
