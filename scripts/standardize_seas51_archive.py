#!/usr/bin/env python3
"""Normalize SEAS5.1 course-point CSV into the shared CDS archive envelope.

This is a deterministic transformation only: no network, storage writes, or
live-forecast integration. Unknown temporal semantics are retained in the
rejected-record report, never silently treated as precipitation accumulation.
"""
import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

MODEL = "ECMWF-SEAS5.1"
MODEL_VERSION = "System 51"
DATASET = "seasonal-original-single-levels"

def iso_datetime(date_value, time_value):
    date_text = str(date_value or "").strip()
    time_text = str(time_value or "0").strip().zfill(4)
    if not date_text or date_text in {"None", "null"}:
        raise ValueError("missing date")
    parsed_date = datetime.strptime(date_text, "%Y%m%d")
    hour, minute = int(time_text[:2]), int(time_text[2:4])
    return parsed_date.replace(hour=hour, minute=minute, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

def temporal_semantics(step_type):
    value = str(step_type or "").strip().lower()
    return {
        "instant": "instantaneous",
        "accum": "period_accumulation",
        "avg": "period_average",
        "max": "period_maximum",
        "min": "period_minimum",
    }.get(value, "unknown")

def normalize_row(row):
    init_time = iso_datetime(row.get("initializationDate"), row.get("initializationTime"))
    valid_time = iso_datetime(row.get("validDate"), row.get("validTime"))
    lead = int(row["leadHour"])
    if lead < 0:
        raise ValueError("negative lead hour")
    value = float(row["value"])
    distance = float(row["nearestGridDistanceKm"])
    if distance < 0:
        raise ValueError("negative nearest-grid distance")
    member_value = row.get("ensembleMember")
    member = int(member_value) if member_value not in (None, "", "None") else None
    record = {
        "source": "CDS",
        "dataset": DATASET,
        "model": MODEL,
        "modelVersion": MODEL_VERSION,
        "countryCode": row.get("countryCode") or None,
        "courseId": row.get("courseId") or None,
        "initializationTime": init_time,
        "validTime": valid_time,
        "leadHours": lead,
        "ensembleMember": member,
        "variable": row.get("variable") or None,
        "value": value,
        "unit": row.get("unit") or None,
        "temporalSemantics": temporal_semantics(row.get("stepType")),
        "verificationSource": None,
        "spatialMethod": "nearest-grid-point",
        "nearestGridDistanceKm": distance,
        "qualityStatus": "unverified",
    }
    required = ["countryCode", "initializationTime", "validTime", "leadHours", "variable", "unit"]
    missing = [key for key in required if record.get(key) in (None, "")]
    if record["temporalSemantics"] == "unknown":
        missing.append("temporalSemantics")
    if datetime.fromisoformat(init_time.replace("Z", "+00:00")) > datetime.fromisoformat(valid_time.replace("Z", "+00:00")):
        missing.append("time_order")
    if missing:
        raise ValueError("quality gate: " + ",".join(missing))
    return record

def standardize(input_csv, manifest_path, output_path, batch_id=None):
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    accepted, rejected = [], []
    with Path(input_csv).open(newline="", encoding="utf-8") as handle:
        for line_number, row in enumerate(csv.DictReader(handle), start=2):
            try:
                accepted.append(normalize_row(row))
            except (ValueError, TypeError, KeyError) as exc:
                rejected.append({"sourceLine": line_number, "courseId": row.get("courseId"), "variable": row.get("variable"), "reason": str(exc), "sourceRow": row})
    if not accepted:
        raise ValueError("No records passed the normalization quality gate")
    leads = sorted({record["leadHours"] for record in accepted})
    variables = sorted({record["variable"] for record in accepted})
    init_times = sorted({record["initializationTime"] for record in accepted})
    if len(init_times) != 1:
        raise ValueError("Pilot batch must contain exactly one initialization time")
    created = manifest.get("retrieved_utc") or manifest.get("createdUtc") or datetime.now(timezone.utc).isoformat()
    batch = {
        "schemaVersion": "1.0.0",
        "batchId": batch_id or "seas51-" + init_times[0][:10].replace("-", "") + "-system51-course-points-v1",
        "retrievedAt": created,
        "dataset": DATASET,
        "model": MODEL,
        "modelVersion": MODEL_VERSION,
        "requestScope": {
            "initializationTimes": init_times,
            "leadHours": leads,
            "variables": variables,
            "spatialExtraction": "nearest-grid-point",
            "sourceManifest": str(manifest_path),
            "sourceCsv": str(input_csv),
        },
        "rawArchive": manifest.get("target") or manifest.get("input"),
        "rawSha256": manifest.get("sha256"),
        "rawArchiveSizeBytes": manifest.get("size_bytes"),
        "normalizedRecordCount": len(accepted),
        "rejectedRecordCount": len(rejected),
        "writePolicy": "append-only-no-overwrite",
        "productionForecastImpact": False,
        "records": accepted,
        "rejectedRecords": rejected,
        "qualityStatus": "unverified",
    }
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(json.dumps(batch, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return batch

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="artifacts/seas51-course-point-extract.csv")
    parser.add_argument("--manifest", default="artifacts/seas51-course-point-extract-manifest.json")
    parser.add_argument("--output", default="artifacts/seas51-normalized-archive-batch.json")
    parser.add_argument("--batch-id")
    args = parser.parse_args()
    result = standardize(args.input, args.manifest, args.output, args.batch_id)
    print(json.dumps({
        "batchId": result["batchId"],
        "normalizedRecordCount": result["normalizedRecordCount"],
        "rejectedRecordCount": result["rejectedRecordCount"],
        "leadHours": result["requestScope"]["leadHours"],
        "variables": result["requestScope"]["variables"],
        "qualityStatus": result["qualityStatus"],
        "output": args.output,
    }, indent=2))

if __name__ == "__main__":
    main()
