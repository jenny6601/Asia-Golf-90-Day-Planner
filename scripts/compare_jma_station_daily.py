#!/usr/bin/env python3
"""Compare regional ERA5-Land daily reanalysis against matched JMA station observations.

Input JSON contract:
{"sourceId":"JMA_DAILY_OBSERVATION","stations":[{"stationId":"...","name":"...","latitude":0,"longitude":0,"regionId":"JP-...","records":[{"validDate":"YYYY-MM-DD","precipitationMm":0,"temperatureMinC":0,"temperatureMaxC":0}]}]}
Only station-day pairs are compared. This does not turn ERA5-Land into an
observation and does not activate climatology or forecast features.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING = ROOT / "config/global/era5-land-grid-points-japan.json"
ERA5_SOURCE = "ERA5_LAND_HOURLY_TIMESERIES"
JMA_SOURCE = "JMA_DAILY_OBSERVATION"


def haversine_km(a, b):
    from math import asin, cos, radians, sin, sqrt
    lat1, lon1 = radians(a["latitude"]), radians(a["longitude"])
    lat2, lon2 = radians(b["latitude"]), radians(b["longitude"])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371.0 * 2 * asin(sqrt(h))


def number(value):
    if isinstance(value, bool):
        return None
    try:
        x = float(value)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def mae_bias(pairs, field):
    values = [(number(a.get(field)), number(b.get(field))) for a, b in pairs]
    values = [(a, b) for a, b in values if a is not None and b is not None]
    if not values:
        return {"pairedDays": 0, "mae": None, "biasEra5MinusJma": None}
    errors = [a - b for a, b in values]
    return {
        "pairedDays": len(values),
        "mae": round(sum(abs(x) for x in errors) / len(errors), 3),
        "biasEra5MinusJma": round(sum(errors) / len(errors), 3),
    }


def quality_flags_acceptable(row):
    return all(flag == "trace_negative_precipitation_clamped" for flag in (row.get("qualityFlags") or []))


def compare_region(region, era5_rows, station, max_distance_km=75.0, minimum_pairs=365):
    distance = haversine_km(region["representativePoint"], station)
    station_rows = {r.get("validDate"): r for r in station.get("records", []) if r.get("validDate")}
    era5_by_date = {r.get("validDate"): r for r in era5_rows}
    paired = []
    for day in sorted(set(era5_by_date) & set(station_rows)):
        e, j = era5_by_date[day], station_rows[day]
        if e.get("sourceId") != ERA5_SOURCE or e.get("validHourCount") != 24 or not quality_flags_acceptable(e):
            continue
        paired.append((e, j))
    rain_pairs = [(e, j) for e, j in paired if number(e.get("precipitationMm")) is not None and number(j.get("precipitationMm")) is not None]
    temp_min = mae_bias(paired, "temperatureMinC")
    temp_max = mae_bias(paired, "temperatureMaxC")
    rain = mae_bias(paired, "precipitationMm")
    wet_hits = wet_misses = false_alarms = correct_dry = 0
    for e, j in rain_pairs:
        ew, jw = number(e["precipitationMm"]) >= 1.0, number(j["precipitationMm"]) >= 1.0
        if ew and jw: wet_hits += 1
        elif ew and not jw: false_alarms += 1
        elif not ew and jw: wet_misses += 1
        else: correct_dry += 1
    station_issues = []
    if station.get("sourceId") != JMA_SOURCE:
        station_issues.append("unsupported_or_missing_jma_source_id")
    if distance > max_distance_km:
        station_issues.append("station_outside_maximum_distance")
    if len(rain_pairs) < minimum_pairs:
        station_issues.append("insufficient_paired_rain_days")
    return {
        "regionId": region["subregionId"],
        "stationId": station.get("stationId"),
        "stationName": station.get("name"),
        "stationDistanceKm": round(distance, 2),
        "maximumAllowedDistanceKm": max_distance_km,
        "pairedDays": len(paired),
        "rainfall": rain,
        "temperatureMin": temp_min,
        "temperatureMax": temp_max,
        "wetDayContingencyAt1mm": {
            "hit": wet_hits, "miss": wet_misses, "falseAlarm": false_alarms, "correctNegative": correct_dry
        },
        "status": "paired-comparison-available" if not station_issues else "comparison-limited",
        "issues": station_issues,
        "interpretation": "ERA5-Land reanalysis versus independent JMA station observation; differences are diagnostic and are not automatically bias-corrected."
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jma_file", type=Path)
    parser.add_argument("--daily-dir", type=Path, default=Path("data/era5-japan-1991-2020/daily"))
    parser.add_argument("--max-distance-km", type=float, default=75.0)
    parser.add_argument("--minimum-pairs", type=int, default=365)
    parser.add_argument("--output", type=Path, default=Path("data/processed/japan-jma-crosscheck.json"))
    args = parser.parse_args()
    if args.max_distance_km <= 0 or args.minimum_pairs < 1:
        parser.error("distance and minimum pairs must be positive")
    jma = json.loads(args.jma_file.read_text(encoding="utf-8"))
    if not isinstance(jma.get("stations"), list):
        parser.error("JMA file must contain stations[]")
    mapping = json.loads(MAPPING.read_text(encoding="utf-8"))
    daily_by_region = {}
    for path in sorted((ROOT / args.daily_dir).glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for row in payload.get("records", []):
            daily_by_region.setdefault(row.get("subregionId"), []).append(row)
    station_by_region = {}
    for station in jma["stations"]:
        station.setdefault("sourceId", jma.get("sourceId"))
        station_by_region.setdefault(station.get("regionId"), []).append(station)
    results = {}
    for region in mapping["points"]:
        sid = region["subregionId"]
        candidates = station_by_region.get(sid, [])
        if not candidates:
            results[sid] = {"status": "not-available", "reason": "no JMA station assigned to this subregion"}
            continue
        chosen = min(candidates, key=lambda st: haversine_km(region["representativePoint"], st))
        results[sid] = compare_region(region, daily_by_region.get(sid, []), chosen, args.max_distance_km, args.minimum_pairs)
    report = {
        "schemaVersion": 1, "status": "jma-crosscheck-complete-not-activated",
        "era5SourceId": ERA5_SOURCE, "jmaSourceId": jma.get("sourceId"),
        "regions": results,
        "activationPolicy": {"climateBaselineEnabled": False, "forecastEnabled": False, "decisionUseEligible": False}
    }
    target = ROOT / args.output
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "regions": len(results), "available": sum(x.get("status") == "paired-comparison-available" for x in results.values()), "output": str(target)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
