import unittest
from datetime import date, datetime, timezone, timedelta
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("inspect_era5_land_pilot", ROOT / "scripts/inspect_era5_land_pilot.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class Era5LandInspectorTests(unittest.TestCase):
    def test_jst_full_day_bounds_convert_to_utc(self):
        lower, upper = MODULE.expected_utc_bounds(date(1991, 1, 1), date(1991, 1, 1))
        self.assertEqual(lower, datetime(1990, 12, 31, 15, 0))
        self.assertEqual(upper, datetime(1991, 1, 1, 14, 0))

    def test_grid_coordinate_tolerance(self):
        self.assertTrue(MODULE.coordinate_matches(36.7005, 36.7))
        self.assertFalse(MODULE.coordinate_matches(36.702, 36.7))
        self.assertFalse(MODULE.coordinate_matches(float("nan"), 36.7))


if __name__ == "__main__":
    unittest.main()
