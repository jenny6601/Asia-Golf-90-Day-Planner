import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("normalize_jma_obsdl_csv", ROOT / "scripts/normalize_jma_obsdl_csv.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class JmaObsdlCsvTests(unittest.TestCase):
    def test_parses_daily_numeric_export_and_keeps_raw_values(self):
        csv_text = "気象庁,過去の気象データ\n年月日,降水量の合計(mm),最高気温(℃),最低気温(℃)\n1991/01/01,0.0,8.2,-1.1\n1991/01/02,///,9.0,0.1\n"
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "jma.csv"
            path.write_text(csv_text, encoding="utf-8-sig")
            result = MODULE.normalize_csv(path, "41141", "大田原", 36.84, 140.035, "JP-KNT-NORTH", 1991)
        self.assertEqual(len(result["station"]["records"]), 2)
        self.assertEqual(result["station"]["records"][0]["precipitationMm"], 0.0)
        self.assertIsNone(result["station"]["records"][1]["precipitationMm"])
        self.assertEqual(result["station"]["records"][1]["sourceRawValues"]["precipitationMm"], "///")
        self.assertEqual(result["qualityPolicy"]["status"], "raw-quality-not-yet-interpreted")

    def test_rejects_duplicate_dates(self):
        csv_text = "年月日,降水量の合計(mm),最高気温(℃),最低気温(℃)\n1991/01/01,0,8,-1\n1991/01/01,1,9,0\n"
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "jma.csv"
            path.write_text(csv_text, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Duplicate daily date"):
                MODULE.normalize_csv(path, "41141", "大田原", 36.84, 140.035, "JP-KNT-NORTH", 1991)

    def test_rejects_missing_required_element(self):
        csv_text = "年月日,降水量の合計(mm),最高気温(℃)\n1991/01/01,0,8\n"
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "jma.csv"
            path.write_text(csv_text, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "missing required daily columns"):
                MODULE.normalize_csv(path, "41141", "大田原", 36.84, 140.035, "JP-KNT-NORTH", 1991)


if __name__ == "__main__":
    unittest.main()
