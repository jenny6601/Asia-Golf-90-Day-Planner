#!/usr/bin/env python3
"""Compile the eight-country regional representative-point registry and acquisition plan.

This is a shared, country-neutral preflight layer. It does not download data.
Only subregions with an explicit candidate coordinate and IANA timezone become
eligible tasks; all others remain visible as blocked/pending rather than being
assigned fabricated coordinates.
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parents[1]
COUNTRY_PATH = ROOT / "config/global/countries.json"
SUBREGION_PATH = ROOT / "config/global/weather-subregions.json"
COURSE_PATH = ROOT / "config/global/courses.json"
ENGINE_PATH = ROOT / "config/global/eight-country-climate-engine.json"
EXPECTED_COUNTRIES = ("JP", "KR", "CN", "VN", "TH", "MY", "SG", "ID")
DATASET = "reanalysis-era5-land"
SOURCE_ID = "ERA5_LAND_HOURLY"


def nearest_tenth(value: float) -> float:
    """ERA5-Land regular 0.1-degree grid candidate; actual returned cell must be audited."""
    return round(round(value * 10) / 10, 1)


def _valid_coordinate(value, lower, upper):
    return isinstance(value, (int, float)) and math.isfinite(value) and lower <= value <= upper


def compile_registry(countries: list[dict], subregions: dict, courses: list[dict] | None = None) -> dict:
    country_by_code = {item.get("code"): item for item in countries}
    if len(country_by_code) != len(countries):
        raise ValueError("country registry contains duplicate country codes")
    missing_countries = set(EXPECTED_COUNTRIES) - set(country_by_code)
    if missing_countries:
        raise ValueError(f"country registry missing: {', '.join(sorted(missing_countries))}")

    groups = subregions.get("countries")
    if not isinstance(groups, list):
        raise ValueError("weather-subregions countries array is missing")
    group_by_code = {}
    for group in groups:
        code = group.get("countryCode")
        if code in group_by_code:
            raise ValueError(f"duplicate country subregion group: {code}")
        group_by_code[code] = group

    course_by_id = {item.get("id"): item for item in (courses or []) if item.get("id")}
    points, pending = [], []
    for code in EXPECTED_COUNTRIES:
        group = group_by_code.get(code)
        if group is None:
            pending.append({"countryCode": code, "subregionId": None, "reason": "country_subregion_group_missing"})
            continue
        for region in group.get("subregions", []):
            sid = region.get("id")
            coords = region.get("candidateCoordinates") or {}
            lat, lon = coords.get("latitude"), coords.get("longitude")
            tz = coords.get("timezone")
            coordinate_source = coords.get("coordinateSourceUrl")
            coordinate_status = coords.get("coordinateStatus", "unspecified")
            # Existing configured course coordinates are a valid fallback for configured
            # subregions (currently Okinawa); they are still treated as regional points.
            course = course_by_id.get(region.get("representativeCourseId") or region.get("candidateCourseId"))
            if (not _valid_coordinate(lat, -90, 90) or not _valid_coordinate(lon, -180, 180)) and course:
                if course.get("countryCode") == code:
                    lat, lon = course.get("latitude"), course.get("longitude")
                    tz = tz or course.get("timezone")
                    coordinate_source = course.get("coordinateSource")
                    coordinate_status = course.get("coordinateStatus", "course-catalog-coordinate")
            reasons = []
            if not isinstance(sid, str) or not sid.strip():
                reasons.append("subregion_id_missing")
            if not _valid_coordinate(lat, -90, 90):
                reasons.append("representative_latitude_missing_or_invalid")
            if not _valid_coordinate(lon, -180, 180):
                reasons.append("representative_longitude_missing_or_invalid")
            if not isinstance(tz, str) or not tz.strip():
                reasons.append("iana_timezone_missing")
            else:
                try:
                    ZoneInfo(tz)
                except ZoneInfoNotFoundError:
                    reasons.append("iana_timezone_invalid")
            if reasons:
                pending.append({
                    "countryCode": code,
                    "subregionId": sid,
                    "label": region.get("label") or region.get("subregion") or sid,
                    "reason": reasons,
                })
                continue
            points.append({
                "countryCode": code,
                "countryName": country_by_code[code].get("name"),
                "countryNameZh": country_by_code[code].get("nameZh"),
                "subregionId": sid,
                "label": region.get("label") or region.get("subregion") or sid,
                "representativeCourseId": region.get("representativeCourseId") or region.get("candidateCourseId"),
                "representativeCourseName": region.get("candidateCourseName"),
                "representativePoint": {"latitude": float(lat), "longitude": float(lon)},
                "timezone": tz,
                "coordinateStatus": coordinate_status,
                "coordinateSourceUrl": coordinate_source,
                "coordinateReviewStatus": region.get("coordinateReviewStatus"),
                "regionalClimateEligible": True,
                "gridMapping": {
                    "method": "nearest-0.1-degree-candidate-only",
                    "candidateLatitude": nearest_tenth(float(lat)),
                    "candidateLongitude": nearest_tenth(float(lon)),
                    "status": "estimated-awaiting-returned-grid-coordinate-audit",
                },
            })

    ids = [point["subregionId"] for point in points] + [
        item["subregionId"] for item in pending if item.get("subregionId")
    ]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate subregion IDs across the eight-country registry")

    counts = {}
    for code in EXPECTED_COUNTRIES:
        counts[code] = {
            "totalSubregions": sum(
                len(g.get("subregions", [])) for g in groups if g.get("countryCode") == code
            ),
            "readyForAcquisition": sum(p["countryCode"] == code for p in points),
            "pendingCoordinatesOrTimezone": sum(p["countryCode"] == code for p in pending),
        }
    return {
        "schemaVersion": 1,
        "sourceId": SOURCE_ID,
        "dataset": DATASET,
        "status": "registry-preflight-only-not-downloaded",
        "referencePeriod": {"startYear": 1991, "endYear": 2020},
        "pointPolicy": "one nearby regional-climate representative point per subregion; exact course pin not required; assess local climate setting rather than a universal radius",
        "gridPolicy": "rounded 0.1-degree values are planning estimates only; never accepted until actual downloaded coordinates are inspected",
        "countsByCountry": counts,
        "totalSubregions": sum(x["totalSubregions"] for x in counts.values()),
        "readyPointCount": len(points),
        "pendingPointCount": len(pending),
        "points": points,
        "pendingSubregions": pending,
        "activation": {
            "climateBaselineEnabled": False,
            "forecastEnabled": False,
            "decisionUseEligible": False,
        },
    }


def build_task_plan(registry: dict, start_year: int = 1991, end_year: int = 2020,
                    country_codes: list[str] | None = None) -> dict:
    if start_year > end_year:
        raise ValueError("start_year must be <= end_year")
    selected = set(country_codes or EXPECTED_COUNTRIES)
    unknown = selected - set(EXPECTED_COUNTRIES)
    if unknown:
        raise ValueError(f"unsupported country codes: {', '.join(sorted(unknown))}")
    tasks = []
    for point in registry.get("points", []):
        if point["countryCode"] not in selected:
            continue
        for year in range(start_year, end_year + 1):
            tasks.append({
                "taskId": f'{point["subregionId"]}-{year}',
                "countryCode": point["countryCode"],
                "subregionId": point["subregionId"],
                "year": year,
                "timezone": point["timezone"],
                "representativePoint": point["representativePoint"],
                "estimatedGridPoint": point["gridMapping"],
                "status": "planned-not-downloaded",
            })
    return {
        "schemaVersion": 1,
        "status": "preflight-plan-only",
        "dataset": DATASET,
        "sourceId": SOURCE_ID,
        "referencePeriod": {"startYear": start_year, "endYear": end_year},
        "selectedCountries": sorted(selected),
        "readySubregions": len({t["subregionId"] for t in tasks}),
        "pendingSubregionsExcluded": registry.get("pendingPointCount", 0),
        "annualTaskCount": len(tasks),
        "tasks": tasks,
        "safety": {
            "downloadPerformed": False,
            "climateBaselineEnabled": False,
            "forecastEnabled": False,
            "decisionUseEligible": False,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=1991)
    parser.add_argument("--end-year", type=int, default=2020)
    parser.add_argument("--countries", help="comma-separated country codes; default all eight")
    parser.add_argument("--registry-output", default="config/global/era5-land-eight-country-registry.json")
    parser.add_argument("--plan-output", default="data/era5-land-eight-country-1991-2020/acquisition-plan.json")
    parser.add_argument("--write", action="store_true", help="write registry and task plan; default prints preflight summary only")
    args = parser.parse_args()

    try:
        countries = json.loads(COUNTRY_PATH.read_text(encoding="utf-8"))
        subregions = json.loads(SUBREGION_PATH.read_text(encoding="utf-8"))
        courses = json.loads(COURSE_PATH.read_text(encoding="utf-8"))
        registry = compile_registry(countries, subregions, courses)
        selected = [x.strip().upper() for x in args.countries.split(",") if x.strip()] if args.countries else None
        plan = build_task_plan(registry, args.start_year, args.end_year, selected)
    except Exception as exc:
        parser.exit(2, f"Preflight failed: {exc}\n")

    summary = {
        "registryStatus": registry["status"],
        "countryCounts": registry["countsByCountry"],
        "totalSubregions": registry["totalSubregions"],
        "readyPointCount": registry["readyPointCount"],
        "pendingPointCount": registry["pendingPointCount"],
        "annualTaskCount": plan["annualTaskCount"],
        "firstTask": plan["tasks"][0] if plan["tasks"] else None,
        "downloadPerformed": False,
        "activation": registry["activation"],
    }
    if args.write:
        registry_path = ROOT / args.registry_output
        plan_path = ROOT / args.plan_output
        registry_path.parent.mkdir(parents=True, exist_ok=True)
        plan_path.parent.mkdir(parents=True, exist_ok=True)
        registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        summary["registryOutput"] = str(registry_path.relative_to(ROOT))
        summary["planOutput"] = str(plan_path.relative_to(ROOT))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
