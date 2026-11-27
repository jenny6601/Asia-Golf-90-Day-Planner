import unittest
from scripts.audit_jma_obsdl_daily_records import parse_obsdl_csv, audit_station

CSV = """ダウンロードした時刻：2026/11/27 20:00:00
,,札幌,札幌,札幌,札幌,札幌,札幌,札幌,札幌,札幌
年月日,曜日,降水量の合計(mm),降水量の合計(mm),降水量の合計(mm),日最高気温(℃),日最高気温(℃),日最高気温(℃),日最低気温(℃),日最低気温(℃),日最低気温(℃)
,,,,品質情報,均質番号,,品質情報,均質番号,,品質情報,均質番号
1991/1/1,火,0,8,1,2.1,8,1,-3.2,8,1
1991/1/2,水,1.5,5,1,2.0,8,1,-2.0,8,1
1991/1/3,木,,1,1,3.0,8,1,-1.0,8,1
1991/1/4,金,12,4,1,4.0,8,1,-2.0,8,1
1991/1/5,土,,0,1,5.0,8,1,-1.0,8,1
"""

class JmaObsdlAuditTests(unittest.TestCase):
    def test_parses_quality_codes_and_values(self):
        parsed = parse_obsdl_csv(CSV)
        self.assertEqual(parsed["stationName"], "札幌")
        self.assertEqual(parsed["records"]["1991-01-01"]["PRCP"]["quality"], "8")
        self.assertEqual(parsed["records"]["1991-01-02"]["PRCP"]["quality"], "5")
        self.assertEqual(parsed["records"]["1991-01-03"]["PRCP"]["value"], None)

    def test_quality_five_is_not_promoted_to_strict_valid(self):
        parsed = parse_obsdl_csv(CSV)
        result = audit_station("47412", parsed)
        prcp = result["elements"]["PRCP"]
        self.assertEqual(prcp["strictValidDaysQuality8"], 1)
        self.assertEqual(prcp["quasiNormalDaysQuality5"], 1)
        self.assertEqual(prcp["insufficientDaysQuality4"], 1)
        self.assertEqual(prcp["missingDaysQuality1"], 1)
        self.assertEqual(prcp["notObservedDaysQuality0"], 1)
        self.assertFalse(result["stationApproved"])

    def test_rejects_multiple_stations_per_file(self):
        text = CSV.replace("札幌,札幌,札幌,札幌,札幌,札幌", "札幌,札幌,札幌,札幌,札幌,旭川")
        with self.assertRaisesRegex(ValueError, "exactly one station"):
            parse_obsdl_csv(text)

    def test_unknown_quality_code_fails_closed(self):
        text = CSV.replace(",0,8,1,2.1", ",0,9,1,2.1")
        with self.assertRaisesRegex(ValueError, "Unknown JMA quality code"):
            parse_obsdl_csv(text)

    def test_duplicate_dates_fail_closed(self):
        text = CSV + "1991/1/1,火,0,8,1,2.1,8,1,-3.2,8,1\\n"
        with self.assertRaisesRegex(ValueError, "Duplicate date"):
            parse_obsdl_csv(text)

if __name__ == "__main__":
    unittest.main()
