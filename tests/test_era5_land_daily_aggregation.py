import unittest
from datetime import datetime, timezone, timedelta
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("era5_land_daily_aggregation", ROOT / "scripts/aggregate_era5_land_daily.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class Era5LandDailyAggregationTests(unittest.TestCase):
    def test_temperature_conversion(self):
        self.assertAlmostEqual(MODULE.celsius(273.15), 0.0)

    def test_relative_humidity_is_bounded(self):
        rh = MODULE.relative_humidity_pct(20.0, 10.0)
        self.assertGreater(rh, 0)
        self.assertLess(rh, 100)

    def test_wind_direction_convention(self):
        self.assertAlmostEqual(MODULE.wind_from_direction_deg(1.0, 0.0), 270.0)
        self.assertAlmostEqual(MODULE.wind_from_direction_deg(0.0, 1.0), 180.0)
        self.assertIsNone(MODULE.wind_from_direction_deg(0.0, 0.0))

    def test_complete_24_hour_day_aggregates(self):
        utc = timezone.utc
        rows = []
        for hour in range(24):
            rows.append({
                "time": datetime(2020, 1, 1, hour, tzinfo=utc),
                "temperatureK": 293.15,
                "dewpointK": 283.15,
                "precipitationM": 0.0005,
                "u10Ms": 1.0,
                "v10Ms": 0.0,
            })
        metadata = {"subregionId": "JP-TEST", "sourceId": "TEST"}
        result = MODULE.aggregate_daily(rows, metadata)
        # UTC 2020-01-01 00-14 belongs to JST Jan 1; UTC 15-23 belongs to Jan 2.
        self.assertEqual(len(result), 2)
        jan1 = next(x for x in result if x["validDate"] == "2020-01-01")
        jan2 = next(x for x in result if x["validDate"] == "2020-01-02")
        self.assertEqual(jan1["validHourCount"], 15)
        self.assertEqual(jan2["validHourCount"], 9)
        self.assertIsNone(jan1["precipitationMm"])
        self.assertIsNone(jan2["precipitationMm"])

    def test_complete_jst_day_aggregates_metrics(self):
        rows = []
        start = datetime(2019, 12, 31, 15, tzinfo=timezone.utc)
        for hour in range(24):
            rows.append({
                "time": start + timedelta(hours=hour),
                "temperatureK": 293.15,
                "dewpointK": 283.15,
                "precipitationM": 0.0005,
                "u10Ms": 1.0,
                "v10Ms": 0.0,
            })
        result = MODULE.aggregate_daily(rows, {"subregionId": "JP-TEST"})
        self.assertEqual(len(result), 1)
        day = result[0]
        self.assertEqual(day["validDate"], "2020-01-01")
        self.assertEqual(day["validHourCount"], 24)
        self.assertAlmostEqual(day["precipitationMm"], 12.0, places=3)
        self.assertTrue(day["wetDay"])
        self.assertAlmostEqual(day["temperatureMeanC"], 20.0, places=2)
        self.assertAlmostEqual(day["windSpeedMeanMs"], 1.0, places=2)
        self.assertAlmostEqual(day["windDirectionMeanDeg"], 270.0, places=1)

    def test_incomplete_day_never_becomes_zero_rain(self):
        rows = [{
            "time": datetime(2020, 1, 1, hour, tzinfo=timezone.utc),
            "temperatureK": 293.15, "dewpointK": 283.15,
            "precipitationM": 0.0, "u10Ms": 1.0, "v10Ms": 0.0,
        } for hour in range(15)]
        result = MODULE.aggregate_daily(rows, {"subregionId": "JP-TEST"})
        self.assertTrue(all(x["precipitationMm"] is None for x in result))
        self.assertTrue(all(x["wetDay"] is None for x in result))


if __name__ == "__main__":
    unittest.main()
