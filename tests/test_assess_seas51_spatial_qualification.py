import json
import tempfile
import unittest
from pathlib import Path
from scripts.assess_seas51_spatial_qualification import assess

def fixtures(root, distance=20, coordinate_status="verified", failure=None, skipped=None):
    batch={"batchId":"pilot","dataset":"seasonal-original-single-levels","model":"ECMWF-SEAS5.1",
           "requestScope":{"initializationTimes":["2016-01-01T00:00:00Z"]},
           "records":[{"courseId":"course-a","nearestGridDistanceKm":distance},
                      {"courseId":"course-a","nearestGridDistanceKm":distance}]}
    manifest={"coursesUsed":[{"id":"course-a","coordinateStatus":coordinate_status}],
              "spatialFailuresByCourse":failure or {},
              "coursesSkippedMissingCoordinates":skipped or []}
    bp=root/"batch.json"; mp=root/"manifest.json"
    bp.write_text(json.dumps(batch),encoding="utf-8")
    mp.write_text(json.dumps(manifest),encoding="utf-8")
    return bp,mp

class SpatialQualificationTests(unittest.TestCase):
    def test_verified_coordinates_are_usable(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d))
            self.assertEqual(assess(bp,mp)["status"],"regional-proxy-usable")

    def test_far_grid_points_are_retained_and_only_advisory(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d),distance=48.6)
            report=assess(bp,mp)
            self.assertEqual(report["recordCount"],2)
            self.assertEqual(report["overAdvisoryDistanceCount"],2)
            self.assertEqual(report["status"],"regional-proxy-usable-with-advisory-review")

    def test_provisional_coordinates_are_usable_with_label(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d),coordinate_status="provisional")
            report=assess(bp,mp)
            self.assertEqual(report["status"],"regional-proxy-usable-with-advisory-review")
            self.assertEqual(report["courses"][0]["spatialStatus"],"coordinate-provisional-use-as-regional-proxy")

    def test_out_of_area_course_failure_is_a_coverage_gap(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d),failure={"course-b":{"count":25}})
            self.assertEqual(assess(bp,mp)["status"],"regional-proxy-usable-with-coverage-gaps")

    def test_missing_coordinate_courses_are_reported_as_gap(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d),skipped=["course-c"])
            report=assess(bp,mp)
            self.assertEqual(report["coursesSkippedMissingCoordinates"],["course-c"])
            self.assertEqual(report["status"],"regional-proxy-usable-with-coverage-gaps")

if __name__ == "__main__":
    unittest.main()
