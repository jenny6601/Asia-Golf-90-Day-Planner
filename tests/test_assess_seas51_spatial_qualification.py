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
    def test_verified_coordinates_and_distances_pass(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d))
            self.assertEqual(assess(bp,mp)["status"],"spatially-qualified-for-next-verification-gate")

    def test_far_grid_points_are_retained_but_fail_gate(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d),distance=48.6)
            report=assess(bp,mp)
            self.assertEqual(report["recordCount"],2)
            self.assertEqual(report["overThresholdCount"],2)
            self.assertEqual(report["status"],"spatially-not-qualified")

    def test_provisional_coordinates_fail_gate(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d),coordinate_status="provisional")
            self.assertEqual(assess(bp,mp)["status"],"spatially-not-qualified")

    def test_out_of_area_course_failure_fails_gate(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d),failure={"course-b":{"count":25}})
            self.assertEqual(assess(bp,mp)["status"],"spatially-not-qualified")

    def test_missing_coordinate_courses_are_reported(self):
        with tempfile.TemporaryDirectory() as d:
            bp,mp=fixtures(Path(d),skipped=["course-c"])
            self.assertEqual(assess(bp,mp)["coursesSkippedMissingCoordinates"],["course-c"])
            self.assertEqual(assess(bp,mp)["status"],"spatially-not-qualified")

if __name__ == "__main__":
    unittest.main()
