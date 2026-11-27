import unittest
from datetime import date
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("regional_climatology", ROOT / "scripts/build_regional_climatology.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def make_record(day, rain=0.0):
    return {
        "subregionId": "JP-TEST",
        "validDate": day.isoformat(),
        "validHourCount": 24,
        "qualityFlags": [],
        "precipitationMm": rain,
        "temperatureMinC": 10.0,
        "temperatureMeanC": 15.0,
        "temperatureMaxC": 20.0,
        "relativeHumidityMeanPct": 60.0,
        "windSpeedMeanMs": 2.0,
        "windSpeedMaxMs": 4.0,
    }


class RegionalClimatologyTests(unittest.TestCase):
    def test_february_29_is_between_feb_28_and_march_1(self):
        leap = date(2020, 2, 29)
        self.assertEqual(MODULE._calendar_distance(leap, date(2001, 2, 28)), 0.5)
        self.assertEqual(MODULE._calendar_distance(leap, date(2001, 3, 1)), 0.5)

    def test_percentile_interpolation(self):
        self.assertEqual(MODULE._percentile([0.0, 10.0], 0.9), 9.0)

    def test_requires_24_years_and_90_percent_window_completeness(self):
        records = []
        for year in range(1991, 2015):
            for offset in range(-15, 16):
                d = date(2001, 6, 15) + __import__("datetime").timedelta(days=offset)
                records.append(make_record(date(year, d.month, d.day), rain=2.0))
        result = MODULE.summarize_window(records, date(2001, 6, 15), minimum_valid_years=24)
        self.assertEqual(result["metrics"]["precipitationMm"]["status"], "usable")
        self.assertEqual(result["metrics"]["precipitationMm"]["validYears"], 24)
        self.assertEqual(result["metrics"]["precipitationMm"]["wetDayFrequencyPct"], 100.0)

    def test_missing_rain_is_not_dry_day_and_blocks_year(self):
        records = []
        for year in range(1991, 2015):
            for offset in range(31):
                d = date(year, 6, 1) + __import__("datetime").timedelta(days=offset)
                row = make_record(d, rain=0.0)
                if offset == 0:
                    row["precipitationMm"] = None
                records.append(row)
        result = MODULE.summarize_window(records, date(2001, 6, 15), minimum_valid_years=24)
        self.assertEqual(result["metrics"]["precipitationMm"]["status"], "insufficient-history")

    def test_duplicate_daily_date_is_rejected(self):
        import tempfile, json
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "daily.json"
            record = make_record(date(2000, 1, 1))
            record.update({"timezone": "Asia/Tokyo", "localDayTimezone": "Asia/Tokyo",
                           "sourceId": "ERA5_LAND_HOURLY_TIMESERIES"})
            path.write_text(json.dumps({"records": [record, record]}), encoding="utf-8")
            with self.assertRaises(ValueError):
                MODULE.load_daily_files([path])


if __name__ == "__main__":
    unittest.main()
