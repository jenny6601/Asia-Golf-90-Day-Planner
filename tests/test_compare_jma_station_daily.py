import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("compare_jma_station_daily", ROOT / "scripts/compare_jma_station_daily.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class JmaCrosscheckTests(unittest.TestCase):
    def test_haversine_zero_distance(self):
        p = {"latitude": 35.0, "longitude": 139.0}
        self.assertAlmostEqual(MODULE.haversine_km(p, p), 0.0)

    def test_rainfall_bias_and_wet_day_contingency(self):
        region = {"subregionId": "JP-TEST", "representativePoint": {"latitude": 35, "longitude": 139}}
        era5 = [
            {"validDate": f"1991-01-0{i}", "sourceId": MODULE.ERA5_SOURCE, "validHourCount": 24, "qualityFlags": [], "precipitationMm": rain, "temperatureMinC": 5, "temperatureMaxC": 12}
            for i, rain in enumerate([0, 2, 3], 1)
        ]
        station = {
            "sourceId": MODULE.JMA_SOURCE, "qualityPolicyStatus": "validated", "stationId": "TEST", "name": "Test Station",
            "latitude": 35, "longitude": 139,
            "records": [
                {"validDate": f"1991-01-0{i}", "precipitationMm": rain, "temperatureMinC": 4, "temperatureMaxC": 10,
                 "jmaQualityCodes": {"precipitationMm": 8, "temperatureMinC": 8, "temperatureMaxC": 8},
                 "jmaHomogeneityNumbers": {"precipitationMm": "1", "temperatureMinC": "1", "temperatureMaxC": "1"}}
                for i, rain in enumerate([0, 1, 5], 1)
            ]
        }
        result = MODULE.compare_region(region, era5, station, minimum_pairs=3)
        self.assertEqual(result["rainfall"]["biasEra5MinusJma"], -0.333)
        self.assertEqual(result["wetDayContingencyAt1mm"]["hit"], 2)
        self.assertEqual(result["status"], "paired-comparison-available")


    def test_excludes_non_normal_jma_quality_and_flags_homogeneity_break(self):
        region = {"subregionId": "JP-TEST", "representativePoint": {"latitude": 35, "longitude": 139}}
        era5 = [{"validDate": "1991-01-01", "sourceId": MODULE.ERA5_SOURCE, "validHourCount": 24,
                 "qualityFlags": [], "precipitationMm": 1, "temperatureMinC": 4, "temperatureMaxC": 10}]
        station = {"sourceId": MODULE.JMA_SOURCE, "qualityPolicyStatus": "validated", "stationId": "TEST",
                   "latitude": 35, "longitude": 139,
                   "records": [{"validDate": "1991-01-01", "precipitationMm": 1, "temperatureMinC": 4, "temperatureMaxC": 10,
                                "jmaQualityCodes": {"precipitationMm": 5, "temperatureMinC": 8, "temperatureMaxC": 8},
                                "jmaHomogeneityNumbers": {"precipitationMm": "1", "temperatureMinC": "1", "temperatureMaxC": "1"}},
                               {"validDate": "1991-01-02", "jmaHomogeneityNumbers": {"precipitationMm": "2"}}]}
        result = MODULE.compare_region(region, era5, station, minimum_pairs=1)
        self.assertEqual(result["pairedDays"], 0)
        self.assertEqual(result["jmaQualityRejectedDays"], 1)
        self.assertIn("jma_homogeneity_number_changes_within_period", result["issues"])
\n    def test_distance_and_insufficient_pairs_block_comparison_status(self):
        region = {"subregionId": "JP-TEST", "representativePoint": {"latitude": 35, "longitude": 139}}
        station = {"sourceId": MODULE.JMA_SOURCE, "stationId": "FAR", "latitude": 36, "longitude": 140, "records": []}
        result = MODULE.compare_region(region, [], station, max_distance_km=10, minimum_pairs=1)
        self.assertEqual(result["status"], "comparison-limited")
        self.assertIn("station_outside_maximum_distance", result["issues"])
        self.assertIn("insufficient_paired_rain_days", result["issues"])


if __name__ == "__main__":
    unittest.main()
