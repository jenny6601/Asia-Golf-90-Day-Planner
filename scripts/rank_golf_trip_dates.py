#!/usr/bin/env python3
"""Rank 5-day/4-night golf trip starts using the 1991-2020 regional climate prior.

Rainfall is the primary ranking criterion. The engine chooses the three lowest
historical rain-risk days within each five-day trip. This is not a deterministic
weather forecast and does not use unvalidated data or fabricate missing values.
"""
from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

CLIMATE_STATUS = "historical-climatology-computed-not-activated"


def load_climatology(path: Path, subregion: str) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("status") not in {CLIMATE_STATUS, "historical-climatology-validated"}:
        raise ValueError("Unsupported climatology status; expected computed historical climate output")
    if payload.get("climateBaselineEnabled") is not False or payload.get("forecastEnabled") is not False:
        raise ValueError("Climatology activation flags must remain false for this validation engine")
    region = payload.get("regions", {}).get(subregion)
    if not region:
        raise ValueError(f"No climatology data for subregion {subregion}")
    calendar = region.get("dailyCalendar")
    if not isinstance(calendar, list) or len(calendar) != 365:
        raise ValueError(f"{subregion}: expected 365 daily calendar entries")
    by_month_day = {}
    for item in calendar:
        key = item.get("targetMonthDay")
        if key in by_month_day:
            raise ValueError(f"{subregion}: duplicate calendar day {key}")
        by_month_day[key] = item
    return {"metadata": region, "calendar": by_month_day, "source": payload}


def day_rain_risk(day: date, calendar: dict) -> dict:
    key = day.strftime("%m-%d")
    item = calendar.get(key)
    leap_day = day.month == 2 and day.day == 29
    if leap_day:
        left = calendar.get("02-28")
        right = calendar.get("03-01")
        if left and right:
            left_rain = left.get("metrics", {}).get("precipitationMm", {})
            right_rain = right.get("metrics", {}).get("precipitationMm", {})
            if left_rain.get("status") == "usable" and right_rain.get("status") == "usable":
                fields = ("wetDayFrequencyPct", "heavyRain10mmFrequencyPct", "heavyRain30mmFrequencyPct", "median", "p90")
                rain = {}
                for field in fields:
                    a, b = left_rain.get(field), right_rain.get(field)
                    rain[field] = (float(a) + float(b)) / 2 if a is not None and b is not None else None
                rain["validYears"] = min(left_rain.get("validYears", 0), right_rain.get("validYears", 0))
                rain["sampleCount"] = min(left_rain.get("sampleCount", 0), right_rain.get("sampleCount", 0))
                item = {"metrics": {"precipitationMm": {**rain, "status": "usable"}}}
    if not item:
        return {"date": day.isoformat(), "usable": False, "reason": "missing_calendar_day"}
    metrics = item.get("metrics", {})
    rain = metrics.get("precipitationMm", {})
    if rain.get("status") != "usable" or rain.get("wetDayFrequencyPct") is None:
        return {"date": day.isoformat(), "usable": False, "reason": "insufficient_historical_rainfall"}
    return {
        "date": day.isoformat(),
        "usable": True,
        "wetDayFrequencyPct": float(rain["wetDayFrequencyPct"]),
        "heavyRain10mmFrequencyPct": rain.get("heavyRain10mmFrequencyPct"),
        "heavyRain30mmFrequencyPct": rain.get("heavyRain30mmFrequencyPct"),
        "medianDailyRainMm": rain.get("median"),
        "p90DailyRainMm": rain.get("p90"),
        "validYears": rain.get("validYears"),
        "sampleCount": rain.get("sampleCount"),
        "leapDayMethod": "mean of February 28 and March 1 climatology" if leap_day else None,
        "status": "historical-climate-prior-not-daily-forecast",
    }


def _numeric(value, fallback=999999.0):
    try:
        return float(value) if value is not None else fallback
    except (TypeError, ValueError):
        return fallback


def rank_trip_start(start: date, calendar: dict, trip_days: int = 5, rounds: int = 3) -> dict:
    # Confirmed itinerary: day 1 arrival/transfer, days 2-4 golf, day 5 departure.
    if trip_days != 5 or rounds != 3:
        raise ValueError("This planner requires 5 days / 4 nights with golf on trip days 2, 3 and 4")
    daily = [day_rain_risk(start + timedelta(days=i), calendar) for i in range(trip_days)]
    if len(daily) != 5 or not all(x["usable"] for x in daily):
        return {
            "startDate": start.isoformat(),
            "endDate": (start + timedelta(days=4)).isoformat(),
            "status": "insufficient-climate-coverage",
            "reason": "All five trip dates require usable historical climate statistics; golf days are fixed to trip days 2-4",
            "dailyPlan": daily,
        }
    golf_days = daily[1:4]
    travel_days = [daily[0], daily[4]]
    return {
        "startDate": start.isoformat(),
        "endDate": (start + timedelta(days=4)).isoformat(),
        "status": "ranked-by-historical-rainfall-prior",
        "roundCount": 3,
        "playDates": [x["date"] for x in golf_days],
        "travelDates": [x["date"] for x in travel_days],
        "rainRisk": {
            "averageWetDayFrequencyPct": round(sum(x["wetDayFrequencyPct"] for x in golf_days) / 3, 2),
            "averageHeavyRain10mmFrequencyPct": round(sum(_numeric(x["heavyRain10mmFrequencyPct"], 0) for x in golf_days) / 3, 2),
            "averageHeavyRain30mmFrequencyPct": round(sum(_numeric(x["heavyRain30mmFrequencyPct"], 0) for x in golf_days) / 3, 2),
            "averageP90DailyRainMm": round(sum(_numeric(x["p90DailyRainMm"], 0) for x in golf_days) / 3, 2),
            "selectedRoundDays": 3,
            "interpretation": "Average historical frequency across the fixed middle three golf days; not the probability that this specific future trip will rain.",
        },
        "dailyPlan": [
            {**x, "plannedActivity": "arrival-or-transfer" if i == 0 else "golf" if i in (1, 2, 3) else "departure-or-transfer"}
            for i, x in enumerate(daily)
        ],
    }

def rank_departures(climate_path: Path, subregion: str, from_date: date, horizon_days: int = 90,
                    trip_days: int = 5, rounds: int = 3) -> dict:
    if trip_days != 5 or rounds != 3:
        raise ValueError("This planner is configured for exactly 5 days / 4 nights and 3 golf rounds")
    if horizon_days < 1 or horizon_days > 90:
        raise ValueError("horizon_days must be between 1 and 90 departure dates")
    loaded = load_climatology(climate_path, subregion)
    candidates = []
    for offset in range(horizon_days - trip_days + 1):
        start = from_date + timedelta(days=offset)
        candidates.append(rank_trip_start(start, loaded["calendar"], trip_days, rounds))
    eligible = [x for x in candidates if x["status"] == "ranked-by-historical-rainfall-prior"]
    eligible.sort(key=lambda x: (
        x["rainRisk"]["averageWetDayFrequencyPct"],
        x["rainRisk"]["averageHeavyRain10mmFrequencyPct"],
        x["rainRisk"]["averageHeavyRain30mmFrequencyPct"],
        x["rainRisk"]["averageP90DailyRainMm"],
        x["startDate"],
    ))
    for rank, item in enumerate(eligible, 1):
        item["rank"] = rank
    return {
        "schemaVersion": 1,
        "status": "historical-climate-date-ranking-preview",
        "countryCode": "JP",
        "subregionId": subregion,
        "representativeCourseId": loaded["metadata"].get("representativeCourseId"),
        "representativePoint": {
            "latitude": loaded["metadata"].get("latitude"),
            "longitude": loaded["metadata"].get("longitude"),
        },
        "planningParameters": {
            "tripDays": trip_days,
            "nights": trip_days - 1,
            "golfRounds": rounds,
            "primaryPriority": "minimum-rainfall-risk",
            "candidateDepartureDates": horizon_days,
            "tripMayExtendBeyondDepartureHorizon": True,
            "fromDate": from_date.isoformat(),
        },
        "method": {
            "source": "1991-2020 ERA5-Land regional climatology",
            "dailySelection": "Golf dates are fixed to trip days 2, 3 and 4 (zero-based offsets 1, 2 and 3); days 1 and 5 are arrival/departure or transfer days.",
            "tripRanking": "Lexicographic across the fixed middle three golf dates: average wet-day frequency, >=10mm frequency, >=30mm frequency, P90 rainfall. No golf-date optimization inside the trip window.",
            "forecastClaim": "No deterministic daily forecast is generated. Results are historical seasonal climate priors only.",
            "shortRangeForecastIntegration": "Not included in this engine stage; keep 1-16 day live forecast path separate.",
        },
        "activation": {
            "climateBaselineEnabled": False,
            "forecastEnabled": False,
            "recommendationProductionEnabled": False,
            "requiresDataValidation": True,
        },
        "candidateCount": len(candidates),
        "rankedCandidateCount": len(eligible),
        "blockedCandidateCount": len(candidates) - len(eligible),
        "recommendations": eligible,
        "blockedCandidates": [x for x in candidates if x["status"] != "ranked-by-historical-rainfall-prior"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--climatology", type=Path, required=True)
    parser.add_argument("--subregion", required=True)
    parser.add_argument("--from-date", required=True)
    parser.add_argument("--horizon-days", type=int, default=90, help="Calendar horizon; returns horizon_days - 4 complete trip windows")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = rank_departures(args.climatology, args.subregion, date.fromisoformat(args.from_date), args.horizon_days)
    except Exception as exc:
        parser.exit(2, f"Date ranking blocked: {exc}\n")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": result["status"],
        "rankedCandidateCount": result["rankedCandidateCount"],
        "blockedCandidateCount": result["blockedCandidateCount"],
        "topThree": result["recommendations"][:3],
        "productionEnabled": result["activation"]["recommendationProductionEnabled"],
        "output": str(args.output),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
