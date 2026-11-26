#!/usr/bin/env python3
"""Build a read-only inventory and coverage matrix from normalized CDS batches."""
import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

BANDS = (("D17-D30", 17, 30), ("D31-D45", 31, 45), ("D46-D60", 46, 60), ("D61-D90", 61, 90))

def lead_band(hours):
    try:
        days = float(hours) / 24
    except (TypeError, ValueError):
        return "unknown"
    for label, low, high in BANDS:
        if low <= days <= high:
            return label
    return "D0-D16" if days < 17 else "D90+"

def unwrap(payload):
    if not isinstance(payload, dict):
        raise ValueError("batch must be a JSON object")
    manifest = payload.get("manifest") or payload
    records = payload.get("records")
    if not isinstance(records, list):
        raise ValueError("batch records must be an array")
    return manifest, records

def record_key(row):
    fields = ("dataset", "model", "modelVersion", "countryCode", "courseId",
              "initializationTime", "validTime", "leadHours", "ensembleMember",
              "variable", "unit", "temporalSemantics", "spatialMethod",
              "nearestGridDistanceKm")
    return json.dumps([row.get(k) for k in fields], separators=(",", ":"), ensure_ascii=False)

def inventory(paths):
    batch_ids = Counter()
    record_keys = Counter()
    coverage = defaultdict(lambda: {"records": 0, "initializations": set(), "courses": set(), "batches": set()})
    invalid = []
    distance = Counter()
    semantics = Counter()
    total = 0
    batches = []
    for path in paths:
        try:
            payload = json.loads(Path(path).read_text(encoding="utf-8"))
            manifest, records = unwrap(payload)
        except Exception as exc:
            invalid.append({"file": str(path), "reason": str(exc)})
            continue
        batch_id = manifest.get("batchId")
        if not batch_id:
            invalid.append({"file": str(path), "reason": "missing-batch-id"})
        else:
            batch_ids[str(batch_id)] += 1
        declared = manifest.get("normalizedRecordCount")
        if declared is not None and declared != len(records):
            invalid.append({"file": str(path), "reason": "manifest-record-count-mismatch",
                            "declared": declared, "actual": len(records)})
        init_values = sorted({str(row.get("initializationTime")) for row in records if row.get("initializationTime")})
        batches.append({"file": str(path), "batchId": batch_id, "recordCount": len(records),
                        "initializationTimes": init_values, "rawSha256": manifest.get("rawSha256")})
        for row_index, row in enumerate(records):
            total += 1
            if not isinstance(row, dict):
                invalid.append({"file": str(path), "recordIndex": row_index, "reason": "record-not-object"})
                continue
            key = record_key(row)
            record_keys[key] += 1
            country = row.get("countryCode") or "UNKNOWN"
            variable = row.get("variable") or "UNKNOWN"
            band = lead_band(row.get("leadHours"))
            group = coverage[(country, variable, band)]
            group["records"] += 1
            if row.get("initializationTime"): group["initializations"].add(row["initializationTime"])
            if row.get("courseId"): group["courses"].add(row["courseId"])
            if batch_id: group["batches"].add(str(batch_id))
            semantics[row.get("temporalSemantics") or "missing"] += 1
            d = row.get("nearestGridDistanceKm")
            if isinstance(d, (int, float)):
                distance["over_35km" if d > 35 else "within_35km"] += 1
            else:
                distance["missing"] += 1

    duplicate_batches = sorted(k for k, n in batch_ids.items() if n > 1)
    duplicate_records = sum(n - 1 for n in record_keys.values() if n > 1)
    coverage_rows = []
    for (country, variable, band), values in sorted(coverage.items()):
        coverage_rows.append({
            "countryCode": country, "variable": variable, "leadBand": band,
            "recordCount": values["records"], "initializationCount": len(values["initializations"]),
            "courseCount": len(values["courses"]), "batchCount": len(values["batches"]),
            "initializationTimes": sorted(values["initializations"])
        })
    return {
        "status": "inventory-review-required" if invalid or duplicate_batches or duplicate_records else "inventory-structurally-valid-unverified",
        "scope": "read-only inventory of supplied normalized batch files; not skill validation",
        "batchFileCount": len(paths), "readableBatchCount": len(batches), "totalRecordCount": total,
        "uniqueBatchIdCount": len(batch_ids), "duplicateBatchIds": duplicate_batches,
        "duplicateRecordCount": duplicate_records, "invalidItems": invalid,
        "temporalSemanticsCounts": dict(semantics), "spatialDistanceCounts": dict(distance),
        "coverage": coverage_rows, "batches": batches,
        "limitations": [
            "An inventory does not prove durable storage or archive completeness.",
            "A structurally valid batch remains unverified until independently paired.",
            "ERA5 is a reanalysis proxy, not station truth.",
            "Duplicate record keys are reported, never silently deduplicated."
        ]
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("batches", nargs="+", help="Normalized CDS batch JSON files")
    parser.add_argument("--output", default="artifacts/cds-archive-inventory.json")
    args = parser.parse_args()
    report = inventory(args.batches)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("status", "batchFileCount", "readableBatchCount",
        "totalRecordCount", "duplicateBatchIds", "duplicateRecordCount", "invalidItems")}, indent=2))

if __name__ == "__main__":
    main()
