import importlib.util
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("audit_japan_era5_daily", ROOT / "scripts/audit_japan_era5_daily.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def row(day, **changes):
    value = {
        "validDate": day.isoformat(), "validHourCount": 24, "qualityFlags": [],
        "precipitationMm": 0.0, "temperatureMinC": 10.0,
        "temperatureMeanC": 15.0, "temperatureMaxC": 20.0,
        "relativeHumidityMeanPct": 60.0, "windSpeedMeanMs": 2.0, "windSpeedMaxMs": 4.0,
    }
    value.update(changes)
    return value


class JapanDailyQATests(unittest.TestCase):
    def test_calendar_leap_day_is_halfway_between_february_dates(self):
        self.assertEqual(MODULE.calendar_distance(date(2020, 2, 29), date(2001, 2, 28)), 0.5)
        self.assertEqual(MODULE.calendar_distance(date(2020, 2, 29), date(2001, 3, 1)), 0.5)

    def test_annual_report_flags_missing_dates_and_low_coverage(self):
        rows = [row(date(1991, 1, 1) + __import__("datetime").timedelta(days=i)) for i in range(330)]
        report = MODULE.audit_region_year("JP-TEST", 1991, rows)
        self.assertEqual(report["presentDays"], 330)
        self.assertEqual(len(report["missingDates"]), 35)
        self.assertEqual(report["status"], "annual-coverage-usable")  # 330/365 >= 90%

    def test_metric_plausibility_bounds_exclude_invalid_values(self):
        rows = [row(date(1991, 1, 1), temperatureMeanC=999)]
        report = MODULE.audit_region_year("JP-TEST", 1991, rows)
        self.assertEqual(report["metricCoverage"]["temperatureMeanC"]["validDays"], 0)
        self.assertFalse(MODULE.valid_number(float("nan"), (0, 10)))
        self.assertFalse(MODULE.valid_number(True, (0, 10)))

    def test_daily_window_needs_24_years_with_90_percent_completeness(self):
        rows = []
        for year in range(1991, 2015):
            d = date(year, 6, 1)
            while d <= date(year, 6, 30):
                rows.append(row(d))
                d += __import__("datetime").timedelta(days=1)
        qa = MODULE.audit_climate_windows(rows, 1991, 2014)
        self.assertEqual(qa["dailyWindowValidYears"]["06-15"]["precipitationMm"], 24)
        self.assertEqual(qa["metricReadiness"]["precipitationMm"]["status"], "partial-calendar-coverage")

    def test_batch_state_counts_success_failed_and_missing_tasks(self):
        import json
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "batch-state.json"
            path.write_text(json.dumps({"status": "in-progress", "tasks": {
                "JP-TEST-1991": {"status": "daily-converted-structurally-validated"},
                "JP-TEST-1992": {"status": "failed"},
                "JP-TEST-1994": {"status": "pending"},
                "UNKNOWN-1991": {"status": "daily-converted-existing"}
            }}), encoding="utf-8")
            report = MODULE.audit_batch_state(path, {"JP-TEST"}, 1991, 1993)
        self.assertEqual(report["expectedTasks"], 3)
        self.assertEqual(report["recordedTasks"], 2)
        self.assertEqual(report["completedTasks"], 1)
        self.assertEqual(report["failedTasks"], 1)
        self.assertEqual(report["pendingOrMissingTasks"], 1)
        self.assertEqual(report["missingTaskIds"], ["JP-TEST-1993"])
        self.assertEqual(report["unexpectedTaskIds"], ["JP-TEST-1994", "UNKNOWN-1991"])

    def test_missing_batch_state_is_not_reported_as_success(self):
        from pathlib import Path
        report = MODULE.audit_batch_state(Path("/definitely/missing/batch-state.json"), {"JP-TEST"}, 1991, 1992)
        self.assertEqual(report["status"], "batch-state-not-provided")
        self.assertEqual(report["completedTasks"], 0)
        self.assertEqual(report["pendingOrMissingTasks"], 2)

    def test_empty_region_is_not_eligible(self):
        qa = MODULE.audit_climate_windows([], 1991, 2020)
        self.assertEqual(qa["metricReadiness"]["precipitationMm"]["usableCalendarDays"], 0)


if __name__ == "__main__":
    unittest.main()
