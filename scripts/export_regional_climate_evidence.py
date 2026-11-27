#!/usr/bin/env python3
"""Export regional 365-day climatology into date-addressable evidence records.

The export is descriptive climate evidence only. It does not activate forecast
or trip-ranking use, and missing/insufficient metrics remain null.
"""
from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path


def _metric(day: dict, key: str) -> dict:
    value = day.get("metrics", {}).get(key, {})
    if value.get("status") != "usable":
        return {"validYears": value.get("validYears", 0), "mean": None, "median": None, "p90": None}
    return {
        "validYears": value.get("validYears", 0),
        "mean": value.get("mean"),
        "median": value.get("median"),
        "p90": value.get("p90"),
    }


def _day_index(region: dict) -> dict[str, dict]:
    return {item["targetMonthDay"]: item for item in region.get("dailyCalendar", [])}


def _lookup(index: dict[str, dict], target: date) -> tuple[dict, str]:
    key = target.strftime("%m-%d")
    if key in index:
        return index[key], key
    if target.month == 2 and target.day == 29:
        before = index.get("02-28")
        after = index.get("03-01")
        if before is not None and after is not None:
            return _interpolate_feb29(before, after), "02-28|03-01"
    return {}, key


def _interpolate_metric(a: dict, b: dict, include_p90: bool = False) -> dict:
    valid_years = min(a.get("validYears", 0), b.get("validYears", 0))
    result = {"validYears": valid_years}
    for field in ("mean", "median"):
        av, bv = a.get(field), b.get(field)
        result[field] = (av + bv) / 2 if isinstance(av, (int, float)) and isinstance(bv, (int, float)) else None
    # A percentile cannot be safely reconstructed by averaging two percentiles.
    result["p90"] = None
    return result


def _interpolate_feb29(before: dict, after: dict) -> dict:
    metrics = {}
    keys = set(before.get("metrics", {})) | set(after.get("metrics", {}))
    for key in keys:
        metrics[key] = _interpolate_metric(
            _metric(before, key), _metric(after, key)
        )
        if key == "precipitationMm":
            a = before.get("metrics", {}).get(key, {})
            b = after.get("metrics", {}).get(key, {})
            av, bv = a.get("wetDayFrequencyPct"), b.get("wetDayFrequencyPct")
            metrics[key]["wetDayFrequencyPct"] = (
                (av + bv) / 2 if isinstance(av, (int, float)) and isinstance(bv, (int, float)) else None
            )
            metrics[key]["heavyRain10mmFrequencyPct"] = None
            metrics[key]["heavyRain30mmFrequencyPct"] = None
    return {"targetMonthDay": "02-29", "metrics": metrics,
            "calendarMapping": "interpolated from 02-28 and 03-01; percentile and heavy-rain frequencies withheld"}


def _usable_value(metric: dict, key: str, minimum_valid_years: int):
    return metric.get(key) if metric.get("validYears", 0) >= minimum_valid_years else None


def export_evidence(climatology: dict, start: date, days: int = 90) -> dict:
    if days < 1 or days > 366:
        raise ValueError("days must be between 1 and 366")
    if climatology.get("sourceId") != "ERA5_LAND_HOURLY_TIMESERIES":
        raise ValueError("Unsupported climatology sourceId")
    if climatology.get("timezone") != "Asia/Tokyo":
        raise ValueError("Climatology timezone must be Asia/Tokyo")
    if climatology.get("climateBaselineEnabled") is not False or climatology.get("forecastEnabled") is not False:
        raise ValueError("Historical climatology input must remain non-activated")
    if not isinstance(climatology.get("regions"), dict) or not climatology["regions"]:
        raise ValueError("Climatology contains no regional records")

    minimum_valid_years = int(climatology.get("minimumValidYears", 24))
    if minimum_valid_years < 1:
        raise ValueError("minimumValidYears must be positive")

    output = {
        "schemaVersion": 1,
        "status": "regional-historical-evidence-exported-not-activated",
        "sourceId": climatology["sourceId"],
        "dataset": climatology.get("dataset"),
        "referencePeriod": climatology.get("referencePeriod"),
        "timezone": "Asia/Tokyo",
        "climateBaselineEnabled": False,
        "forecastEnabled": False,
        "decisionUseEligible": False,
        "dateRange": [start.isoformat(), (start + timedelta(days=days - 1)).isoformat()],
        "regions": {},
    }

    for region_id, region in sorted(climatology["regions"].items()):
        index = _day_index(region)
        records = []
        for offset in range(days):
            target = start + timedelta(days=offset)
            day, mapped_from = _lookup(index, target)
            metrics = day.get("metrics", {})
            rain = metrics.get("precipitationMm", {})
            tmin = metrics.get("temperatureMinC", {})
            tmax = metrics.get("temperatureMaxC", {})
            tmean = metrics.get("temperatureMeanC", {})
            humidity = metrics.get("relativeHumidityMeanPct", {})
            wind = metrics.get("windSpeedMeanMs", {})
            rain_years = rain.get("validYears", 0)
            temp_years = min(tmin.get("validYears", 0), tmax.get("validYears", 0))
            records.append({
                "subregionId": region_id,
                "date": target.isoformat(),
                "monthDay": target.strftime("%m-%d"),
                "calendarMappedFrom": mapped_from,
                "sampleYears": min(rain_years, temp_years) if rain_years and temp_years else 0,
                "rainSampleYears": rain_years,
                "temperatureSampleYears": temp_years,
                "rainFrequency": _usable_value(rain, "wetDayFrequencyPct", minimum_valid_years),
                "rainMean": _usable_value(rain, "mean", minimum_valid_years),
                "rainP10": None,
                "rainP90": _usable_value(rain, "p90", minimum_valid_years),
                "highMean": _usable_value(tmax, "mean", minimum_valid_years),
                "lowMean": _usable_value(tmin, "mean", minimum_valid_years),
                "temperatureMean": _usable_value(tmean, "mean", minimum_valid_years),
                "humidityMean": _usable_value(humidity, "mean", minimum_valid_years),
                "windMean": _usable_value(wind, "mean", minimum_valid_years),
                "historicalStatus": {
                    "rain": rain.get("status", "missing"),
                    "temperatureMin": tmin.get("status", "missing"),
                    "temperatureMax": tmax.get("status", "missing"),
                },
                "sourceId": climatology["sourceId"],
                "referencePeriod": climatology.get("referencePeriod"),
                "decisionUseEligible": False,
            })
        output["regions"][region_id] = {
            "representativeCourseId": region.get("representativeCourseId"),
            "latitude": region.get("latitude"),
            "longitude": region.get("longitude"),
            "records": records,
            "usableRainDays": sum(r["rainFrequency"] is not None for r in records),
            "usableTemperatureDays": sum(r["highMean"] is not None and r["lowMean"] is not None for r in records),
        }
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("climatology", type=Path)
    parser.add_argument("--start-date", required=True, type=date.fromisoformat)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        payload = json.loads(args.climatology.read_text(encoding="utf-8"))
        result = export_evidence(payload, args.start_date, args.days)
    except Exception as exc:
        parser.exit(2, f"Evidence export blocked: {exc}\n")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": result["status"], "regions": len(result["regions"]),
        "days": args.days, "decisionUseEligible": False, "output": str(args.output)
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
