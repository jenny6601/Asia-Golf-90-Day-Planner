#!/usr/bin/env python3
"""Retrieve the previously user-authorized, narrowly scoped SEAS5.1 pilot."""
from __future__ import annotations
import hashlib, json
from datetime import datetime, timezone
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
TARGET = Path("artifacts/seas51-2016-01-01-lead408-426-okinawa.grib")

def sha256(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

def main():
    TARGET.parent.mkdir(parents=True,exist_ok=True)
    cdsapi.Client().retrieve(DATASET,REQUEST,str(TARGET))
    if not TARGET.exists() or TARGET.stat().st_size == 0:
        raise RuntimeError("CDS returned no non-empty GRIB file")
    manifest={
        "dataset":DATASET,"request":REQUEST,"target":str(TARGET),
        "size_bytes":TARGET.stat().st_size,"sha256":sha256(TARGET),
        "retrieved_utc":datetime.now(timezone.utc).isoformat(),
        "scope_note":"Single initialization and four leads only; not a skill-validation dataset."
    }
    Path("artifacts/seas51-pilot-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps(manifest,indent=2))
if __name__=="__main__": main()
