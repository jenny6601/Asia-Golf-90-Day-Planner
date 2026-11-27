#!/usr/bin/env python3
"""Audit Japan ERA5-Land daily files and produce region/year climate-readiness QA.

This is a completeness and plausibility gate, not independent observation
validation. ERA5-Land reanalysis remains distinct from JMA station observations.
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING = ROOT / "config/global/era5-land-grid-points-japan.json"
METRICS = {
    "precipitationMm": (0.0, 1000.0),
    "temperatureMinC": (-60.0, 55.0),
    "temperatureMeanC": (-60.0, 55.0),
    "temperatureMaxC": (-60.0, 55.0),
    "relativeHumidityMeanPct": (0.0, 100.0),
    "windSpeedMeanMs": (0.0, 100.0),
    "windSpeedMaxMs": (0.0, 120.0),
}
SOURCE_ID = "ERA5_LAND_HOURLY_TIMESERIES"


def valid_number(value, bounds):
    if isinstance(value, bool):
        return False
    try:
        number = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(number) and bounds[0] <= number <= bounds[1]


def quality_flags_acceptable(row) -> bool:
    """Allow only documented trace-negative precipitation noise after clamping."""
    flags = row.get("qualityFlags") or []
    return all(flag == "trace_negative_precipitation_clamped" for flag in flags)


def calendar_ordinal(day: date) -> float:
    if day.month == 2 and day.day == 29:
        return 59.5
    return float(date(2001, day.month, day.day).timetuple().tm_yday)


def calendar_distance(a: date, b: date) -> float:
    delta = abs(calendar_ordinal(a) - calendar_ordinal(b))
    return min(delta, 365.0 - delta)


def expected_days(year: int, target: date, half_window: int = 15) -> int:
    days = half_window * 2 + 1
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    if leap and calendar_distance(date(year, 2, 29), target) <= half_window:
        days += 1
    return days


def _load_files(paths, mapping_ids, start_year, end_year):
    records = defaultdict(dict)
    file_issues = []
    for path in paths:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            file_issues.append({"file": str(path), "issue": f"invalid_json: {exc}"})
            continue
        rows = payload.get("records") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            file_issues.append({"file": str(path), "issue": "records_array_missing"})
            continue
        if payload.get("status") != "pilot-daily-aggregation-complete":
            file_issues.append({"file": str(path), "issue": "daily_aggregation_status_not_complete"})
        if payload.get("climatologyEligible") is not False:
            file_issues.append({"file": str(path), "issue": "unexpected_climatology_activation_flag"})
        if payload.get("recordCount") != len(rows):
            file_issues.append({"file": str(path), "issue": "record_count_mismatch"})
        for row in rows:
            region = row.get("subregionId")
            try:
                day = date.fromisoformat(row.get("validDate", ""))
            except (TypeError, ValueError):
                file_issues.append({"file": str(path), "issue": "invalid_or_missing_validDate"})
                continue
            if region not in mapping_ids:
                file_issues.append({"file": str(path), "issue": f"unknown_subregion:{region}"})
                continue
            if not start_year <= day.year <= end_year:
                continue
            if row.get("sourceId") != SOURCE_ID or row.get("timezone") != "Asia/Tokyo" or row.get("localDayTimezone") != "Asia/Tokyo":
                file_issues.append({"file": str(path), "issue": f"source_or_timezone_mismatch:{region}:{day}"})
            key = day.isoformat()
            if key in records[region]:
                file_issues.append({"file": str(path), "issue": f"duplicate_daily_record:{region}:{key}"})
                continue
            records[region][key] = row
    return records, file_issues


def audit_region_year(region, year, rows):
    first, last = date(year, 1, 1), date(year, 12, 31)
    expected = (last - first).days + 1
    dates = {}
    for row in rows:
        try:
            d = date.fromisoformat(row["validDate"])
        except (KeyError, TypeError, ValueError):
            continue
        if d.year == year:
            dates[d.isoformat()] = row
    missing = []
    cursor = first
    while cursor <= last:
        if cursor.isoformat() not in dates:
            missing.append(cursor.isoformat())
        cursor += timedelta(days=1)

    metric_summary = {}
    for metric, bounds in METRICS.items():
        valid = [row for row in dates.values() if valid_number(row.get(metric), bounds)]
        metric_summary[metric] = {
            "validDays": len(valid),
            "coveragePct": round(100 * len(valid) / expected, 2),
            "missingOrInvalidDays": expected - len(valid),
            "min": round(min(float(r[metric]) for r in valid), 3) if valid else None,
            "max": round(max(float(r[metric]) for r in valid), 3) if valid else None,
        }

    complete_days = [
        row for row in dates.values()
        if row.get("validHourCount") == 24
        and not row.get("qualityFlags")
        and all(valid_number(row.get(metric), bounds) for metric, bounds in METRICS.items())
    ]
    month_summary = {}
    for month in range(1, 13):
        month_days = [date(year, month, d).isoformat() for d in range(1, (date(year + (month == 12), month % 12 + 1, 1) - timedelta(days=1)).day + 1)]
        month_summary[f"{month:02d}"] = {
            "expectedDays": len(month_days),
            "presentDays": sum(k in dates for k in month_days),
            "completeDays": sum(k in {r["validDate"] for r in complete_days} for k in month_days),
        }
    return {
        "year": year,
        "status": "annual-coverage-usable" if len(complete_days) / expected >= 0.90 else "annual-coverage-insufficient",
        "expectedDays": expected,
        "presentDays": len(dates),
        "missingDates": missing,
        "completeAllMetricDays": len(complete_days),
        "completeAllMetricCoveragePct": round(100 * len(complete_days) / expected, 2),
        "qualityFlagCounts": {
            flag: sum(flag in (row.get("qualityFlags") or []) for row in dates.values())
            for flag in sorted({flag for row in dates.values() for flag in (row.get("qualityFlags") or [])})
        },
        "metricCoverage": metric_summary,
        "monthlyCoverage": month_summary,
    }


def audit_climate_windows(region_rows, start_year=1991, end_year=2020,
                          minimum_valid_years=24, completeness=0.90):
    output = {}
    metric_years = {metric: {} for metric in METRICS}
    for month in range(1, 13):
        for day_num in range(1, 32):
            try:
                target = date(2001, month, day_num)
            except ValueError:
                continue
            by_year = defaultdict(list)
            for row in region_rows:
                d = date.fromisoformat(row["validDate"])
                if calendar_distance(d, target) <= 15:
                    season_year = d.year
                    if calendar_ordinal(target) <= 15 and calendar_ordinal(d) >= 350:
                        season_year += 1
                    elif calendar_ordinal(target) >= 350 and calendar_ordinal(d) <= 16:
                        season_year -= 1
                    by_year[season_year].append(row)
            counts = {}
            for metric, bounds in METRICS.items():
                valid_year_list = []
                for year in range(start_year, end_year + 1):
                    year_rows = by_year.get(year, [])
                    vals = [r for r in year_rows if r.get("validHourCount") == 24 and quality_flags_acceptable(r) and valid_number(r.get(metric), bounds)]
                    needed = math.ceil(expected_days(year, target) * completeness)
                    if len(vals) >= needed:
                        valid_year_list.append(year)
                counts[metric] = len(valid_year_list)
                metric_years[metric][target.strftime("%m-%d")] = {
                    "validYears": len(valid_year_list),
                    "status": "usable" if len(valid_year_list) >= minimum_valid_years else "insufficient-history",
                }
            output[target.strftime("%m-%d")] = counts
    summary = {}
    for metric, days in metric_years.items():
        usable = [key for key, value in days.items() if value["status"] == "usable"]
        summary[metric] = {
            "usableCalendarDays": len(usable),
            "totalCalendarDays": 365,
            "minimumValidYears": minimum_valid_years,
            "status": "all-calendar-days-usable" if len(usable) == 365 else "partial-calendar-coverage",
        }
    return {"dailyWindowValidYears": output, "metricReadiness": summary}


def audit_batch_state(state_path, mapping_ids, start_year, end_year):
    """Reconcile planned/downloaded annual tasks with the actual acquisition state."""
    expected = {
        f"{region}-{year}": {"regionId": region, "year": year}
        for region in sorted(mapping_ids)
        for year in range(start_year, end_year + 1)
    }
    if not state_path or not Path(state_path).exists():
        return {
            "status": "batch-state-not-provided",
            "expectedTasks": len(expected),
            "recordedTasks": 0,
            "completedTasks": 0,
            "failedTasks": 0,
            "pendingOrMissingTasks": len(expected),
            "missingTaskIds": list(expected),
            "unexpectedTaskIds": [],
            "byRegion": {
                region: {"expected": end_year - start_year + 1, "completed": 0, "failed": 0,
                         "pendingOrMissing": end_year - start_year + 1}
                for region in sorted(mapping_ids)
            },
        }
    try:
        payload = json.loads(Path(state_path).read_text(encoding="utf-8"))
    except Exception as exc:
        return {"status": "batch-state-invalid", "error": str(exc), "expectedTasks": len(expected)}
    tasks = payload.get("tasks") if isinstance(payload, dict) else None
    if not isinstance(tasks, dict):
        return {"status": "batch-state-invalid", "error": "tasks object missing", "expectedTasks": len(expected)}
    success_states = {"daily-converted-structurally-validated", "daily-converted-existing"}
    by_region = {
        region: {"expected": end_year - start_year + 1, "completed": 0, "failed": 0,
                 "pendingOrMissing": 0}
        for region in sorted(mapping_ids)
    }
    missing, unexpected = [], []
    completed = failed = recorded = 0
    for task_id, task in tasks.items():
        if task_id not in expected:
            unexpected.append(task_id)
    for task_id, identity in expected.items():
        task = tasks.get(task_id)
        region = identity["regionId"]
        if not isinstance(task, dict):
            missing.append(task_id)
            by_region[region]["pendingOrMissing"] += 1
            continue
        recorded += 1
        status = task.get("status")
        if status in success_states:
            completed += 1
            by_region[region]["completed"] += 1
        elif status == "failed":
            failed += 1
            by_region[region]["failed"] += 1
        else:
            by_region[region]["pendingOrMissing"] += 1
    pending = len(expected) - completed - failed
    return {
        "status": "batch-state-reconciled",
        "stateStatus": payload.get("status"),
        "expectedTasks": len(expected),
        "recordedTasks": recorded,
        "completedTasks": completed,
        "failedTasks": failed,
        "pendingOrMissingTasks": pending,
        "missingTaskIds": missing,
        "unexpectedTaskIds": sorted(unexpected),
        "byRegion": by_region,
        "activationEligible": False,
    }


def build_report(mapping, records, file_issues, start_year, end_year, batch_audit=None):
    regions = {}
    all_region_ids = [p["subregionId"] for p in mapping["points"]]
    for point in mapping["points"]:
        region = point["subregionId"]
        rows = list(records.get(region, {}).values())
        years = [audit_region_year(region, y, rows) for y in range(start_year, end_year + 1)]
        window_qa = audit_climate_windows(rows, start_year, end_year)
        complete_years = [y["year"] for y in years if y["status"] == "annual-coverage-usable"]
        regions[region] = {
            "subregion": point["subregion"],
            "representativeCourseId": point["representativeCourseId"],
            "representativePoint": point["representativePoint"],
            "expectedGridPoint": point["era5LandGridPoint"],
            "years": years,
            "annualCoverageUsableYears": len(complete_years),
            "annualCoverageUsableYearList": complete_years,
            "climateWindowReadiness": window_qa,
            "independentJmaValidation": {
                "status": "not-performed",
                "reason": "JMA station observations have not been ingested and matched; ERA5-Land reanalysis is not an independent rain-gauge observation."
            },
            "climatologyEligible": False,
        }
    return {
        "schemaVersion": 1,
        "status": "regional-data-quality-audit-complete-not-activated",
        "sourceId": SOURCE_ID,
        "referencePeriod": [start_year, end_year],
        "timezone": "Asia/Tokyo",
        "regionCount": len(regions),
        "expectedRegionIds": all_region_ids,
        "fileIssues": file_issues,
        "acquisitionAudit": batch_audit or {"status": "not-run"},
        "regions": regions,
        "activationPolicy": {
            "climateBaselineEnabled": False,
            "forecastEnabled": False,
            "decisionUseEligible": False,
            "note": "Completeness and plausibility checks do not replace independent JMA station validation."
        }
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("daily_files", nargs="*", type=Path, help="daily JSON files; default recursively scans data/era5-japan-1991-2020/daily")
    parser.add_argument("--start-year", type=int, default=1991)
    parser.add_argument("--end-year", type=int, default=2020)
    parser.add_argument("--output", type=Path, default=Path("data/processed/japan-era5-1991-2020-qa.json"))
    parser.add_argument("--batch-state", type=Path, default=Path("data/era5-japan-1991-2020/batch-state.json"))
    args = parser.parse_args()
    if args.start_year > args.end_year:
        parser.error("--start-year must be <= --end-year")
    paths = args.daily_files or sorted((ROOT / "data/era5-japan-1991-2020/daily").glob("*.json"))
    mapping = json.loads(MAPPING.read_text(encoding="utf-8"))
    records, issues = _load_files(paths, {p["subregionId"] for p in mapping["points"]}, args.start_year, args.end_year)
    batch_audit = audit_batch_state(args.batch_state, {p["subregionId"] for p in mapping["points"]}, args.start_year, args.end_year)
    report = build_report(mapping, records, issues, args.start_year, args.end_year, batch_audit)
    target = ROOT / args.output
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {
        "status": report["status"], "regions": report["regionCount"],
        "filesScanned": len(paths), "fileIssues": len(issues),
        "regionsWithData": sum(bool(records.get(p["subregionId"])) for p in mapping["points"]),
        "acquisition": {k: batch_audit.get(k) for k in ("status", "expectedTasks", "recordedTasks", "completedTasks", "failedTasks", "pendingOrMissingTasks")},
        "output": str(target), "climateBaselineEnabled": False,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
