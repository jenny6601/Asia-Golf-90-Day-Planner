#!/usr/bin/env python3
"""Assess whether a normalized SEAS5.1 batch is spatially fit for course verification."""
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
        if not isinstance(row, dict):
            continue
        grouped[row.get("courseId") or "UNKNOWN"].append(row)

    course_rows = []
    for course_id, rows in sorted(grouped.items()):
        distances = [r.get("nearestGridDistanceKm") for r in rows
                     if isinstance(r.get("nearestGridDistanceKm"), (int, float))]
        coordinate_status = next((c.get("coordinateStatus") for c in manifest.get("coursesUsed", [])
                                   if c.get("id") == course_id), "unknown")
        over = sum(d > threshold_km for d in distances)
        within = sum(d <= threshold_km for d in distances)
        course_rows.append({
            "courseId": course_id,
            "coordinateStatus": coordinate_status,
            "recordCount": len(rows),
            "recordsWithDistance": len(distances),
            "withinThresholdCount": within,
            "overThresholdCount": over,
            "minimumDistanceKm": min(distances) if distances else None,
            "maximumDistanceKm": max(distances) if distances else None,
            "spatialStatus": (
                "coordinate-provisional-review" if coordinate_status != "verified" else
                "no-grid-distance" if not distances else
                "distance-review-required" if over else "within-threshold"
            )
        })

    failures = manifest.get("spatialFailuresByCourse", {})
    skipped = manifest.get("coursesSkippedMissingCoordinates", [])
    total = len(records)
    distances = [r.get("nearestGridDistanceKm") for r in records
                 if isinstance(r, dict) and isinstance(r.get("nearestGridDistanceKm"), (int, float))]
    all_within = bool(distances) and len(distances) == total and all(d <= threshold_km for d in distances)
    all_coordinates_verified = bool(course_rows) and all(x["coordinateStatus"] == "verified" for x in course_rows)
    no_spatial_failures = not failures and not skipped
    qualified = all_within and all_coordinates_verified and no_spatial_failures
    return {
        "status": "spatially-qualified-for-next-verification-gate" if qualified else "spatially-not-qualified",
        "purpose": "course-level spatial representativeness gate; not forecast-skill validation",
        "batchId": batch.get("batchId"),
        "dataset": batch.get("dataset"),
        "model": batch.get("model"),
        "initializationTimes": batch.get("requestScope", {}).get("initializationTimes", []),
        "distanceReviewThresholdKm": threshold_km,
        "recordCount": total,
        "recordsWithDistance": len(distances),
        "withinThresholdCount": sum(d <= threshold_km for d in distances),
        "overThresholdCount": sum(d > threshold_km for d in distances),
        "courseCountWithRecords": len(course_rows),
        "courseCountWithVerifiedCoordinates": sum(x["coordinateStatus"] == "verified" for x in course_rows),
        "courseSpatialFailures": failures,
        "coursesSkippedMissingCoordinates": skipped,
        "courses": course_rows,
        "limitations": [
            "A nearest grid point is not a course-wide spatial average.",
            "Provisional course coordinates are not treated as verified.",
            "Records outside the distance threshold are retained but cannot pass this spatial qualification gate.",
            "This report does not alter the approved CDS request area or retrieval scope.",
            "Spatial qualification alone does not establish forecast skill or justify bias correction."
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
    print(json.dumps({k: report[k] for k in ("status", "recordCount", "withinThresholdCount",
        "overThresholdCount", "courseCountWithRecords", "courseCountWithVerifiedCoordinates",
        "courseSpatialFailures", "coursesSkippedMissingCoordinates")}, indent=2))

if __name__ == "__main__":
    main()
