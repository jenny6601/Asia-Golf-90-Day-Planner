import unittest
from scripts.score_ghcnd_daily_record_quality import build_report, classify_station, TOTAL_DAYS

def coverage(valid, years, flagged=0):
    return {"validDays": valid, "flaggedDays": flagged,
            "missingDays": TOTAL_DAYS-valid-flagged,
            "yearsAtLeast80Pct": years}

class GHCNDailyQualityTests(unittest.TestCase):
    def test_robust_requires_all_three_elements(self):
        item = {e: coverage( int(TOTAL_DAYS*.95), 27) for e in ("PRCP","TMAX","TMIN")}
        tier, pct, years = classify_station(item)
        self.assertEqual(tier, "robust")

    def test_missing_tmin_downgrades_station(self):
        item = {e: coverage(int(TOTAL_DAYS*.95), 27) for e in ("PRCP","TMAX","TMIN")}
        item["TMIN"] = coverage(0, 0)
        self.assertEqual(classify_station(item)[0], "unusable")

    def test_partial_records_are_limited_not_approved(self):
        item = {e: coverage(int(TOTAL_DAYS*.65), 15) for e in ("PRCP","TMAX","TMIN")}
        self.assertEqual(classify_station(item)[0], "limited")

    def test_report_never_approves_or_enables_ingestion(self):
        elements = {e: coverage(int(TOTAL_DAYS*.85), 23) for e in ("PRCP","TMAX","TMIN")}
        audit = {"stations": [{
            "countryCode":"JP","subregionId":"JP-TEST","stationId":"TEST001",
            "name":"TEST","distanceKm":12.3,"elementCoverage":elements
        }]}
        report = build_report(audit)
        self.assertEqual(report["summary"]["regionsWithAcceptableCandidate"], 1)
        self.assertEqual(report["summary"]["approvedStations"], 0)
        self.assertFalse(report["stations"][0]["stationApproved"])
        self.assertFalse(report["stations"][0]["weatherIngestionEnabled"])

if __name__ == "__main__":
    unittest.main()
