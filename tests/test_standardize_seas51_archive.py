import json
import tempfile
import unittest
from pathlib import Path
from scripts.standardize_seas51_archive import normalize_row, standardize, temporal_semantics

BASE = {
    "countryCode": "JP", "courseId": "southern-links",
    "initializationDate": "20160101", "initializationTime": "0",
    "validDate": "20160118", "validTime": "0", "leadHour": "408",
    "ensembleMember": "0", "variable": "2t", "value": "12.5",
    "unit": "degC", "stepType": "instant", "nearestGridDistanceKm": "42.1"
}

class StandardizeSeas51Tests(unittest.TestCase):
    def test_temporal_semantics_mapping_is_explicit(self):
        self.assertEqual(temporal_semantics("instant"), "instantaneous")
        self.assertEqual(temporal_semantics("accum"), "period_accumulation")
        self.assertEqual(temporal_semantics("mystery"), "unknown")

    def test_tp_instant_is_not_relabelled_as_accumulation(self):
        row = {**BASE, "variable": "tp", "unit": "m", "stepType": "instant"}
        record = normalize_row(row)
        self.assertEqual(record["temporalSemantics"], "instantaneous")
        self.assertEqual(record["unit"], "m")
        self.assertEqual(record["qualityStatus"], "unverified")

    def test_unknown_semantics_fails_quality_gate(self):
        with self.assertRaisesRegex(ValueError, "temporalSemantics"):
            normalize_row({**BASE, "stepType": "unknown-mode"})

    def test_standardize_creates_provenance_batch_and_separates_rejections(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            csv_path = root / "extract.csv"
            csv_path.write_text(
                ",".join(BASE.keys()) + "\n" +
                ",".join(str(BASE[key]) for key in BASE) + "\n" +
                ",".join(str({**BASE, "courseId": "bad", "stepType": "unknown-mode"}[key]) for key in BASE) + "\n",
                encoding="utf-8"
            )
            manifest_path = root / "manifest.json"
            manifest_path.write_text(json.dumps({"createdUtc": "2026-11-26T00:00:00+00:00", "input": "pilot.grib"}), encoding="utf-8")
            output_path = root / "batch.json"
            result = standardize(csv_path, manifest_path, output_path)
            self.assertEqual(result["normalizedRecordCount"], 1)
            self.assertEqual(result["rejectedRecordCount"], 1)
            self.assertEqual(result["records"][0]["leadHours"], 408)
            self.assertEqual(result["rawArchive"], "pilot.grib")
            self.assertTrue(output_path.exists())

    def test_initialization_must_be_single_per_batch(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            csv_path = root / "extract.csv"
            second = {**BASE, "initializationDate": "20160102", "validDate": "20160119"}
            csv_path.write_text(
                ",".join(BASE.keys()) + "\n" +
                ",".join(str(BASE[key]) for key in BASE) + "\n" +
                ",".join(str(second[key]) for key in BASE) + "\n",
                encoding="utf-8"
            )
            manifest_path = root / "manifest.json"
            manifest_path.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "exactly one initialization"):
                standardize(csv_path, manifest_path, root / "batch.json")

if __name__ == "__main__":
    unittest.main()
