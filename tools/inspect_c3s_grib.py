#!/usr/bin/env python3
"""Read-only inventory and QA for a C3S seasonal precipitation GRIB sample.

Requires: eccodes Python bindings (python -m pip install eccodes)
This tool does not modify the GRIB file and does not derive daily rainfall.
It inventories message metadata first; accumulation semantics must be reviewed
before any cumulative-to-daily differencing is performed.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from eccodes import (
    codes_grib_new_from_file,
    codes_get,
    codes_get_array,
    codes_release,
)


def get_optional(gid, key):
    try:
        return codes_get(gid, key)
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("grib", type=Path)
    parser.add_argument("--expected-leads", type=int, default=90)
    args = parser.parse_args()

    if not args.grib.is_file():
        raise SystemExit(f"GRIB file not found: {args.grib}")

    messages = []
    with args.grib.open("rb") as stream:
        index = 0
        while True:
            gid = codes_grib_new_from_file(stream)
            if gid is None:
                break
            index += 1
            try:
                lats = codes_get_array(gid, "latitudes")
                lons = codes_get_array(gid, "longitudes")
                lead = get_optional(gid, "endStep")
                start = get_optional(gid, "startStep")
                messages.append({
                    "message": index,
                    "shortName": get_optional(gid, "shortName"),
                    "paramId": get_optional(gid, "paramId"),
                    "name": get_optional(gid, "name"),
                    "units": get_optional(gid, "units"),
                    "dataDate": get_optional(gid, "dataDate"),
                    "dataTime": get_optional(gid, "dataTime"),
                    "stepType": get_optional(gid, "stepType"),
                    "stepRange": get_optional(gid, "stepRange"),
                    "startStep": start,
                    "endStep": lead,
                    "validityDate": get_optional(gid, "validityDate"),
                    "validityTime": get_optional(gid, "validityTime"),
                    "number": get_optional(gid, "number"),
                    "perturbationNumber": get_optional(gid, "perturbationNumber"),
                    "typeOfEnsembleForecast": get_optional(gid, "typeOfEnsembleForecast"),
                    "gridType": get_optional(gid, "gridType"),
                    "Ni": get_optional(gid, "Ni"),
                    "Nj": get_optional(gid, "Nj"),
                    "latitude_min": float(min(lats)) if len(lats) else None,
                    "latitude_max": float(max(lats)) if len(lats) else None,
                    "longitude_min": float(min(lons)) if len(lons) else None,
                    "longitude_max": float(max(lons)) if len(lons) else None,
                })
            finally:
                codes_release(gid)

    leads = sorted({
        int(m["endStep"]) for m in messages
        if isinstance(m["endStep"], (int, float)) and int(m["endStep"]) > 0
    })
    members = sorted({
        str(m["perturbationNumber"] if m["perturbationNumber"] is not None else m["number"])
        for m in messages
        if m["perturbationNumber"] is not None or m["number"] is not None
    })
    expected = list(range(24, args.expected_leads * 24 + 1, 24))
    missing = sorted(set(expected) - set(leads))
    unexpected = sorted(set(leads) - set(expected))
    duplicate_signatures = Counter(
        (m["shortName"], m["dataDate"], m["dataTime"], m["stepRange"],
         m["perturbationNumber"], m["number"], m["gridType"], m["Ni"], m["Nj"])
        for m in messages
    )
    duplicates = [list(k) for k, count in duplicate_signatures.items() if count > 1]

    output = {
        "file": args.grib.name,
        "file_size_bytes": args.grib.stat().st_size,
        "message_count": len(messages),
        "unique_end_steps_hours": leads,
        "expected_daily_lead_count": len(expected),
        "missing_end_steps_hours": missing,
        "unexpected_end_steps_hours": unexpected,
        "ensemble_member_identifiers": members,
        "ensemble_member_count_observed": len(members),
        "duplicate_message_signatures": duplicates,
        "message_metadata": messages,
        "limitations": [
            "No daily precipitation values are calculated.",
            "GRIB stepRange/startStep/endStep and statistical-processing metadata require expert review.",
            "Bounding-box coordinates are reported as message grid extrema; exact Okinawa inclusion must be checked from coordinates.",
            "Message count is not ensemble size; member identifiers may be absent or encoded differently.",
            "No forecast skill or calibrated rain probability is inferred."
        ],
        "preliminary_status": (
            "NO_MESSAGES" if not messages else
            "INCOMPLETE_LEAD_COVERAGE" if missing else
            "INVENTORY_COMPLETE_REQUIRES_SEMANTIC_REVIEW"
        ),
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
