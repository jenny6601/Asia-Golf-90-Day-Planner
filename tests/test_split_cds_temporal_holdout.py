import unittest
from scripts.split_cds_temporal_holdout import chronological_split

def sample(init, valid, course="course-a", member=0):
    return {
        "countryCode": "JP", "courseId": course, "initializationTime": init,
        "validTime": valid, "variable": "2t", "unit": "K",
        "ensembleMember": member, "forecastValue": 1.0, "verificationValue": 1.0,
        "verificationSource": "ERA5-reanalysis-proxy"
    }

class TemporalHoldoutTests(unittest.TestCase):
    def test_chronological_split_and_valid_time_purge(self):
        rows = [
            sample("2016-01-01T00:00:00Z", "2016-01-20T00:00:00Z", member=0),
            sample("2016-01-01T00:00:00Z", "2016-01-20T00:00:00Z", member=1),
            sample("2016-01-02T00:00:00Z", "2016-01-21T00:00:00Z"),
            sample("2016-02-01T00:00:00Z", "2016-02-20T00:00:00Z"),
            sample("2016-02-02T00:00:00Z", "2016-02-21T00:00:00Z"),
        ]
        result = chronological_split(rows, "2016-02-01T00:00:00Z")
        self.assertEqual(result["holdoutCount"], 2)
        self.assertEqual(result["purgedTrainCount"], 0)
        self.assertEqual(result["trainCount"], 3)
        self.assertEqual(result["status"], "ready-for-evaluation")

    def test_overlapping_target_valid_time_is_purged(self):
        rows = [
            sample("2016-01-01T00:00:00Z", "2016-02-20T00:00:00Z"),
            sample("2016-02-01T00:00:00Z", "2016-02-20T00:00:00Z", member=1),
            sample("2016-02-02T00:00:00Z", "2016-02-21T00:00:00Z")
        ]
        result = chronological_split(rows, "2016-02-01T00:00:00Z")
        self.assertEqual(result["purgedTrainCount"], 1)
        self.assertEqual(result["trainCount"], 0)
        self.assertEqual(result["holdoutCount"], 2)
        self.assertEqual(result["status"], "insufficient-split-samples")

    def test_different_course_does_not_cross_purge(self):
        rows = [
            sample("2016-01-01T00:00:00Z", "2016-02-20T00:00:00Z", course="course-a"),
            sample("2016-02-01T00:00:00Z", "2016-02-20T00:00:00Z", course="course-b")
        ]
        result = chronological_split(rows, "2016-02-01T00:00:00Z")
        self.assertEqual(result["purgedTrainCount"], 0)
        self.assertEqual(result["trainCount"], 1)

    def test_timezone_naive_timestamps_are_rejected(self):
        rows = [sample("2016-01-01T00:00:00", "2016-01-20T00:00:00Z")]
        result = chronological_split(rows, "2016-02-01T00:00:00Z")
        self.assertEqual(result["invalidCount"], 1)
        self.assertEqual(result["trainCount"], 0)

    def test_invalid_cutoff_is_rejected(self):
        with self.assertRaises(ValueError):
            chronological_split([], "2016-02-01")

if __name__ == "__main__":
    unittest.main()
