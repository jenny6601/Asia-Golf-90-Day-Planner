import unittest
from datetime import date
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "export_regional_climate_evidence", ROOT / "scripts/export_regional_climate_evidence.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def metric(status="usable", years=30, mean=2.0, median=1.0, p90=8.0, wet=40.0):
    result = {"status": status, "validYears": years, "mean": mean, "median": median, "p90": p90}
    if wet is not None:
        result["wetDayFrequencyPct"] = wet
    return result


def climate_fixture():
    calendar = []
    for key in ("02-28", "03-01", "06-15"):
        calendar.append({
            "targetMonthDay": key,
            "metrics": {
                "precipitationMm": metric(mean=2.5, wet=42.0),
                "temperatureMinC": metric(mean=12.0),
                "temperatureMaxC": metric(mean=21.0),
                "temperatureMeanC": metric(mean=16.0),
                "relativeHumidityMeanPct": metric(mean=65.0),
                "windSpeedMeanMs": metric(mean=2.5),
            }
        })
    return {
        "sourceId": "ERA5_LAND_HOURLY_TIMESERIES",
        "dataset": "reanalysis-era5-land-timeseries",
        "referencePeriod": [1991, 2020],
        "timezone": "Asia/Tokyo",
        "climateBaselineEnabled": False,
        "forecastEnabled": False,
        "regions": {"JP-TEST": {
            "representativeCourseId": "test-course",
            "latitude": 36.7, "longitude": 140.0,
            "dailyCalendar": calendar
        }}
    }


class ExportRegionalClimateEvidenceTests(unittest.TestCase):
    def test_exports_standard_historical_fields_without_activation(self):
        result = MODULE.export_evidence(climate_fixture(), date(2026, 6, 15), 1)
        region = result["regions"]["JP-TEST"]
        row = region["records"][0]
        self.assertEqual(row["rainFrequency"], 42.0)
        self.assertEqual(row["rainMean"], 2.5)
        self.assertEqual(row["highMean"], 21.0)
        self.assertEqual(row["lowMean"], 12.0)
        self.assertEqual(row["rainSampleYears"], 30)
        self.assertFalse(row["decisionUseEligible"])
        self.assertFalse(result["climateBaselineEnabled"])
        self.assertFalse(result["forecastEnabled"])

    def test_insufficient_metric_remains_null(self):
        payload = climate_fixture()
        payload["regions"]["JP-TEST"]["dailyCalendar"][2]["metrics"]["precipitationMm"] = metric(
            status="insufficient-history", years=30, mean=2.0, median=1.0, p90=8.0, wet=40.0
        )
        row = MODULE.export_evidence(payload, date(2026, 6, 15), 1)["regions"]["JP-TEST"]["records"][0]
        self.assertIsNone(row["rainFrequency"])
        self.assertIsNone(row["rainMean"])
        self.assertEqual(row["rainSampleYears"], 30)
        self.assertEqual(row["sampleYears"], 12)

    def test_february_29_uses_midpoint_but_withholds_percentiles(self):
        row = MODULE.export_evidence(climate_fixture(), date(2028, 2, 29), 1)["regions"]["JP-TEST"]["records"][0]
        self.assertEqual(row["calendarMappedFrom"], "02-28|03-01")
        self.assertEqual(row["rainFrequency"], 42.0)
        self.assertEqual(row["rainMean"], 2.5)
        self.assertIsNone(row["rainP90"])

    def test_rejects_activated_or_wrong_source_input(self):
        payload = climate_fixture()
        payload["climateBaselineEnabled"] = True
        with self.assertRaises(ValueError):
            MODULE.export_evidence(payload, date(2026, 6, 15), 1)
        payload = climate_fixture()
        payload["sourceId"] = "OTHER"
        with self.assertRaises(ValueError):
            MODULE.export_evidence(payload, date(2026, 6, 15), 1)

    def test_exports_all_dates_for_each_subregion(self):
        result = MODULE.export_evidence(climate_fixture(), date(2026, 6, 14), 3)
        rows = result["regions"]["JP-TEST"]["records"]
        self.assertEqual([r["date"] for r in rows], ["2026-06-14", "2026-06-15", "2026-06-16"])
        self.assertEqual(result["regions"]["JP-TEST"]["usableRainDays"], 1)


if __name__ == "__main__":
    unittest.main()
