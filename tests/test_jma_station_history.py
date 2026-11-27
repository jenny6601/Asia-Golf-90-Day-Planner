import unittest
from scripts.audit_jma_station_history import parse_index4, audit_candidate, build_report

def row(sid="47412", start="1991-01-01", end="2020-12-31", p="1", t="1", pc="0", tc="0", old=None):
    x = [""] * 33
    x[0] = sid; x[1] = "札幌"; x[3] = "SAPPORO"
    x[7] = "43.050"; x[8] = "141.330"; x[9] = "17"
    x[16] = p; x[18] = t; x[23] = start; x[24] = end
    x[25] = old or sid; x[26] = pc; x[28] = tc
    return ",".join(x)

class JmaStationHistoryTests(unittest.TestCase):
    def test_parses_official_33_field_history_rows(self):
        data = parse_index4(row())
        self.assertEqual(len(data["47412"]), 1)
        self.assertEqual(data["47412"][0]["nameJa"], "札幌")
        self.assertEqual(data["47412"][0]["latitude"], "43.050")
        self.assertEqual(data["47412"][0]["longitude"], "141.330")
        self.assertEqual(data["47412"][0]["elevationM"], "17")
        self.assertTrue(data["47412"][0]["temperatureAvailable"])

    def test_counts_coverage_and_continuity_breaks_separately(self):
        data = parse_index4("\n".join([
            row(start="1991-01-01", end="2000-12-31", pc="1", tc="1"),
            row(start="2001-01-01", end="2020-12-31", pc="1", tc="1", old="47412")
        ]))
        result = audit_candidate({"stationId":"47412","historySegments":[]}, data)
        self.assertEqual(result["officialPrecipitationCoverageDays"], 10958)
        self.assertEqual(result["precipitationStatisticalBreakCount"], 1)
        self.assertEqual(result["temperatureStatisticalBreakCount"], 1)

    def test_missing_station_is_not_approved(self):
        result = audit_candidate({"stationId":"99999"}, {})
        self.assertFalse(result["officialHistoryMatch"])
        self.assertFalse(result["stationApproved"])
        self.assertEqual(result["officialPrecipitationCoverageDays"], 0)


    def test_initial_station_start_codes_are_not_counted_as_breaks(self):
        data = parse_index4(row(pc="1", tc="1"))
        result = audit_candidate({"stationId":"47412"}, data)
        self.assertEqual(result["precipitationStatisticalBreakCount"], 0)
        self.assertEqual(result["temperatureStatisticalBreakCount"], 0)

    def test_temperature_code_four_is_adjusted_continuity_not_cut(self):
        data = parse_index4(row(tc="4"))
        result = audit_candidate({"stationId":"47412"}, data)
        self.assertEqual(result["temperatureAdjustedContinuityCount"], 1)
        self.assertEqual(result["temperatureStatisticalBreakCount"], 0)


    def test_open_ended_station_after_normal_period_is_valid_history(self):
        data = parse_index4(row(start="2021-03-18", end="9999-99-99"))
        result = audit_candidate({"stationId":"47412"}, data)
        self.assertTrue(result["officialHistoryMatch"])
        self.assertEqual(result["officialPrecipitationCoverageDays"], 0)
        self.assertEqual(result["officialTemperatureCoverageDays"], 0)

    def test_unknown_codes_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "unknown temperature continuity"):
            parse_index4(row(tc="9"))

    def test_rejects_bad_field_count(self):
        with self.assertRaisesRegex(ValueError, "expected 33"):
            parse_index4("47412,only,two")

if __name__ == "__main__":
    unittest.main()
