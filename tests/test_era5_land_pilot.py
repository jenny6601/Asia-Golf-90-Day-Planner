import json
import unittest
from datetime import date
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("era5_land_pilot", ROOT / "scripts/era5_land_pilot.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class Era5LandPilotTests(unittest.TestCase):
    def test_mapping_has_37_unique_japan_regions(self):
        mapping = MODULE.load_mapping()
        ids = {p["subregionId"] for p in mapping["points"]}
        self.assertEqual(mapping["subregionCount"], 37)
        self.assertEqual(len(ids), 37)
        self.assertEqual(sum(x.startswith("JP-OKI-") for x in ids), 5)
        self.assertEqual(sum(not x.startswith("JP-OKI-") for x in ids), 32)

    def test_request_uses_cds_timeseries_and_five_required_variables(self):
        mapping = MODULE.load_mapping()
        point = next(p for p in mapping["points"] if p["subregionId"] == "JP-KNT-TOCHIGI-NASU")
        request = MODULE.build_request(point, date(1991, 1, 1), date(1991, 12, 31))
        self.assertEqual(request["location"]["latitude"], 36.709629)
        self.assertEqual(request["location"]["longitude"], 140.004827)
        self.assertEqual(request["date"], "1990-12-31/1992-01-01")
        self.assertEqual(request["data_format"], "netcdf")
        self.assertEqual(len(request["variable"]), 5)
        self.assertIn("total_precipitation", request["variable"])

    def test_rejects_reversed_dates(self):
        mapping = MODULE.load_mapping()
        with self.assertRaises(ValueError):
            MODULE.build_request(mapping["points"][0], date(1992, 1, 1), date(1991, 1, 1))


if __name__ == "__main__":
    unittest.main()
