# Asia Golf Climate — Eight-Country Shared Climate Engine

## Purpose

This is the master architecture for the historical climate and independent-validation data engine across all eight supported markets: Japan, South Korea, China, Vietnam, Thailand, Malaysia, Singapore and Indonesia.

It supersedes the Japan-only regional climate plan as the shared-engine scope. The Japan ERA5-Land/JMA work remains a country adapter and pilot; it is not the architecture template that every other country must copy.

## Geographic contract

- Read country and subregion membership from `config/global/countries.json` and `config/global/weather-subregions.json`.
- Current registry contains 19 Japan, 6 South Korea, 7 China, 6 Vietnam, 7 Thailand, 8 Malaysia, 1 Singapore and 8 Indonesia subregions.
- Use exactly one representative point per subregion for regional climate assessment.
- Do not create per-course historical climate records. Courses in the same subregion inherit the same regional assessment.
- Use the IANA timezone attached to each representative point for local-day aggregation.
- Coordinates are regional climate points; surveyed clubhouse/fairway precision is not required.

## Shared baseline

Use one common, global historical backbone: Copernicus ERA5-Land hourly reanalysis, reference period 1991–2020. This avoids eight incompatible climate baselines and permits consistent comparison across countries.

Production acquisition must use the full ERA5-Land hourly dataset. The optimized single-point time-series endpoint is suitable for pilot/schema work but is not the production dependency because its product guidance notes that it is not recommended for production and its structure may change.

The normalized daily record must retain source provenance, returned grid coordinates, distance to representative point, local timezone, unit conversions, aggregation method and quality flags. Missing observations remain null; missing precipitation must never be converted to zero.

## Independent validation

ERA5-Land is the shared baseline, not its own independent validation. Validate it against ground-station observations:

1. Prefer the national meteorological service archive for the country when station history, daily elements and quality metadata are available.
2. Use NOAA GHCN-Daily as a cross-country fallback or supplementary observation source where station coverage, element availability, record length, provenance and usage terms are adequate.
3. Do not assume every subregion has a suitable station. Report station distance, elevation difference, element coverage, record length, homogeneity/relocation flags and representativeness limitations.
4. Keep country-specific formats and quality codes inside source adapters. Japan JMA's CSV structure must not become a requirement for Korea, China, Vietnam, Thailand, Malaysia, Singapore or Indonesia.
5. Do not apply automatic bias correction.

Candidate national agency adapters: Japan Meteorological Agency (JP), Korea Meteorological Administration (KR), China Meteorological Administration (CN), Vietnam national hydro-meteorological service (VN), Thai Meteorological Department (TH), MetMalaysia (MY), Meteorological Service Singapore (SG), and BMKG (ID). All non-Japan adapters remain discovery-required until their actual historical data access, station metadata, quality flags and terms are verified.

## Shared quality gates

- At least 24 valid years in the 1991–2020 reference period.
- At least 90% daily completeness per element and per subregion.
- Validate precipitation, Tmin and Tmax independently; do not infer that one complete element means all are complete.
- Audit local-day boundaries, hourly coverage, source units and grid-cell coordinates.
- Review station relocation/homogeneity and geographic representativeness.
- Keep reanalysis and station observations as separate source families.
- Do not activate historical climate, long-range outlook or date-decision use until all required gates and coverage reports pass.

## App boundary

This is a backend-only data-engine phase. Do not change App screens, user interaction flow, existing D01–D16 live forecast behavior, or formal V1 scoring weights.

## Machine-readable specification

The authoritative machine-readable configuration is `config/global/eight-country-climate-engine.json`.
