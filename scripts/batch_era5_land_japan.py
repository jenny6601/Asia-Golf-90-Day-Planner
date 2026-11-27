#!/usr/bin/env python3
"""Resumable one-year-at-a-time ERA5-Land acquisition for Japan's 19 regions.

The runner defaults to a single task. It downloads, structurally inspects, and
converts one subregion/year at a time, recording progress atomically so an
interrupted run can resume without repeating validated work.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING = ROOT / "config/global/era5-land-grid-points-japan.json"
PILOT = ROOT / "scripts/era5_land_pilot.py"
INSPECTOR = ROOT / "scripts/inspect_era5_land_pilot.py"
AGGREGATOR = ROOT / "scripts/aggregate_era5_land_daily.py"


def build_tasks(mapping: dict, start_year: int = 1991, end_year: int = 2020,
                subregions: list[str] | None = None) -> list[dict]:
    if start_year > end_year:
        raise ValueError("start_year must be <= end_year")
    points = mapping.get("points", [])
    ids = [p.get("subregionId") for p in points]
    if len(ids) != len(set(ids)):
        raise ValueError("mapping contains duplicate subregion IDs")
    selected = set(subregions or ids)
    unknown = selected - set(ids)
    if unknown:
        raise ValueError(f"unknown subregion IDs: {', '.join(sorted(unknown))}")
    tasks = []
    for point in points:
        if point["subregionId"] not in selected:
            continue
        for year in range(start_year, end_year + 1):
            tasks.append({
                "taskId": f'{point["subregionId"]}-{year}',
                "subregionId": point["subregionId"],
                "year": year,
                "start": f"{year}-01-01",
                "end": f"{year}-12-31",
                "representativeCourseId": point["representativeCourseId"],
                "representativePoint": point["representativePoint"],
                "expectedGridPoint": point["era5LandGridPoint"],
                "timezone": point["timezone"],
                "status": "pending",
                "attempts": 0,
            })
    return tasks


def _atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def _run(command: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)


def run_task(task: dict, output_root: Path, retries: int = 3, retry_delay: int = 30,
             sleep=time.sleep, runner=_run, force: bool = False) -> dict:
    raw_dir = output_root / "raw"
    report_dir = output_root / "reports"
    daily_dir = output_root / "daily"
    raw_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    daily_dir.mkdir(parents=True, exist_ok=True)
    sid, year = task["subregionId"], task["year"]
    stem = f"{sid}_{year}-01-01_{year}-12-31"
    archive = raw_dir / f"{stem}.zip"
    report = report_dir / f"{sid}-{year}-inspection.json"
    daily = daily_dir / f"{sid}-{year}-daily.json"
    if not force and daily.exists() and daily.stat().st_size > 0:
        try:
            existing = json.loads(daily.read_text(encoding="utf-8"))
            expected_days = (date(year, 12, 31) - date(year, 1, 1)).days + 1
            rows = existing.get("records", [])
            valid_existing = (
                existing.get("status") == "pilot-daily-aggregation-complete"
                and existing.get("climatologyEligible") is False
                and existing.get("recordCount") == expected_days
                and len(rows) == expected_days
                and all(row.get("subregionId") == sid and row.get("localDayTimezone") == "Asia/Tokyo" for row in rows)
                and rows[0].get("validDate") == f"{year}-01-01"
                and rows[-1].get("validDate") == f"{year}-12-31"
            )
            if valid_existing:
                return {**task, "status": "daily-converted-existing", "archive": str(archive), "daily": str(daily), "attempts": 0}
        except (OSError, ValueError, TypeError, IndexError):
            pass

    last_error = None
    for attempt in range(1, retries + 1):
        task["attempts"] = attempt
        try:
            if not archive.exists() or archive.stat().st_size == 0:
                result = runner([
                    sys.executable, str(PILOT), "--subregion", sid,
                    "--start", task["start"], "--end", task["end"],
                    "--output-dir", str(raw_dir.relative_to(ROOT))
                ])
                if result.returncode != 0:
                    raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "CDS download failed")
            inspect = runner([
                sys.executable, str(INSPECTOR), str(archive),
                "--subregion", sid, "--start", task["start"], "--end", task["end"],
                "--report", str(report.relative_to(ROOT))
            ])
            if inspect.returncode != 0:
                raise RuntimeError(inspect.stderr.strip() or "ERA5-Land structural inspection failed")
            daily_result = runner([
                sys.executable, str(AGGREGATOR), str(archive),
                "--subregion", sid, "--start", task["start"], "--end", task["end"],
                "--output", str(daily.relative_to(ROOT))
            ])
            if daily_result.returncode != 0:
                raise RuntimeError(daily_result.stderr.strip() or "Daily JST aggregation failed")
            payload = json.loads(daily.read_text(encoding="utf-8"))
            if payload.get("recordCount") != 365 and not (
                payload.get("recordCount") == 366 and date(year, 12, 31).timetuple().tm_yday == 366
            ):
                raise RuntimeError(f"unexpected daily record count: {payload.get('recordCount')}")
            return {
                **task, "status": "daily-converted-structurally-validated",
                "archive": str(archive), "inspection": str(report), "daily": str(daily),
                "dailyRecordCount": payload["recordCount"], "attempts": attempt,
                "climatologyEligible": False
            }
        except Exception as exc:
            last_error = str(exc)
            if attempt < retries:
                sleep(retry_delay * attempt)
    return {**task, "status": "failed", "error": last_error, "attempts": retries,
            "archive": str(archive), "inspection": str(report), "daily": str(daily),
            "climatologyEligible": False}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=1991)
    parser.add_argument("--end-year", type=int, default=2020)
    parser.add_argument("--subregions", help="comma-separated subregion IDs; default all mapped Japan regions")
    parser.add_argument("--limit", type=int, default=1, help="maximum tasks to process in this run; default 1")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-delay", type=int, default=30)
    parser.add_argument("--output-root", default="data/era5-japan-1991-2020")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="reprocess selected tasks even when a prior daily file is marked complete")
    args = parser.parse_args()
    if args.limit < 1 or args.retries < 1 or args.retry_delay < 0:
        parser.error("--limit and --retries must be positive; --retry-delay cannot be negative")

    try:
        mapping = json.loads(MAPPING.read_text(encoding="utf-8"))
        selected = [x.strip() for x in args.subregions.split(",") if x.strip()] if args.subregions else None
        tasks = build_tasks(mapping, args.start_year, args.end_year, selected)
    except Exception as exc:
        parser.error(str(exc))

    root = ROOT / args.output_root
    state_path = root / "batch-state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {
        "schemaVersion": 1, "status": "in-progress", "sourceId": "ERA5_LAND_HOURLY_TIMESERIES",
        "dataset": "reanalysis-era5-land-timeseries", "referencePeriod": [args.start_year, args.end_year],
        "timezone": "Asia/Tokyo", "climateBaselineEnabled": False, "forecastEnabled": False, "tasks": {}
    }
    if args.dry_run:
        print(json.dumps({
            "status": "dry-run", "totalTasks": len(tasks), "selectedTasks": tasks[:args.limit],
            "limit": args.limit, "outputRoot": str(root)
        }, ensure_ascii=False, indent=2))
        return 0

    pending = tasks if args.force else [t for t in tasks if state["tasks"].get(t["taskId"], {}).get("status") not in {
        "daily-converted-structurally-validated", "daily-converted-existing"
    }]
    selected_tasks = pending[:args.limit]
    for task in selected_tasks:
        result = run_task(task, root, args.retries, args.retry_delay, force=args.force)
        state["tasks"][task["taskId"]] = result
        state["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        completed = sum(state["tasks"].get(t["taskId"], {}).get("status", "").startswith("daily-converted") for t in tasks)
        failed = sum(state["tasks"].get(t["taskId"], {}).get("status") == "failed" for t in tasks)
        state["status"] = "completed" if completed == len(tasks) else "in-progress"
        _atomic_json(state_path, state)
        print(json.dumps({
            "task": task["taskId"], "status": result["status"],
            "completedRecorded": completed, "failedRecorded": failed,
            "totalPlanned": len(tasks), "attempts": result.get("attempts"),
            "error": result.get("error")
        }, ensure_ascii=False))
    print(json.dumps({
        "status": state["status"], "totalPlanned": len(tasks),
        "completedRecorded": sum(state["tasks"].get(t["taskId"], {}).get("status", "").startswith("daily-converted") for t in tasks),
        "failedRecorded": sum(state["tasks"].get(t["taskId"], {}).get("status") == "failed" for t in tasks),
        "remaining": max(0, len(tasks) - sum(state["tasks"].get(t["taskId"], {}).get("status", "").startswith("daily-converted") for t in tasks)),
        "lastError": next((state["tasks"].get(t["taskId"], {}).get("error") for t in reversed(selected_tasks) if state["tasks"].get(t["taskId"], {}).get("status") == "failed"), None),
        "stateFile": str(state_path)
    }, ensure_ascii=False, indent=2))
    return 0 if all(state["tasks"].get(t["taskId"], {}).get("status") != "failed" for t in selected_tasks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
