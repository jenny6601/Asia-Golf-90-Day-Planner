#!/usr/bin/env python3
"""Small, user-authorized CDS System 51 hindcast pilot.

The request fields below are copied from the CDS-generated request supplied by
the user. Do not broaden dates, leads, variables, or area without review.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import cdsapi

DATASET = "seasonal-original-single-levels"
REQUEST = {
    "originating_centre": "ecmwf",
    "system": "51",
    "variable": [
        "10m_u_component_of_wind",
        "10m_v_component_of_wind",
        "2m_temperature",
        "total_precipitation",
    ],
    "year": ["2016"],
    "month": ["01"],
    "day": ["01"],
    "leadtime_hour": ["408", "414", "420", "426"],
    "data_format": "grib",
    "area": [27, 127, 25, 129],
}
TARGET = Path("seas51-2016-01-01-lead408-426-okinawa.grib")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    client = cdsapi.Client()
    # Use the target-file argument documented by CDS; request parameters above
    # remain identical to the CDS-generated snippet.
    client.retrieve(DATASET, REQUEST, str(TARGET))

    if not TARGET.exists() or TARGET.stat().st_size == 0:
        raise RuntimeError("CDS retrieval returned without a non-empty GRIB file")

    metadata = {
        "dataset": DATASET,
        "request": REQUEST,
        "target": TARGET.name,
        "size_bytes": TARGET.stat().st_size,
        "sha256": sha256_file(TARGET),
        "retrieved_utc": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "note": (
            "Retrieval/completeness pilot only. GRIB message metadata, "
            "precipitation accumulation semantics, and ensemble coverage "
            "must be audited before any forecast-skill claims."
        ),
    }
    Path("seas51-pilot-manifest.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Downloaded {TARGET.name}: {metadata['size_bytes']} bytes; "
        f"SHA-256 {metadata['sha256']}"
    )


if __name__ == "__main__":
    main()
