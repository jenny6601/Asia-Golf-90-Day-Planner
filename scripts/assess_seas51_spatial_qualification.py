#!/usr/bin/env python3
"""Assess regional representativeness of SEAS5.1 points for long-range signals.

Course coordinates and nearest-grid distances are advisory metadata, not a
hard rejection criterion for D17-D90 regional climate guidance.
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

def assess(batch_path, extract_manifest_path, threshold_km=35.0):
    batch = json.loads(Path(batch_path).read_text(encoding="utf-8"))
    manifest = json.loads(Path(extract_manifest_path).read_text(encoding="utf-8"))
    records = batch.get("records")
    if not isinstance(records, list):
        raise ValueError("normalized batch records must be an array")
    grouped = defaultdict(list)
    for row in records:
        if isinstance(row, dict):
            grouped[row.get("courseId") or "UNKNOWN"].append(row)

    course_rows = []
    for course_id, rows in sorted(grouped.items()):
        distances = [r.get("nearestGridDistanceKm") for r in rows
                     if isinstance(r.get("nearestGridDistanceKm"), (int, float))]
        coordinate_status = next((c.get("coordinateStatus") for c in manifest.get("coursesUsed", [])
                                   if c.get("id") == course_id), "unknown")
        over = sum(d > threshold_km for d in distances)
        course_rows.append({
            "courseId": course_id,
            "coordinateStatus": coordinate_status,
            "recordCount": len(rows),
            "recordsWithDistance": len(distances),
            "withinAdvisoryDistanceCount": len(distances) - over,
            "overAdvisoryDistanceCount": over,
            "minimumDistanceKm": min(distances) if distances else None,
            "maximumDistanceKm": max(distances) if distances else None,
            "spatialStatus": (
                "coordinate-provisional-use-as-regional-proxy" if coordinate_status != "verified" else
                "distance-advisory-review" if over else
                "regional-proxy-usable"
            )
        })

    failures = manifest.get("spatialFailuresByCourse", {})
    skipped = manifest.get("coursesSkippedMissingCoordinates", [])
    total = len(records)
    distances = [r.get("nearestGridDistanceKm") for r in records
                 if isinstance(r, dict) and isinstance(r.get("nearestGridDistanceKm"), (int, float))]
    coverage_complete = bool(total) and not failures and not skipped
    status = ("insufficient-spatial-coverage" if not total else
              "regional-proxy-usable-with-coverage-gaps" if not coverage_complete else
              "regional-proxy-usable-with-advisory-review" if any(
                  x["coordinateStatus"] != "verified" or x["overAdvisoryDistanceCount"] for x in course_rows
              ) else "regional-proxy-usable")
    return {
        "status": status,
        "purpose": "regional long-range signal representation for D17-D90; not course-point weather verification",
        "batchId": batch.get("batchId"),
        "dataset": batch.get("dataset"),
        "model": batch.get("model"),
        "initializationTimes": batch.get("requestScope", {}).get("initializationTimes", []),
        "advisoryDistanceThresholdKm": threshold_km,
        "recordCount": total,
        "recordsWithDistance": len(distances),
        "withinAdvisoryDistanceCount": sum(d <= threshold_km for d in distances),
        "overAdvisoryDistanceCount": sum(d > threshold_km for d in distances),
        "courseCountWithRecords": len(course_rows),
        "courseCountWithVerifiedCoordinates": sum(x["coordinateStatus"] == "verified" for x in course_rows),
        "courseSpatialFailures": failures,
        "coursesSkippedMissingCoordinates": skipped,
        "coverageCompleteForRequestedCourses": coverage_complete,
        "courses": course_rows,
        "limitations": [
            "The advisory distance is descriptive only and does not reject a record for D17-D90 regional climate guidance.",
            "Nearby coordinates and grid cells may represent the same broad weather regime; they are not course-wide observations.",
            "Provisional coordinates remain labeled provisional and can be refined when convenient.",
            "Out-of-area or missing-coordinate courses remain coverage gaps; no values are fabricated for them.",
            "This report does not establish forecast skill, station-level accuracy, or justify bias correction.",
            "The approved CDS request area and retrieval scope are unchanged."
        ]
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", required=True)
    parser.add_argument("--extract-manifest", required=True)
    parser.add_argument("--threshold-km", type=float, default=35.0)
    parser.add_argument("--output", default="artifacts/seas51-spatial-qualification.json")
    args = parser.parse_args()
    report = assess(args.batch, args.extract_manifest, args.threshold_km)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("status", "recordCount", "withinAdvisoryDistanceCount",
        "overAdvisoryDistanceCount", "courseCountWithRecords", "courseCountWithVerifiedCoordinates",
        "courseSpatialFailures", "coursesSkippedMissingCoordinates")}, indent=2))

if __name__ == "__main__":
    main()
