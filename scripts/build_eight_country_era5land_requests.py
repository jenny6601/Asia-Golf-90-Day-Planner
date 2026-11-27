#!/usr/bin/env python3
"""Build production ERA5-Land full-dataset request manifests for all eight countries.

This is a request planner only. It never contacts CDS or downloads data.
Each subregion receives one 1991-2020 core request and two one-day UTC
boundary requests so every local-calendar day can be aggregated in its IANA
timezone without requesting whole adjacent years.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_BUILDER = ROOT / "scripts/build_eight_country_climate_registry.py"
COUNTRY_PATH = ROOT / "config/global/countries.json"
SUBREGION_PATH = ROOT / "config/global/weather-subregions.json"
COURSE_PATH = ROOT / "config/global/courses.json"
DATASET = "reanalysis-era5-land"
SOURCE_ID = "ERA5_LAND_HOURLY"
VARIABLES = [
    "2m_temperature",
    "2m_dewpoint_temperature",
    "total_precipitation",
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
]
MONTHS = [f"{m:02d}" for m in range(1, 13)]
DAYS = [f"{d:02d}" for d in range(1, 32)]
HOURS = [f"{h:02d}:00" for h in range(24)]


def _load_registry_builder():
    spec = importlib.util.spec_from_file_location("eight_country_registry_builder", REGISTRY_BUILDER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_request(point: dict, years: list[int], months: list[str], days: list[str],
                  area_padding_degrees: float = 0.06) -> dict:
    if not years or not months or not days:
        raise ValueError("years, months and days must not be empty")
    if not 0 < area_padding_degrees < 0.1:
        raise ValueError("area padding must be > 0 and < 0.1 degrees")
    grid = point["gridMapping"]
    lat = float(grid["candidateLatitude"])
    lon = float(grid["candidateLongitude"])
    area = [
        round(min(90.0, lat + area_padding_degrees), 4),
        round(lon - area_padding_degrees, 4),
        round(max(-90.0, lat - area_padding_degrees), 4),
        round(lon + area_padding_degrees, 4),
    ]
    return {
        "variable": VARIABLES,
        "year": [str(y) for y in years],
        "month": months,
        "day": days,
        "time": HOURS,
        "area": area,
        "data_format": "grib",
        "download_format": "zip",
    }


def build_manifest(registry: dict, start_year: int = 1991, end_year: int = 2020) -> dict:
    if start_year > end_year:
        raise ValueError("start_year must be <= end_year")
    years = list(range(start_year, end_year + 1))
    requests = []
    for point in registry.get("points", []):
        sid = point["subregionId"]
        timezone = point["timezone"]
        core = build_request(point, years, MONTHS, DAYS)
        pre_year = start_year - 1
        post_year = end_year + 1
        pre = build_request(point, [pre_year], ["12"], ["31"])
        post = build_request(point, [post_year], ["01"], ["01"])
        for segment, payload, date_range in (
            ("core-reference-period", core, [f"{start_year}-01-01", f"{end_year}-12-31"]),
            ("utc-boundary-before", pre, [f"{pre_year}-12-31", f"{pre_year}-12-31"]),
            ("utc-boundary-after", post, [f"{post_year}-01-01", f"{post_year}-01-01"]),
        ):
            requests.append({
                "requestId": f"{sid}-{segment}",
                "countryCode": point["countryCode"],
                "subregionId": sid,
                "segment": segment,
                "requestedLocalDateRange": date_range,
                "timezone": timezone,
                "representativePoint": point["representativePoint"],
                "expectedGridPoint": {
                    "latitude": point["gridMapping"]["candidateLatitude"],
                    "longitude": point["gridMapping"]["candidateLongitude"],
                },
                "gridMappingStatus": "candidate-only; actual returned GRIB coordinates must be audited",
                "dataset": DATASET,
                "sourceId": SOURCE_ID,
                "request": payload,
                "status": "prepared-not-submitted",
            })
    if len({x["requestId"] for x in requests}) != len(requests):
        raise ValueError("duplicate request IDs generated")
    return {
        "schemaVersion": 1,
        "status": "production-request-manifest-prepared-not-downloaded",
        "sourceId": SOURCE_ID,
        "dataset": DATASET,
        "provider": "Copernicus Climate Data Store / ECMWF",
        "referencePeriod": {"startYear": start_year, "endYear": end_year},
        "pointCount": len(registry.get("points", [])),
        "pendingSubregionCount": registry.get("pendingPointCount"),
        "requestCount": len(requests),
        "requestsPerSubregion": 3,
        "variables": VARIABLES,
        "spatialPolicy": "request a tight area around the nearest 0.1-degree candidate grid point; inspect actual returned GRIB coordinates and select the nearest valid land grid point before accepting data",
        "precipitationPolicy": "full ERA5-Land product accumulation semantics must be interpreted according to its product guide; do not apply the experimental time-series de-accumulation rule",
        "boundaryPolicy": "request previous UTC Dec 31 and following UTC Jan 1 separately, in addition to the core reference period, so local-year boundary days can be completed for UTC+7/+8/+9 regions",
        "activation": {
            "downloadPerformed": False,
            "climateBaselineEnabled": False,
            "forecastEnabled": False,
            "decisionUseEligible": False,
        },
        "requests": requests,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=1991)
    parser.add_argument("--end-year", type=int, default=2020)
    parser.add_argument("--output", default="data/era5-land-eight-country-1991-2020/production-request-manifest.json")
    parser.add_argument("--write", action="store_true", help="write the manifest; no CDS requests are submitted")
    args = parser.parse_args()
    try:
        countries = json.loads(COUNTRY_PATH.read_text(encoding="utf-8"))
        subregions = json.loads(SUBREGION_PATH.read_text(encoding="utf-8"))
        courses = json.loads(COURSE_PATH.read_text(encoding="utf-8"))
        builder = _load_registry_builder()
        registry = builder.compile_registry(countries, subregions, courses)
        manifest = build_manifest(registry, args.start_year, args.end_year)
    except Exception as exc:
        parser.exit(2, f"Request preflight failed: {exc}\\n")
    summary = {
        "status": manifest["status"],
        "pointCount": manifest["pointCount"],
        "pendingSubregionCount": manifest["pendingSubregionCount"],
        "requestCount": manifest["requestCount"],
        "requestsPerSubregion": manifest["requestsPerSubregion"],
        "dataset": manifest["dataset"],
        "referencePeriod": manifest["referencePeriod"],
        "downloadPerformed": False,
        "activation": manifest["activation"],
    }
    if args.write:
        path = ROOT / args.output
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
        summary["output"] = str(path.relative_to(ROOT))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
