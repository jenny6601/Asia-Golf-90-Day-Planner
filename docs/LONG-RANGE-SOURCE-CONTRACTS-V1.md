# Long-Range Weather Source Contracts V1

## Purpose and boundary

This contract standardizes source inputs before the D17-D90 daily-estimate engine is implemented. It does not fetch data, generate weather, calibrate probabilities, or authorize production. Passing validation means only that a file is structurally interpretable and its declared provenance/units are internally consistent.

The current eight-country registry is authoritative for subregionId. Every record must use one of its 80 current regional IDs and the assigned regional representative point. Do not create per-course climate records.

## Shared document envelope

Each JSON document uses schemaVersion: 1, an exact contractType, sourceId, datasetId, timezone-aware ISO-8601 retrievedAt, non-empty sourceVersion, a units object, and non-empty records[]. Every record includes subregionId, representativePointId, and an IANA timezone such as Asia/Tokyo or Asia/Seoul.

Source/model run IDs and initialization times must be retained; filenames and retrieval timestamps are not substitutes for model provenance. Missing is not zero. Omit unsupported variables rather than inserting sentinel values.

## ERA5 historical daily input

Directory: data/long-range-inputs/era5-daily/*.json

Each record is keyed uniquely by (subregionId, dateLocal) and includes:
- dateLocal: local calendar date YYYY-MM-DD
- gridCell.latitude/longitude: actual returned ERA5 grid-cell coordinates, not merely requested golf-course coordinates
- values: optional finite numeric precipitationMm, temperatureMinC, temperatureMaxC, dewpointMeanC, windSpeedMs, windDirectionDeg, cloudCoverMeanPct, relativeHumidityPct
- qualityFlags: array of source/processing quality flags

Units are declared per variable in the document: mm, degC, m/s, degrees, %. Precipitation and wind cannot be negative; humidity and cloud cover are 0-100%; Tmin cannot exceed Tmax. Mean air temperature is not a required product field. The daily feels-like estimate is derived from air-temperature bounds plus dewpoint/derived humidity and wind; daily aggregates are not time-paired, so the output must carry uncertainty and must not imply hourly precision. Preserve the ERA5 product's own accumulation semantics and document any conversion upstream; do not assume the time-series endpoint's deaccumulation rule applies to the full dataset.

## ECMWF extended-range weekly input

Directory: data/long-range-inputs/ecmwf-extended-range/*.json

Each record includes validStart, validEnd, leadDayStart, leadDayEnd, initializationTime, modelRunId, and ensembleStatistics. Supported statistics include precipitation anomaly (mm), temperature anomaly (degC), wet probability, above-normal temperature probability, and ensemble spread. Probabilities are fractions in [0,1]. These are weekly conditioning signals, not daily weather values. Preserve member-level data when available; do not expand one weekly mean into repeated daily forecasts.

## C3S multi-system monthly input

Directory: data/long-range-inputs/c3s-seasonal/*.json

Each record includes validMonth (YYYY-MM), initializationTime, systemId, tercileProbabilities for precipitation and temperature, and optional anomalies. Each below/near/above probability triplet must be within [0,1] and sum to 1 within rounding tolerance. Preserve system identity and member/hindcast linkage; multi-system consensus is not a count of independent members when products share a model family.

## Validation and activation

Run:

python -m unittest tests/test_long_range_source_contracts.py

python scripts/validate_long_range_source_contracts.py

The validator rejects missing provenance, unknown regions, malformed dates, duplicate historical dates, invalid units, impossible ranges, malformed probabilities, and malformed source records. It reports covered regions and missing region IDs. It deliberately always emits productionReady: false: structural validity is not spatial/temporal completeness, forecast skill, hindcast calibration, or authorization to generate daily estimates.

D01-D16 and all app presentation/interaction behavior remain outside this contract. No station discovery or daily observation ingestion is introduced.
