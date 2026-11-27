import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_eight_country_era5land_requests",
    ROOT / "scripts/build_eight_country_era5land_requests.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class EightCountryEra5LandRequestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        countries = json.loads((ROOT / "config/global/countries.json").read_text(encoding="utf-8"))
        subregions = json.loads((ROOT / "config/global/weather-subregions.json").read_text(encoding="utf-8"))
        courses = json.loads((ROOT / "config/global/courses.json").read_text(encoding="utf-8"))
        builder = MODULE._load_registry_builder()
        cls.registry = builder.compile_registry(countries, subregions, courses)

    def test_full_dataset_manifest_covers_all_80_regions(self):
        manifest = MODULE.build_manifest(self.registry)
        self.assertEqual(manifest["dataset"], "reanalysis-era5-land")
        self.assertEqual(manifest["pointCount"], 80)
        self.assertEqual(manifest["pendingSubregionCount"], 0)
        self.assertEqual(manifest["requestCount"], 240)
        self.assertEqual(manifest["requestsPerSubregion"], 3)
        self.assertFalse(manifest["activation"]["downloadPerformed"])
        self.assertFalse(manifest["activation"]["climateBaselineEnabled"])

    def test_each_region_has_core_and_two_utc_boundary_requests(self):
        manifest = MODULE.build_manifest(self.registry)
        by_region = {}
        for request in manifest["requests"]:
            by_region.setdefault(request["subregionId"], []).append(request)
        self.assertEqual(len(by_region), 80)
        for requests in by_region.values():
            self.assertEqual(
                {x["segment"] for x in requests},
                {"core-reference-period", "utc-boundary-before", "utc-boundary-after"},
            )
            self.assertTrue(all(x["dataset"] == "reanalysis-era5-land" for x in requests))

    def test_core_request_uses_full_hourly_dataset_and_expected_variables(self):
        manifest = MODULE.build_manifest(self.registry)
        request = next(x for x in manifest["requests"] if x["subregionId"] == "ID-BALI-01" and x["segment"] == "core-reference-period")
        self.assertEqual(request["timezone"], "Asia/Makassar")
        self.assertEqual(request["request"]["year"], [str(y) for y in range(1991, 2021)])
        self.assertEqual(len(request["request"]["month"]), 12)
        self.assertEqual(len(request["request"]["day"]), 31)
        self.assertEqual(len(request["request"]["time"]), 24)
        self.assertEqual(request["request"]["data_format"], "grib")
        self.assertEqual(request["request"]["download_format"], "zip")
        self.assertEqual(len(request["request"]["variable"]), 5)
        self.assertEqual(request["request"]["area"], [ -8.74, 115.04, -8.86, 115.16 ])

    def test_utc_boundary_days_are_requested_as_separate_small_segments(self):
        manifest = MODULE.build_manifest(self.registry)
        pre = next(x for x in manifest["requests"] if x["subregionId"] == "SG-ISLAND-01" and x["segment"] == "utc-boundary-before")
        post = next(x for x in manifest["requests"] if x["subregionId"] == "SG-ISLAND-01" and x["segment"] == "utc-boundary-after")
        self.assertEqual(pre["request"]["year"], ["1990"])
        self.assertEqual(pre["request"]["month"], ["12"])
        self.assertEqual(pre["request"]["day"], ["31"])
        self.assertEqual(post["request"]["year"], ["2021"])
        self.assertEqual(post["request"]["month"], ["01"])
        self.assertEqual(post["request"]["day"], ["01"])

    def test_invalid_area_padding_and_reversed_years_are_rejected(self):
        point = self.registry["points"][0]
        with self.assertRaises(ValueError):
            MODULE.build_request(point, [1991], ["01"], ["01"], area_padding_degrees=0.1)
        with self.assertRaises(ValueError):
            MODULE.build_manifest(self.registry, 2020, 1991)


if __name__ == "__main__":
    unittest.main()
