import json
import tempfile
import unittest
import importlib.util
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("golf_trip_date_ranking", ROOT / "scripts/rank_golf_trip_dates.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def sample_calendar(wet_frequency_by_day=None):
    wet_frequency_by_day = wet_frequency_by_day or {}
    calendar = {}
    d = date(2001, 1, 1)
    while d.year == 2001:
        key = d.strftime("%m-%d")
        wet = wet_frequency_by_day.get(key, 50.0)
        calendar[key] = {
            "targetMonthDay": key,
            "metrics": {
                "precipitationMm": {
                    "status": "usable",
                    "wetDayFrequencyPct": wet,
                    "heavyRain10mmFrequencyPct": wet / 2,
                    "heavyRain30mmFrequencyPct": wet / 4,
                    "median": 0.0,
                    "p90": wet / 10,
                    "validYears": 30,
                    "sampleCount": 900,
                }
            },
        }
        d += timedelta(days=1)
    return calendar


class GolfTripDateRankingTests(unittest.TestCase):
    def test_selects_three_lowest_rain_risk_days(self):
        start = date(2026, 6, 1)
        frequencies = {
            (start + timedelta(days=i)).strftime("%m-%d"): value
            for i, value in enumerate([70, 10, 60, 20, 50])
        }
        result = MODULE.rank_trip_start(start, sample_calendar(frequencies))
        self.assertEqual(result["playDates"], ["2026-06-02", "2026-06-04", "2026-06-05"])
        self.assertEqual(result["roundCount"], 3)
        self.assertEqual(len(result["restOrTransferDates"]), 2)

    def test_ranks_trip_starts_by_rainfall_before_secondary_metrics(self):
        start = date(2026, 6, 1)
        frequencies = {}
        for i, value in enumerate([60, 60, 60, 60, 60, 10, 10, 10, 10, 10]):
            frequencies[(start + timedelta(days=i)).strftime("%m-%d")] = value
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "climate.json"
            payload = {
                "status": "historical-climatology-computed-not-activated",
                "climateBaselineEnabled": False,
                "forecastEnabled": False,
                "regions": {"JP-TEST": {"representativeCourseId": "course-test",
                    "latitude": 35.0, "longitude": 135.0,
                    "dailyCalendar": list(sample_calendar(frequencies).values())},
                },
            }
            path.write_text(json.dumps(payload), encoding="utf-8")
            result = MODULE.rank_departures(path, "JP-TEST", start, horizon_days=10)
            self.assertGreater(result["rankedCandidateCount"], 0)
            self.assertEqual(result["recommendations"][0]["startDate"], "2026-06-06")
            self.assertFalse(result["activation"]["recommendationProductionEnabled"])

    def test_missing_climatology_blocks_candidate_instead_of_zero_filling(self):
        calendar = sample_calendar()
        calendar["06-03"]["metrics"]["precipitationMm"]["status"] = "insufficient-history"
        result = MODULE.rank_trip_start(date(2026, 6, 1), calendar)
        self.assertEqual(result["status"], "insufficient-climate-coverage")

    def test_requires_fixed_trip_and_round_parameters(self):
        with self.assertRaises(ValueError):
            MODULE.rank_departures(Path("unused"), "JP-TEST", date(2026, 6, 1), trip_days=4)

    def test_rejects_activated_input_in_preview_engine(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "climate.json"
            payload = {"status": "historical-climatology-computed-not-activated",
                       "climateBaselineEnabled": True, "forecastEnabled": False,
                       "regions": {"JP-TEST": {}}}
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(ValueError):
                MODULE.rank_departures(path, "JP-TEST", date(2026, 6, 1), horizon_days=5)


if __name__ == "__main__":
    unittest.main()
