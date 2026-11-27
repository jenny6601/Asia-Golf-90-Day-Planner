#!/usr/bin/env python3
"""Inspect and validate a downloaded ERA5-Land time-series ZIP archive.

This validates file structure and coverage only. It does not calculate climatology.
"""
from __future__ import annotations

import argparse
import json
import math
import tempfile
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING = ROOT / "config/global/era5-land-grid-points-japan.json"
REQUIRED_VARIABLES = {
    "2m_temperature",
    "2m_dewpoint_temperature",
    "total_precipitation",
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
}
JST = timezone(timedelta(hours=9))


def expected_utc_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    """Inclusive hourly timestamps spanning complete JST calendar dates."""
    return (
        datetime.combine(start, datetime.min.time(), tzinfo=JST).astimezone(timezone.utc).replace(tzinfo=None),
        datetime.combine(end, datetime.max.time().replace(minute=0, second=0, microsecond=0), tzinfo=JST).astimezone(timezone.utc).replace(tzinfo=None),
    )


def coordinate_matches(actual: float, expected: float, tolerance: float = 0.001) -> bool:
    return math.isfinite(actual) and abs(actual - expected) <= tolerance


def _scalar_coordinate(ds, name: str) -> float | None:
    if name not in ds.coords:
        return None
    values = ds.coords[name].values
    try:
        import numpy as np
        arr = np.asarray(values).reshape(-1)
        if arr.size != 1:
            return None
        return float(arr[0])
    except (TypeError, ValueError):
        return None


def _time_values(ds):
    import numpy as np
    for name in ("time", "valid_time"):
        if name in ds.coords:
            values = np.asarray(ds.coords[name].values).reshape(-1)
            if values.size:
                return [np.datetime64(v, "s").astype("datetime64[s]").item() for v in values]
    return []


def inspect_archive(archive: Path, subregion: str, start: date, end: date, mapping_path: Path = MAPPING) -> dict:
    import numpy as np
    import xarray as xr

    with mapping_path.open(encoding="utf-8") as handle:
        mapping = json.load(handle)
    point = next((p for p in mapping["points"] if p["subregionId"] == subregion), None)
    if point is None:
        raise ValueError(f"Unknown subregion: {subregion}")
    if end < start:
        raise ValueError("end date must be on or after start date")
    expected = point["era5LandGridPoint"]
    lower, upper = expected_utc_bounds(start, end)

    expected_times = []
    cursor = lower
    while cursor <= upper:
        expected_times.append(cursor)
        cursor += timedelta(hours=1)
    variable_times = {name: [] for name in REQUIRED_VARIABLES}
    variable_duplicates = {name: False for name in REQUIRED_VARIABLES}

    report = {
        "archive": str(archive),
        "subregionId": subregion,
        "requestedJstDates": [start.isoformat(), end.isoformat()],
        "expectedGridPoint": expected,
        "expectedUtcCoverage": [lower.isoformat() + "Z", upper.isoformat() + "Z"],
        "files": [],
        "variables": {},
        "checks": {},
        "status": "failed",
        "climatologyEligible": False,
    }

    with tempfile.TemporaryDirectory(prefix="era5-land-inspect-") as temp:
        with zipfile.ZipFile(archive) as zf:
            bad_member = zf.testzip()
            if bad_member:
                raise ValueError(f"Corrupt ZIP member: {bad_member}")
            zf.extractall(temp)
        netcdf_files = sorted(Path(temp).rglob("*.nc"))
        if not netcdf_files:
            raise ValueError("ZIP archive contains no .nc files")

        all_times = set()
        coordinate_results = []
        for path in netcdf_files:
            with xr.open_dataset(path) as ds:
                lat = _scalar_coordinate(ds, "latitude")
                lon = _scalar_coordinate(ds, "longitude")
                coordinate_results.append({
                    "file": path.name,
                    "latitude": lat,
                    "longitude": lon,
                    "matchesExpected": (
                        lat is not None and lon is not None
                        and coordinate_matches(lat, expected["latitude"])
                        and coordinate_matches(lon, expected["longitude"])
                    ),
                })
                times = _time_values(ds)
                all_times.update(times)
                file_info = {"name": path.name, "variables": [], "timeCount": len(times), "duplicateTimestamps": len(times) != len(set(times))}
                for name in REQUIRED_VARIABLES.intersection(ds.data_vars):
                    da = ds[name]
                    values = np.asarray(da.values, dtype="float64")
                    finite = values[np.isfinite(values)]
                    attrs = dict(da.attrs)
                    units = attrs.get("units") or attrs.get("unit")
                    file_info["variables"].append(name)
                    variable_times[name].extend(times)
                    variable_duplicates[name] = variable_duplicates[name] or (len(times) != len(set(times)))
                    report["variables"][name] = {
                        "file": path.name,
                        "units": units,
                        "missingFraction": float(np.isnan(values).mean()) if values.size else 1.0,
                        "validValueCount": int(finite.size),
                        "min": float(finite.min()) if finite.size else None,
                        "max": float(finite.max()) if finite.size else None,
                    }
                report["files"].append(file_info)

    ordered = sorted(all_times)
    duplicates = False  # set-based collection also detects duplicates below via per-file counts
    duplicates = any(item["duplicateTimestamps"] for item in report["files"])
    observed_in_window = [t for t in ordered if lower <= t <= upper]
    missing = sorted(set(expected_times) - set(observed_in_window))
    unexpected = [t for t in observed_in_window if t not in set(expected_times)]

    report["coordinates"] = coordinate_results
    report["timeCoverage"] = {
        "uniqueTimestampCount": len(all_times),
        "requestedWindowExpectedHours": len(expected_times),
        "observedHoursInWindow": len(observed_in_window),
        "missingHours": [t.isoformat() + "Z" for t in missing[:100]],
        "unexpectedHours": [t.isoformat() + "Z" for t in unexpected[:100]],
        "duplicateTimestampDetected": duplicates,
        "firstObservedUtc": ordered[0].isoformat() + "Z" if ordered else None,
        "lastObservedUtc": ordered[-1].isoformat() + "Z" if ordered else None,
    }

    coordinate_ok = bool(coordinate_results) and all(x["matchesExpected"] for x in coordinate_results)
    variables_ok = REQUIRED_VARIABLES.issubset(report["variables"])
    variable_coverage = {}
    for name in sorted(REQUIRED_VARIABLES):
        observed = set(t for t in variable_times[name] if lower <= t <= upper)
        absent = sorted(set(expected_times) - observed)
        variable_coverage[name] = {
            "observedHours": len(observed),
            "missingHours": len(absent),
            "duplicateTimestamps": variable_duplicates[name],
            "complete": name in report["variables"] and not absent and not variable_duplicates[name],
        }
    time_ok = bool(expected_times) and not missing and not unexpected and not duplicates and all(x["complete"] for x in variable_coverage.values())
    precipitation_units = report["variables"].get("total_precipitation", {}).get("units")
    precipitation_units_ok = str(precipitation_units).strip().lower() in {"m", "metre", "meter", "metres", "meters"}
    report["variableTimeCoverage"] = variable_coverage
    report["checks"] = {
        "netcdfFilesPresent": bool(netcdf_files),
        "allFilesAtExpectedGridPoint": coordinate_ok,
        "allRequiredVariablesPresent": variables_ok,
        "completeHourlyJstDateCoverage": time_ok,
        "noDuplicateTimestamps": not duplicates,
        "precipitationUnitsAreMetres": precipitation_units_ok,
        "precipitationDeaccumulation": "CDS time-series product documents total_precipitation as de-accumulated; do not de-accumulate again",
    }
    report["status"] = "passed-structural-validation" if all([
        coordinate_ok, variables_ok, time_ok, precipitation_units_ok
    ]) else "failed"
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--subregion", required=True)
    parser.add_argument("--start", default="1991-01-01")
    parser.add_argument("--end", default="1991-12-31")
    parser.add_argument("--report", type=Path, help="optional JSON report output path")
    args = parser.parse_args()
    try:
        report = inspect_archive(args.archive, args.subregion, date.fromisoformat(args.start), date.fromisoformat(args.end))
    except Exception as exc:
        parser.exit(2, f"Inspection failed: {exc}\n")
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0 if report["status"] == "passed-structural-validation" else 1


if __name__ == "__main__":
    raise SystemExit(main())
