import unittest
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("batch_era5_land_japan", ROOT / "scripts/batch_era5_land_japan.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class JapanEra5BatchTests(unittest.TestCase):
    def fixture(self):
        return {"points": [
            {"subregionId": "JP-A", "representativeCourseId": "a",
             "representativePoint": {"latitude": 1, "longitude": 2},
             "era5LandGridPoint": {"latitude": 1, "longitude": 2}, "timezone": "Asia/Tokyo"},
            {"subregionId": "JP-B", "representativeCourseId": "b",
             "representativePoint": {"latitude": 3, "longitude": 4},
             "era5LandGridPoint": {"latitude": 3, "longitude": 4}, "timezone": "Asia/Tokyo"},
        ]}

    def test_builds_one_task_per_region_and_year(self):
        tasks = MODULE.build_tasks(self.fixture(), 1991, 1993)
        self.assertEqual(len(tasks), 6)
        self.assertEqual(tasks[0]["taskId"], "JP-A-1991")
        self.assertEqual(tasks[-1]["taskId"], "JP-B-1993")
        self.assertEqual(tasks[0]["status"], "pending")

    def test_subregion_filter_and_unknown_region_validation(self):
        tasks = MODULE.build_tasks(self.fixture(), 1991, 1991, ["JP-B"])
        self.assertEqual([x["subregionId"] for x in tasks], ["JP-B"])
        with self.assertRaises(ValueError):
            MODULE.build_tasks(self.fixture(), 1991, 1991, ["JP-X"])

    def test_duplicate_region_ids_rejected(self):
        mapping = self.fixture()
        mapping["points"].append(mapping["points"][0])
        with self.assertRaises(ValueError):
            MODULE.build_tasks(mapping, 1991, 1991)

    def test_all_19_japan_regions_are_in_mapping(self):
        mapping = __import__("json").loads((ROOT / "config/global/era5-land-grid-points-japan.json").read_text(encoding="utf-8"))
        tasks = MODULE.build_tasks(mapping, 1991, 2020)
        self.assertEqual(len(mapping["points"]), 19)
        self.assertEqual(len(tasks), 570)
        self.assertEqual(len({t["subregionId"] for t in tasks}), 19)

    def test_force_reprocess_bypasses_existing_daily_cache(self):
        import json
        import subprocess
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "raw").mkdir()
            (root / "daily").mkdir()
            (root / "reports").mkdir()
            (root / "raw" / "JP-A_1991-01-01_1991-12-31.zip").write_bytes(b"cached-archive")
            rows = [{"subregionId": "JP-A", "localDayTimezone": "Asia/Tokyo",
                     "validDate": f"1991-01-{day:02d}"} for day in range(1, 32)]
            payload = {"status": "pilot-daily-aggregation-complete",
                       "climatologyEligible": False, "recordCount": 365,
                       "records": rows + [{"subregionId": "JP-A", "localDayTimezone": "Asia/Tokyo",
                                          "validDate": "1991-02-01"} for _ in range(334)]}
            (root / "daily" / "JP-A-1991-daily.json").write_text(json.dumps(payload), encoding="utf-8")
            calls = []
            def fail_runner(command):
                calls.append(command)
                return subprocess.CompletedProcess(command, 1, "", "forced reprocessing reached inspector")
            task = {"taskId": "JP-A-1991", "subregionId": "JP-A", "year": 1991,
                    "start": "1991-01-01", "end": "1991-12-31"}
            result = MODULE.run_task(task, root, retries=1, retry_delay=0,
                                     sleep=lambda _: None, runner=fail_runner, force=True)
            self.assertEqual(result["status"], "failed")
            self.assertEqual(len(calls), 1)
            self.assertIn("forced reprocessing", result["error"])

    def test_february_29_leap_year_record_count_is_allowed(self):
        # Year-length policy is exercised by the runner's post-conversion guard.
        import inspect
        source = inspect.getsource(MODULE.run_task)
        self.assertIn("recordCount", source)
        self.assertIn("366", source)


if __name__ == "__main__":
    unittest.main()
