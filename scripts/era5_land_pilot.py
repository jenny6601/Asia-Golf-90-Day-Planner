#!/usr/bin/env python3
"""Download one Japan subregion/year ERA5-Land hourly time-series pilot.

Credentials are read by cdsapi from the user's CDS configuration. Never commit API keys.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import date, timedelta
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MAPPING = ROOT / "config/global/era5-land-grid-points-japan.json"
DATASET = "reanalysis-era5-land-timeseries"
VARIABLES = [
    "2m_temperature",
    "2m_dewpoint_temperature",
    "total_precipitation",
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
]


def load_mapping(path: Path = MAPPING) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def build_request(point: dict, start: date, end: date) -> dict:
    if end < start:
        raise ValueError("end date must be on or after start date")
    # Extra UTC days preserve complete JST dates at both boundaries.
    utc_start = start - timedelta(days=1)
    utc_end = end + timedelta(days=1)
    return {
        "variable": VARIABLES,
        "location": {
            "latitude": point["representativePoint"]["latitude"],
            "longitude": point["representativePoint"]["longitude"],
        },
        "date": f"{utc_start.isoformat()}/{utc_end.isoformat()}",
        "data_format": "netcdf",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--subregion", default="JP-KNT-NORTH")
    parser.add_argument("--start", default="1991-01-01")
    parser.add_argument("--end", default="1991-12-31")
    parser.add_argument("--output-dir", default="data/raw/era5-land-pilot")
    parser.add_argument("--print-request", action="store_true", help="print request only; do not contact CDS")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    try:
        start = date.fromisoformat(args.start)
        end = date.fromisoformat(args.end)
        if (end - start).days > 366:
            raise ValueError("pilot is limited to 367 calendar days; use a separate approved batch workflow for the 30-year archive")
        mapping = load_mapping()
        point = next((p for p in mapping["points"] if p["subregionId"] == args.subregion), None)
        if point is None:
            raise ValueError(f"unknown subregion: {args.subregion}")
        request = build_request(point, start, end)
    except (ValueError, KeyError, OSError) as exc:
        parser.error(str(exc))

    manifest = {
        "dataset": DATASET,
        "subregionId": point["subregionId"],
        "representativeCourseId": point["representativeCourseId"],
        "requestedRepresentativePoint": point["representativePoint"],
        "expectedGridPoint": point["era5LandGridPoint"],
        "dateRangeJst": [start.isoformat(), end.isoformat()],
        "request": request,
        "warning": "Experimental single-point time-series endpoint. Verify returned coordinates, units, variables and timestamps before accepting the file."
    }
    if args.print_request:
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
        return 0

    if not os.environ.get("CDSAPI_KEY") and not Path.home().joinpath(".cdsapirc").exists():
        print("CDS credentials not found. Set CDSAPI_KEY or configure ~/.cdsapirc.", file=sys.stderr)
        return 2

    try:
        import cdsapi
    except ImportError:
        print("Missing dependency. Install with: pip install -r requirements-data.txt", file=sys.stderr)
        return 2

    output_dir = ROOT / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"{args.subregion}_{start.isoformat()}_{end.isoformat()}.zip"
    if target.exists() and not args.overwrite:
        print(f"Refusing to overwrite existing file: {target}", file=sys.stderr)
        return 2

    client = cdsapi.Client()
    client.retrieve(DATASET, request, str(target))
    if not target.exists() or target.stat().st_size == 0:
        print("CDS request returned without a non-empty target file.", file=sys.stderr)
        return 3
    print(json.dumps({"status": "downloaded-unvalidated", "file": str(target), "bytes": target.stat().st_size, "manifest": manifest}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
