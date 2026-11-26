#!/usr/bin/env python3
"""Machine-readable GRIB audit for the SEAS5.1 pilot; no skill claims."""
from __future__ import annotations
import json
from collections import defaultdict
from pathlib import Path
from eccodes import codes_get, codes_grib_new_from_file, codes_release

GRIB = Path("seas51-2016-01-01-lead408-426-okinawa.grib")
JSON_OUT = Path("seas51-grib-audit.json")
MD_OUT = Path("seas51-grib-audit.md")

KEYS = [
    "edition", "centre", "dataDate", "dataTime", "validityDate", "validityTime",
    "shortName", "name", "paramId", "units", "typeOfLevel", "level",
    "stepType", "stepRange", "startStep", "endStep", "forecastTime",
    "number", "perturbationNumber", "type", "gridType", "Ni", "Nj",
    "latitudeOfFirstGridPointInDegrees", "longitudeOfFirstGridPointInDegrees",
    "latitudeOfLastGridPointInDegrees", "longitudeOfLastGridPointInDegrees",
    "iDirectionIncrementInDegrees", "jDirectionIncrementInDegrees",
    "numberOfPoints",
]

def get(gid, key):
    try:
        return codes_get(gid, key)
    except Exception:
        return None

def main():
    if not GRIB.exists():
        raise SystemExit(f"Missing GRIB: {GRIB}")
    records = []
    with GRIB.open("rb") as stream:
        while True:
            gid = codes_grib_new_from_file(stream)
            if gid is None:
                break
            try:
                records.append({k: get(gid, k) for k in KEYS})
            finally:
                codes_release(gid)
    if not records:
        raise SystemExit("No GRIB messages decoded by ecCodes")

    groups = defaultdict(list)
    for rec in records:
        groups[(rec.get("paramId"), rec.get("shortName"), rec.get("forecastTime"))].append(rec)

    summary = []
    for (param_id, short_name, lead), items in sorted(
        groups.items(), key=lambda x: (str(x[0][0]), str(x[0][2]))
    ):
        first = items[0]
        members = sorted({r.get("number") for r in items if r.get("number") is not None})
        perturbations = sorted({r.get("perturbationNumber") for r in items if r.get("perturbationNumber") is not None})
        summary.append({
            "paramId": param_id, "shortName": short_name, "forecastTime": lead,
            "message_count": len(items), "ensemble_number_values": members,
            "perturbation_number_values": perturbations,
            "stepType_values": sorted({str(r.get("stepType")) for r in items}),
            "stepRange_values": sorted({str(r.get("stepRange")) for r in items}),
            "startStep_values": sorted({str(r.get("startStep")) for r in items}),
            "endStep_values": sorted({str(r.get("endStep")) for r in items}),
            "units": sorted({str(r.get("units")) for r in items}),
        })

    leads = sorted({r.get("forecastTime") for r in records if r.get("forecastTime") is not None})
    params = sorted({r.get("paramId") for r in records if r.get("paramId") is not None})
    first = records[0]
    result = {
        "file": GRIB.name, "message_count": len(records),
        "distinct_paramIds": params, "distinct_forecastTime_hours": leads,
        "groups": summary, "first_message_grid_metadata": {
            k: first.get(k) for k in [
                "edition", "centre", "gridType", "Ni", "Nj", "numberOfPoints",
                "latitudeOfFirstGridPointInDegrees", "longitudeOfFirstGridPointInDegrees",
                "latitudeOfLastGridPointInDegrees", "longitudeOfLastGridPointInDegrees",
                "iDirectionIncrementInDegrees", "jDirectionIncrementInDegrees",
            ]
        },
        "interpretation_guardrail": (
            "Message counts are not assumed to equal ensemble size. "
            "Precipitation accumulation is reported from stepType/startStep/endStep/stepRange; "
            "do not infer six-hour accumulation from six-hourly lead spacing. "
            "This audit checks file structure and metadata, not forecast skill."
        ),
    }
    JSON_OUT.write_text(json.dumps(result, indent=2, default=str) + "\n", encoding="utf-8")
    lines = [
        "# SEAS5.1 GRIB automatic audit", "",
        f"- File: `{GRIB.name}`",
        f"- Decoded GRIB messages: **{len(records)}**",
        f"- Parameter IDs: `{params}`",
        f"- Forecast leads (hours): `{leads}`", "",
        "| paramId | shortName | lead (h) | messages | ensemble number values | stepType | stepRange | startStep–endStep | units |",
        "|---:|---|---:|---:|---|---|---|---|---|",
    ]
    for row in summary:
        lines.append(
            f"| {row['paramId']} | {row['shortName']} | {row['forecastTime']} | "
            f"{row['message_count']} | {row['ensemble_number_values']} | "
            f"{row['stepType_values']} | {row['stepRange_values']} | "
            f"{row['startStep_values']}–{row['endStep_values']} | {row['units']} |"
        )
    lines += ["", "## Grid metadata", "", "```json",
              json.dumps(result["first_message_grid_metadata"], indent=2, default=str),
              "```", "", "## Interpretation limits", "",
              result["interpretation_guardrail"], ""]
    MD_OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"ecCodes decoded {len(records)} GRIB messages")
    print(f"Audit written: {JSON_OUT} and {MD_OUT}")

if __name__ == "__main__":
    main()
