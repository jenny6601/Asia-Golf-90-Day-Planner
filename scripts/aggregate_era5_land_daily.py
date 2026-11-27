#!/usr/bin/env python3
"""Convert a structurally validated ERA5-Land time-series ZIP into JST daily records.

This is a pilot converter, not a 30-year climatology builder. It refuses archives
that do not pass the structural inspector and never treats missing rain as zero.
"""
from __future__ import annotations

import argparse
import json
import math
import tempfile
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING = ROOT / "config/global/era5-land-grid-points-japan.json"
INSPECTOR = ROOT / "scripts/inspect_era5_land_pilot.py"
DATASET = "reanalysis-era5-land-timeseries"
SOURCE_ID = "ERA5_LAND_HOURLY_TIMESERIES"
JST = timezone(timedelta(hours=9))
VARS = {
    "temperatureK": "2m_temperature",
    "dewpointK": "2m_dewpoint_temperature",
    "precipitationM": "total_precipitation",
    "u10Ms": "10m_u_component_of_wind",
    "v10Ms": "10m_v_component_of_wind",
}
SOURCE_ALIASES = {
    "2m_temperature": ("2m_temperature", "t2m"),
    "2m_dewpoint_temperature": ("2m_dewpoint_temperature", "d2m"),
    "total_precipitation": ("total_precipitation", "tp"),
    "10m_u_component_of_wind": ("10m_u_component_of_wind", "u10"),
    "10m_v_component_of_wind": ("10m_v_component_of_wind", "v10"),
}


def resolve_source_variable(available_names, canonical_name: str) -> str | None:
    """Resolve CDS long names or the short GRIB names used in returned NetCDF files."""
    return next((name for name in SOURCE_ALIASES[canonical_name] if name in available_names), None)


def celsius(kelvin: float) -> float:
    return kelvin - 273.15


def relative_humidity_pct(temp_c: float, dewpoint_c: float) -> float:
    """Magnus approximation; result constrained to physical 0-100 percent."""
    a, b = 17.625, 243.04
    numerator = math.exp((a * dewpoint_c) / (b + dewpoint_c))
    denominator = math.exp((a * temp_c) / (b + temp_c))
    return max(0.0, min(100.0, 100.0 * numerator / denominator))


def wind_speed_ms(u: float, v: float) -> float:
    return math.hypot(u, v)


def wind_from_direction_deg(u: float, v: float) -> float | None:
    if math.hypot(u, v) < 1e-9:
        return None
    return (270.0 - math.degrees(math.atan2(v, u))) % 360.0


def _mean_direction(u_values: list[float], v_values: list[float]) -> float | None:
    u_mean = sum(u_values) / len(u_values)
    v_mean = sum(v_values) / len(v_values)
    return wind_from_direction_deg(u_mean, v_mean)


def aggregate_daily(hourly_records: list[dict], metadata: dict) -> list[dict]:
    """Aggregate raw UTC hourly rows to local days; require 24 valid values/field."""
    grouped = defaultdict(list)
    for row in hourly_records:
        stamp = row["time"]
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        local = stamp.astimezone(JST)
        grouped[local.date().isoformat()].append(row)

    output = []
    for day in sorted(grouped):
        rows = sorted(grouped[day], key=lambda r: r["time"])
        fields = {}
        for field in VARS:
            fields[field] = [r.get(field) for r in rows if r.get(field) is not None and math.isfinite(float(r[field]))]
        complete = len(rows) == 24 and all(len(fields[k]) == 24 for k in VARS)
        flags = []
        if len(rows) != 24:
            flags.append("hour_count_not_24")
        for field in VARS:
            if len(fields[field]) != 24:
                flags.append(f"missing_or_invalid_{field}")
        if complete:
            temps = [celsius(float(v)) for v in fields["temperatureK"]]
            dewpoints = [celsius(float(v)) for v in fields["dewpointK"]]
            precip = [float(v) * 1000.0 for v in fields["precipitationM"]]
            us = [float(v) for v in fields["u10Ms"]]
            vs = [float(v) for v in fields["v10Ms"]]
            if any(v < -0.000001 for v in precip):
                complete = False
                flags.append("negative_hourly_precipitation")
        if complete:
            precip_total = sum(max(0.0, v) for v in precip)
            speeds = [wind_speed_ms(u, v) for u, v in zip(us, vs)]
            humidity = [relative_humidity_pct(t, d) for t, d in zip(temps, dewpoints)]
            metrics = {
                "precipitationMm": round(precip_total, 3),
                "wetDay": precip_total >= 1.0,
                "temperatureMinC": round(min(temps), 2),
                "temperatureMeanC": round(sum(temps) / 24, 2),
                "temperatureMaxC": round(max(temps), 2),
                "relativeHumidityMeanPct": round(sum(humidity) / 24, 1),
                "windSpeedMeanMs": round(sum(speeds) / 24, 2),
                "windSpeedMaxMs": round(max(speeds), 2),
                "windDirectionMeanDeg": round(_mean_direction(us, vs), 1) if _mean_direction(us, vs) is not None else None,
            }
        else:
            metrics = {
                "precipitationMm": None, "wetDay": None,
                "temperatureMinC": None, "temperatureMeanC": None, "temperatureMaxC": None,
                "relativeHumidityMeanPct": None, "windSpeedMeanMs": None,
                "windSpeedMaxMs": None, "windDirectionMeanDeg": None,
            }
        output.append({
            **metadata,
            "validDate": day,
            "baselineYear": int(day[:4]),
            **metrics,
            "validHourCount": min([len(rows)] + [len(fields[k]) for k in VARS]),
            "qualityFlags": flags,
            "localDayTimezone": "Asia/Tokyo",
            "precipitationUnitConversion": "hourly de-accumulated metres x 1000 to mm; sum JST day; no second de-accumulation",
            "aggregationMethod": "JST calendar day 00:00-23:00; 24 valid hourly values required for all five source variables",
        })
    return output


def _extract_hourly_records(archive: Path) -> list[dict]:
    import numpy as np
    import xarray as xr

    collected = {}
    with tempfile.TemporaryDirectory(prefix="era5-land-daily-") as temp:
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(temp)
        for path in sorted(Path(temp).rglob("*.nc")):
            with xr.open_dataset(path) as ds:
                time_name = next((n for n in ("time", "valid_time") if n in ds.coords), None)
                if time_name is None:
                    raise ValueError(f"No time/valid_time coordinate in {path.name}")
                times = np.asarray(ds[time_name].values).reshape(-1)
                for output_name, canonical_name in VARS.items():
                    variable = resolve_source_variable(ds.data_vars, canonical_name)
                    if variable is None:
                        continue
                    units = str(ds[variable].attrs.get("units", "")).strip().lower()
                    allowed = {
                        "temperatureK": {"k", "kelvin"},
                        "dewpointK": {"k", "kelvin"},
                        "precipitationM": {"m", "metre", "meter", "metres", "meters"},
                        "u10Ms": {"m s**-1", "m s-1", "m/s"},
                        "v10Ms": {"m s**-1", "m s-1", "m/s"},
                    }[output_name]
                    if units not in allowed:
                        raise ValueError(f"Unexpected units for {variable}: {units!r}")
                    values = np.asarray(ds[variable].values, dtype="float64").squeeze().reshape(-1)
                    if len(values) != len(times):
                        raise ValueError(f"Unexpected dimensions for {variable} in {path.name}")
                    for stamp, value in zip(times, values):
                        dt = np.datetime64(stamp, "s").astype("datetime64[s]").item()
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        key = dt.astimezone(timezone.utc)
                        record = collected.setdefault(key, {"time": key})
                        if output_name in record:
                            raise ValueError(f"Duplicate {output_name} timestamp: {key.isoformat()}")
                        record[output_name] = None if not math.isfinite(float(value)) else float(value)
    return [collected[k] for k in sorted(collected)]


def convert_archive(archive: Path, subregion: str, start: date, end: date, mapping_path: Path = MAPPING) -> dict:
    import importlib.util
    spec = importlib.util.spec_from_file_location("era5_land_inspector", INSPECTOR)
    inspector = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inspector)
    inspection = inspector.inspect_archive(archive, subregion, start, end, mapping_path)
    if inspection["status"] != "passed-structural-validation":
        raise ValueError("Archive failed structural validation; daily conversion blocked")

    with mapping_path.open(encoding="utf-8") as handle:
        mapping = json.load(handle)
    point = next(p for p in mapping["points"] if p["subregionId"] == subregion)
    hourly = _extract_hourly_records(archive)
    metadata = {
        "countryCode": "JP",
        "subregionId": subregion,
        "representativeCourseId": point["representativeCourseId"],
        "latitude": point["representativePoint"]["latitude"],
        "longitude": point["representativePoint"]["longitude"],
        "timezone": "Asia/Tokyo",
        "sourceId": SOURCE_ID,
        "dataset": DATASET,
        "sourceVersion": "CDS experimental time-series; version not exposed in pilot metadata",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "gridLatitude": point["era5LandGridPoint"]["latitude"],
        "gridLongitude": point["era5LandGridPoint"]["longitude"],
        "gridDistanceKm": point.get("gridDistanceKm"),
    }
    records = aggregate_daily(hourly, metadata)
    selected = [r for r in records if start.isoformat() <= r["validDate"] <= end.isoformat()]
    expected_days = (end - start).days + 1
    if len(selected) != expected_days:
        raise ValueError(f"Expected {expected_days} JST dates but produced {len(selected)}")
    return {
        "schemaVersion": 1,
        "status": "pilot-daily-aggregation-complete",
        "climatologyEligible": False,
        "inspection": inspection,
        "recordCount": len(selected),
        "records": selected,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--subregion", required=True)
    parser.add_argument("--start", default="1991-01-01")
    parser.add_argument("--end", default="1991-12-31")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = convert_archive(args.archive, args.subregion, date.fromisoformat(args.start), date.fromisoformat(args.end))
    except Exception as exc:
        parser.exit(2, f"Daily conversion blocked: {exc}\n")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "recordCount": result["recordCount"], "output": str(args.output), "climatologyEligible": False}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
