import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_eight_country_climate_registry",
    ROOT / "scripts/build_eight_country_climate_registry.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class EightCountryRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.countries = json.loads((ROOT / "config/global/countries.json").read_text(encoding="utf-8"))
        cls.subregions = json.loads((ROOT / "config/global/weather-subregions.json").read_text(encoding="utf-8"))
        cls.courses = json.loads((ROOT / "config/global/courses.json").read_text(encoding="utf-8"))

    def test_existing_registry_is_compiled_without_fabricating_missing_coordinates(self):
        result = MODULE.compile_registry(self.countries, self.subregions, self.courses)
        self.assertEqual(result["totalSubregions"], 62)
        self.assertEqual(result["readyPointCount"] + result["pendingPointCount"], 62)
        self.assertEqual(result["readyPointCount"], 62)
        self.assertEqual(result["pendingPointCount"], 0)
        self.assertEqual(result["countsByCountry"]["JP"]["readyForAcquisition"], 19)
        self.assertEqual(result["countsByCountry"]["KR"]["readyForAcquisition"], 6)
        self.assertEqual(result["countsByCountry"]["CN"]["readyForAcquisition"], 7)
        self.assertEqual(result["countsByCountry"]["VN"]["readyForAcquisition"], 6)
        self.assertEqual(result["countsByCountry"]["TH"]["readyForAcquisition"], 7)
        self.assertEqual(result["countsByCountry"]["MY"]["readyForAcquisition"], 8)
        self.assertEqual(result["countsByCountry"]["SG"]["readyForAcquisition"], 1)
        self.assertEqual(result["countsByCountry"]["ID"]["readyForAcquisition"], 8)
        self.assertFalse(result["activation"]["climateBaselineEnabled"])

    def test_task_plan_scales_by_year_and_region_and_is_plan_only(self):
        registry = MODULE.compile_registry(self.countries, self.subregions, self.courses)
        plan = MODULE.build_task_plan(registry, 1991, 1993)
        self.assertEqual(plan["readySubregions"], 62)
        self.assertEqual(plan["annualTaskCount"], 186)
        self.assertFalse(plan["safety"]["downloadPerformed"])
        self.assertFalse(plan["safety"]["decisionUseEligible"])

    def test_country_filter_and_unknown_country(self):
        registry = MODULE.compile_registry(self.countries, self.subregions, self.courses)
        plan = MODULE.build_task_plan(registry, 1991, 1991, ["JP"])
        self.assertEqual(plan["annualTaskCount"], 19)
        with self.assertRaises(ValueError):
            MODULE.build_task_plan(registry, 1991, 1991, ["XX"])

    def test_all_62_subregions_have_regional_points_and_valid_timezones(self):
        result = MODULE.compile_registry(self.countries, self.subregions, self.courses)
        pending_ids = {x["subregionId"] for x in result["pendingSubregions"]}
        self.assertEqual(pending_ids, set())
        result_points = {p["subregionId"]: p for p in result["points"]}
        self.assertEqual(len(result_points), 62)
        self.assertEqual(result_points["ID-BALI-01"]["timezone"], "Asia/Makassar")
        self.assertEqual(result_points["ID-KAL-01"]["timezone"], "Asia/Makassar")
        self.assertEqual(result_points["SG-ISLAND-01"]["timezone"], "Asia/Singapore")
        self.assertTrue(all(p.get("subregionId") for p in result["pendingSubregions"]))

    def test_duplicate_subregion_ids_are_rejected(self):
        subregions = json.loads(json.dumps(self.subregions))
        subregions["countries"][1]["subregions"][0]["id"] = subregions["countries"][0]["subregions"][0]["id"]
        with self.assertRaises(ValueError):
            MODULE.compile_registry(self.countries, subregions)


if __name__ == "__main__":
    unittest.main()
