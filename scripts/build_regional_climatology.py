#!/usr/bin/env python3
"""Build 1991-2020 rolling-calendar climatology from normalized daily JSON files.

This produces descriptive historical climate statistics only. It never activates
forecast or recommendation features.
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "config/global/regional-climate-data-plan.json"
METRICS = {
    "precipitationMm": "precipitation",
    "temperatureMinC": "temperature",
    "temperatureMeanC": "temperature",
    "temperatureMaxC": "temperature",
    "relativeHumidityMeanPct": "humidity",
    "windSpeedMeanMs": "wind",
    "windSpeedMaxMs": "wind",
}
WINDOW_DAYS = 15


def _calendar_ordinal(value: date) -> float:
    """Map dates to a non-leap 2001 calendar; Feb 29 sits midway Feb 28/Mar 1."""
    if value.month == 2 and value.day == 29:
        return 59.5
    return float(date(2001, value.month, value.day).timetuple().tm_yday)


def _calendar_distance(a: date, b: date) -> float:
    delta = abs(_calendar_ordinal(a) - _calendar_ordinal(b))
    return min(delta, 365.0 - delta)


def _expected_window_days(year: int, target: date, window_days: int) -> int:
    expected = window_days * 2 + 1
    is_leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    if is_leap and _calendar_distance(date(year, 2, 29), target) <= window_days:
        expected += 1
    return expected

def _percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * p
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return round(ordered[lower], 3)
    fraction = position - lower
    return round(ordered[lower] * (1 - fraction) + ordered[upper] * fraction, 3)


def load_daily_files(paths: list[Path], start_year: int = 1991, end_year: int = 2020) -> dict[str, list[dict]]:
    by_region: dict[str, dict[str, dict]] = defaultdict(dict)
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = payload.get("records") if isinstance(payload, dict) else None
        if not isinstance(records, list):
            raise ValueError(f"{path}: expected a JSON object containing records[]")
        for record in records:
            region = record.get("subregionId")
            if not region:
                raise ValueError(f"{path}: record missing subregionId")
            if record.get("timezone") != "Asia/Tokyo" or record.get("localDayTimezone") != "Asia/Tokyo":
                raise ValueError(f"{path}: {region} record is not explicitly Asia/Tokyo")
            if record.get("sourceId") != "ERA5_LAND_HOURLY_TIMESERIES":
                raise ValueError(f"{path}: unsupported or mixed sourceId")
            day = date.fromisoformat(record["validDate"])
            if not start_year <= day.year <= end_year:
                continue
            key = day.isoformat()
            if key in by_region[region]:
                raise ValueError(f"Duplicate daily record for {region} {key}")
            by_region[region][key] = record
    return {region: list(records.values()) for region, records in by_region.items()}


def _metric_value(record: dict, field: str):
    value = record.get(field)
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _valid_day(record: dict) -> bool:
    return record.get("validHourCount") == 24 and not record.get("qualityFlags")


def summarize_window(records: list[dict], target: date, window_days: int = WINDOW_DAYS,
                     start_year: int = 1991, end_year: int = 2020,
                     minimum_valid_years: int = 24, minimum_completeness: float = 0.90) -> dict:
    half = window_days
    selected = []
    target_ordinal = _calendar_ordinal(target)
    for record in records:
        day = date.fromisoformat(record["validDate"])
        if _calendar_distance(day, target) <= half:
            ordinal = _calendar_ordinal(day)
            season_year = day.year
            if target_ordinal <= half and ordinal >= 365.0 - half:
                season_year += 1
            elif target_ordinal >= 365.0 - half and ordinal <= half + 1:
                season_year -= 1
            selected.append((season_year, record))

    nominal_expected_days = window_days * 2 + 1
    by_year: dict[int, list[dict]] = defaultdict(list)
    for season_year, record in selected:
        by_year[season_year].append(record)

    metric_results = {}
    for field, category in METRICS.items():
        samples = []
        valid_years = []
        for year in range(start_year, end_year + 1):
            year_records = by_year.get(year, [])
            valid_values = [
                _metric_value(r, field) for r in year_records
                if _valid_day(r) and _metric_value(r, field) is not None
            ]
            expected_for_year = _expected_window_days(year, target, window_days)
            required_days_for_year = math.ceil(expected_for_year * minimum_completeness)
            if len(valid_values) >= required_days_for_year:
                valid_years.append(year)
                samples.extend(valid_values)

        enough = len(valid_years) >= minimum_valid_years
        result = {
            "status": "usable" if enough else "insufficient-history",
            "validYears": len(valid_years),
            "validYearList": valid_years,
            "sampleCount": len(samples),
            "nominalExpectedDaysPerYear": nominal_expected_days,
            "expectedDaysPerYearRange": [
                min(_expected_window_days(y, target, window_days) for y in range(start_year, end_year + 1)),
                max(_expected_window_days(y, target, window_days) for y in range(start_year, end_year + 1)),
            ],
            "minimumValidDaysPerYearRange": [
                min(math.ceil(_expected_window_days(y, target, window_days) * minimum_completeness) for y in range(start_year, end_year + 1)),
                max(math.ceil(_expected_window_days(y, target, window_days) * minimum_completeness) for y in range(start_year, end_year + 1)),
            ],
            "minimumValidYears": minimum_valid_years,
            "completenessThreshold": minimum_completeness,
        }
        if enough:
            result["median"] = _percentile(samples, 0.50)
            result["p90"] = _percentile(samples, 0.90)
            result["mean"] = round(statistics.fmean(samples), 3)
            if field == "precipitationMm":
                result["wetDayFrequencyPct"] = round(100 * sum(v >= 1.0 for v in samples) / len(samples), 2)
                result["heavyRain10mmFrequencyPct"] = round(100 * sum(v >= 10.0 for v in samples) / len(samples), 2)
                result["heavyRain30mmFrequencyPct"] = round(100 * sum(v >= 30.0 for v in samples) / len(samples), 2)
        else:
            result.update({"median": None, "p90": None, "mean": None})
            if field == "precipitationMm":
                result.update({
                    "wetDayFrequencyPct": None,
                    "heavyRain10mmFrequencyPct": None,
                    "heavyRain30mmFrequencyPct": None,
                })
        metric_results[field] = result

    return {
        "targetMonthDay": target.strftime("%m-%d"),
        "calendarWindowDaysEachSide": window_days,
        "calendarWindowTotalDays": nominal_expected_days,
        "leapDayPolicy": "February 29 mapped midway between February 28 and March 1 and included in both adjacent rolling windows when within 15 calendar days",
        "metrics": metric_results,
    }


def build_climatology(regions: dict[str, list[dict]], start_year: int = 1991, end_year: int = 2020,
                      window_days: int = WINDOW_DAYS, minimum_valid_years: int = 24,
                      minimum_completeness: float = 0.90) -> dict:
    output = {
        "schemaVersion": 1,
        "status": "historical-climatology-computed-not-activated",
        "sourceId": "ERA5_LAND_HOURLY_TIMESERIES",
        "dataset": "reanalysis-era5-land-timeseries",
        "referencePeriod": [start_year, end_year],
        "timezone": "Asia/Tokyo",
        "windowDaysEachSide": window_days,
        "minimumValidYears": minimum_valid_years,
        "minimumDailyCompleteness": minimum_completeness,
        "climateBaselineEnabled": False,
        "forecastEnabled": False,
        "regions": {},
    }
    for region, records in sorted(regions.items()):
        metadata = records[0] if records else {}
        daily = []
        for month in range(1, 13):
            for day in range(1, 32):
                try:
                    target = date(2001, month, day)
                except ValueError:
                    continue
                daily.append(summarize_window(records, target, window_days, start_year, end_year,
                                              minimum_valid_years, minimum_completeness))
        output["regions"][region] = {
            "representativeCourseId": metadata.get("representativeCourseId"),
            "latitude": metadata.get("latitude"),
            "longitude": metadata.get("longitude"),
            "gridLatitude": metadata.get("gridLatitude"),
            "gridLongitude": metadata.get("gridLongitude"),
            "dailyCalendar": daily,
            "usableCalendarDays": sum(
                1 for item in daily
                if item["metrics"]["precipitationMm"]["status"] == "usable"
            ),
            "sourceRecordCount": len(records),
        }
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", type=Path, help="daily JSON files produced by aggregate_era5_land_daily.py")
    parser.add_argument("--start-year", type=int, default=1991)
    parser.add_argument("--end-year", type=int, default=2020)
    parser.add_argument("--window-days", type=int, default=15)
    parser.add_argument("--minimum-valid-years", type=int, default=24)
    parser.add_argument("--minimum-completeness", type=float, default=0.90)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.end_year < args.start_year or args.window_days < 0 or not 0 < args.minimum_completeness <= 1:
        parser.error("Invalid year range, window size, or completeness threshold")
    try:
        regions = load_daily_files(args.inputs, args.start_year, args.end_year)
        result = build_climatology(regions, args.start_year, args.end_year, args.window_days,
                                   args.minimum_valid_years, args.minimum_completeness)
    except Exception as exc:
        parser.exit(2, f"Climatology build blocked: {exc}\n")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    usable = {region: value["usableCalendarDays"] for region, value in result["regions"].items()}
    print(json.dumps({"status": result["status"], "regions": len(usable), "usableCalendarDays": usable,
                      "climateBaselineEnabled": False, "output": str(args.output)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
