import json
import tempfile
import unittest
from pathlib import Path
from scripts.inventory_cds_archive_batches import inventory, lead_band

def batch(batch_id, init, member=0, lead=408, distance=42):
    return {
        "batchId": batch_id, "normalizedRecordCount": 1,
        "records": [{
            "dataset": "seasonal-original-single-levels", "model": "ECMWF-SEAS5.1",
            "modelVersion": "System 51", "countryCode": "JP", "courseId": "southern-links",
            "initializationTime": init, "validTime": "2016-01-18T00:00:00Z",
            "leadHours": lead, "ensembleMember": member, "variable": "2t",
            "unit": "K", "temporalSemantics": "instantaneous",
            "spatialMethod": "nearest-grid-point", "nearestGridDistanceKm": distance
        }]
    }

class ArchiveInventoryTests(unittest.TestCase):
    def test_lead_buckets(self):
        self.assertEqual(lead_band(408), "D17-D30")
        self.assertEqual(lead_band(720), "D31-D45")
        self.assertEqual(lead_band(744), "D31-D45")
        self.assertEqual(lead_band(1104), "D46-D60")
        self.assertEqual(lead_band(1464), "D61-D90")

    def test_multiple_initializations_are_counted_separately(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths=[]
            for i, init in enumerate(("2016-01-01T00:00:00Z", "2017-01-01T00:00:00Z")):
                path=Path(tmp)/f"b{i}.json"
                path.write_text(json.dumps(batch(f"batch-{i}", init)), encoding="utf-8")
                paths.append(path)
            report=inventory(paths)
            self.assertEqual(report["readableBatchCount"], 2)
            self.assertEqual(report["totalRecordCount"], 2)
            self.assertEqual(report["coverage"][0]["initializationCount"], 2)
            self.assertEqual(report["coverage"][0]["batchCount"], 2)

    def test_duplicate_batch_and_record_are_flagged_not_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            data=batch("same", "2016-01-01T00:00:00Z")
            paths=[]
            for i in range(2):
                path=Path(tmp)/f"b{i}.json"
                path.write_text(json.dumps(data), encoding="utf-8")
                paths.append(path)
            report=inventory(paths)
            self.assertEqual(report["duplicateBatchIds"], ["same"])
            self.assertEqual(report["duplicateRecordCount"], 1)
            self.assertEqual(report["totalRecordCount"], 2)
            self.assertEqual(report["status"], "inventory-review-required")

    def test_missing_manifest_count_is_not_fabricated(self):
        with tempfile.TemporaryDirectory() as tmp:
            data=batch("batch-a", "2016-01-01T00:00:00Z")
            del data["normalizedRecordCount"]
            path=Path(tmp)/"b.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            report=inventory([path])
            self.assertEqual(report["invalidItems"], [])

    def test_distance_over_35km_is_counted_for_review_not_dropped(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"b.json"
            path.write_text(json.dumps(batch("batch-a", "2016-01-01T00:00:00Z", distance=48.6)), encoding="utf-8")
            report=inventory([path])
            self.assertEqual(report["totalRecordCount"], 1)
            self.assertEqual(report["spatialDistanceCounts"]["over_35km"], 1)

if __name__ == "__main__":
    unittest.main()
