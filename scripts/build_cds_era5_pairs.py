#!/usr/bin/env python3
"""Strictly pair CDS hindcast records with ERA5 reanalysis proxy records.

No retrieval is performed here. Pairing requires identical course, valid time,
variable, unit and temporal semantics; ambiguous/missing ERA5 matches are
reported, never guessed or interpolated.
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

PAIR_FIELDS = ("countryCode", "courseId", "validTime", "variable", "unit", "temporalSemantics")

def pair_key(record):
    return tuple(record.get(field) for field in PAIR_FIELDS)

def validate_era5_record(record):
    required = list(PAIR_FIELDS) + ["value", "verificationSource"]
    missing = [key for key in required if record.get(key) in (None, "")]
    if record.get("verificationSource") != "ERA5-reanalysis-proxy":
        missing.append("verificationSource_must_be_ERA5-reanalysis-proxy")
    if not isinstance(record.get("value"), (int, float)):
        missing.append("value_numeric")
    if record.get("temporalSemantics") in (None, "", "unknown"):
        missing.append("temporalSemantics")
    return missing

def build_pairs(batch, era5_records):
    forecasts = batch.get("records", [])
    index = defaultdict(list)
    invalid_era5 = []
    for position, record in enumerate(era5_records):
        missing = validate_era5_record(record)
        if missing:
            invalid_era5.append({"index": position, "missing": missing})
            continue
        index[pair_key(record)].append(record)

    paired, unmatched, ambiguous = [], [], []
    for position, forecast in enumerate(forecasts):
        missing = [field for field in PAIR_FIELDS if forecast.get(field) in (None, "")]
        if missing or forecast.get("temporalSemantics") == "unknown":
            unmatched.append({"forecastIndex": position, "reason": "forecast-missing-pair-fields", "missing": missing})
            continue
        candidates = index.get(pair_key(forecast), [])
        if len(candidates) == 0:
            unmatched.append({"forecastIndex": position, "reason": "no-exact-era5-match"})
            continue
        if len(candidates) > 1:
            ambiguous.append({"forecastIndex": position, "reason": "multiple-era5-matches", "matchCount": len(candidates)})
            continue
        era5 = candidates[0]
        if forecast.get("temporalSemantics") != era5.get("temporalSemantics"):
            unmatched.append({"forecastIndex": position, "reason": "temporal-semantics-mismatch"})
            continue
        if forecast.get("unit") != era5.get("unit"):
            unmatched.append({"forecastIndex": position, "reason": "unit-mismatch"})
            continue
        paired.append({
            "countryCode": forecast["countryCode"],
            "courseId": forecast.get("courseId"),
            "provider": "CDS",
            "model": forecast.get("model", batch.get("model")),
            "modelVersion": forecast.get("modelVersion", batch.get("modelVersion")),
            "initializationTime": forecast["initializationTime"],
            "validTime": forecast["validTime"],
            "leadDays": forecast["leadHours"] / 24,
            "leadHours": forecast["leadHours"],
            "ensembleMember": forecast.get("ensembleMember"),
            "variable": forecast["variable"],
            "forecastValue": forecast["value"],
            "verificationValue": era5["value"],
            "verificationSource": "ERA5-reanalysis-proxy",
            "temporalSemantics": forecast["temporalSemantics"],
            "unit": forecast["unit"],
            "spatialMethod": forecast.get("spatialMethod"),
            "nearestGridDistanceKm": forecast.get("nearestGridDistanceKm"),
            "qualityStatus": "paired-proxy-not-station-truth"
        })

    report = {
        "status": "paired-proxy-samples-created" if paired else "no-valid-pairs",
        "forecastRecordCount": len(forecasts),
        "era5RecordCount": len(era5_records),
        "pairedRecordCount": len(paired),
        "unmatchedForecastCount": len(unmatched),
        "ambiguousForecastCount": len(ambiguous),
        "invalidEra5RecordCount": len(invalid_era5),
        "pairingFields": list(PAIR_FIELDS),
        "matchingPolicy": "exact-course-valid-time-variable-unit-temporal-semantics",
        "verificationBoundary": "ERA5 is a reanalysis proxy, not station observation or issued forecast",
        "pairedSamples": paired,
        "unmatchedForecasts": unmatched,
        "ambiguousForecasts": ambiguous,
        "invalidEra5Records": invalid_era5
    }
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--forecast-batch", required=True)
    parser.add_argument("--era5-records", required=True)
    parser.add_argument("--output", default="artifacts/cds-era5-paired-verification.json")
    args = parser.parse_args()
    batch = json.loads(Path(args.forecast_batch).read_text(encoding="utf-8"))
    era5 = json.loads(Path(args.era5_records).read_text(encoding="utf-8"))
    records = era5.get("records", era5) if isinstance(era5, dict) else era5
    if not isinstance(records, list):
        raise ValueError("ERA5 input must be a JSON array or an object containing records[]")
    report = build_pairs(batch, records)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in [
        "status", "forecastRecordCount", "era5RecordCount", "pairedRecordCount",
        "unmatchedForecastCount", "ambiguousForecastCount", "invalidEra5RecordCount"
    ]}, indent=2))

if __name__ == "__main__":
    main()
