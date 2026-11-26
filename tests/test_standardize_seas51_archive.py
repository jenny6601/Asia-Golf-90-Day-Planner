import json
import tempfile
import unittest
from pathlib import Path
from scripts.standardize_seas51_archive import normalize_row, standardize, temporal_semantics

BASE = {
    "countryCode":"JP","courseId":"southern-links",
    "initializationDate":"20160101","initializationTime":"0",
    "validDate":"20160118","validTime":"0","leadHour":"408",
    "ensembleMember":"0","variable":"2t","value":"12.5",
    "unit":"degC","stepType":"instant","nearestGridDistanceKm":"42.1"
}

class StandardizeSeas51Tests(unittest.TestCase):
    def test_temporal_semantics_mapping_is_explicit(self):
        self.assertEqual(temporal_semantics("instant"),"instantaneous")
        self.assertEqual(temporal_semantics("accum"),"period_accumulation")
        self.assertEqual(temporal_semantics("mystery"),"unknown")

    def test_tp_instant_is_not_relabelled_as_accumulation(self):
        record=normalize_row({**BASE,"variable":"tp","unit":"m","stepType":"instant"})
        self.assertEqual(record["temporalSemantics"],"instantaneous")
        self.assertEqual(record["unit"],"m")
        self.assertEqual(record["qualityStatus"],"unverified")

    def test_grid_and_course_coordinates_are_preserved_as_regional_metadata(self):
        row={**BASE,"courseLatitude":"26.1","courseLongitude":"127.7",
             "gridLatitude":"26.5","gridLongitude":"127.5",
             "coordinateStatus":"provisional","coordinateSource":"catalog-estimate"}
        record=normalize_row(row)
        self.assertEqual(record["courseLatitude"],26.1)
        self.assertEqual(record["gridLatitude"],26.5)
        self.assertEqual(record["gridLongitude"],127.5)
        self.assertEqual(record["coordinateStatus"],"provisional")
        self.assertEqual(record["coordinateSource"],"catalog-estimate")

    def test_missing_optional_coordinates_remain_null(self):
        record=normalize_row(BASE)
        self.assertIsNone(record["gridLatitude"])
        self.assertEqual(record["coordinateStatus"],"unknown")

    def test_unknown_semantics_fails_quality_gate(self):
        with self.assertRaisesRegex(ValueError,"temporalSemantics"):
            normalize_row({**BASE,"stepType":"unknown-mode"})

    def test_standardize_creates_provenance_batch_and_separates_rejections(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); csv_path=root/"extract.csv"
            csv_path.write_text(",".join(BASE.keys())+"\n"+",".join(str(BASE[k]) for k in BASE)+"\n"+
                ",".join(str({**BASE,"courseId":"bad","stepType":"unknown-mode"}[k]) for k in BASE)+"\n",encoding="utf-8")
            manifest_path=root/"manifest.json"
            manifest_path.write_text(json.dumps({"retrieved_utc":"2026-11-26T00:00:00+00:00","target":"pilot.grib","sha256":"aabbcc","size_bytes":1234}),encoding="utf-8")
            output_path=root/"batch.json"
            result=standardize(csv_path,manifest_path,output_path)
            self.assertEqual(result["normalizedRecordCount"],1)
            self.assertEqual(result["rejectedRecordCount"],1)
            self.assertEqual(result["records"][0]["leadHours"],408)
            self.assertEqual(result["rawArchive"],"pilot.grib")
            self.assertEqual(result["rawSha256"],"aabbcc")
            self.assertEqual(result["rawArchiveSizeBytes"],1234)
            self.assertEqual(result["retrievedAt"],"2026-11-26T00:00:00+00:00")
            self.assertTrue(output_path.exists())

    def test_initialization_must_be_single_per_batch(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); csv_path=root/"extract.csv"
            second={**BASE,"initializationDate":"20160102","validDate":"20160119"}
            csv_path.write_text(",".join(BASE.keys())+"\n"+",".join(str(BASE[k]) for k in BASE)+"\n"+
                ",".join(str(second[k]) for k in BASE)+"\n",encoding="utf-8")
            manifest_path=root/"manifest.json"; manifest_path.write_text("{}",encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"exactly one initialization"):
                standardize(csv_path,manifest_path,root/"batch.json")

if __name__=="__main__": unittest.main()
