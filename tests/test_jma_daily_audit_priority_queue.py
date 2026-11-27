import unittest
from scripts.build_jma_daily_audit_priority_queue import build_queue

def candidate(sid, coverage=100, breaks=0, distance=20, matched=True):
    return {
        "stationId": sid, "officialNameJa": sid, "candidateDistanceKm": distance,
        "officialHistoryMatch": matched, "officialPrecipitationMetadataCoveragePct": coverage,
        "officialTemperatureMetadataCoveragePct": coverage,
        "precipitationStatisticalBreakCount": breaks, "temperatureStatisticalBreakCount": breaks,
        "mirrorHistoryIntervalMismatch": False
    }

class JmaDailyAuditQueueTests(unittest.TestCase):
    def test_ranks_full_metadata_before_partial_and_distance(self):
        report = {"period":{"start":"1991-01-01","end":"2020-12-31"},
                  "regions":[{"subregionId":"JP-A","candidates":[
                      candidate("far",100,0,90), candidate("near-partial",80,0,1),
                      candidate("near-break",100,1,2), candidate("near-full",100,0,5)
                  ]}]}
        q = build_queue(report, 3)
        ids = [x["stationId"] for x in q["regions"][0]["priorityStations"]]
        self.assertEqual(ids, ["near-full","far","near-break"])

    def test_deduplicates_station_ids_across_regions(self):
        report = {"regions":[
            {"subregionId":"JP-A","candidates":[candidate("shared"),candidate("a2")]},
            {"subregionId":"JP-B","candidates":[candidate("shared"),candidate("b2")]}
        ]}
        q = build_queue(report, 2)
        self.assertEqual(len(q["uniqueStationQueue"]), 3)
        shared = next(x for x in q["uniqueStationQueue"] if x["stationId"] == "shared")
        self.assertEqual(shared["assignedSubregions"], ["JP-A","JP-B"])

    def test_unmatched_station_ranks_after_matched(self):
        report = {"regions":[{"subregionId":"JP-A","candidates":[
            candidate("unmatched",100,0,1,False), candidate("matched",80,0,50,True)
        ]}]}
        q = build_queue(report, 2)
        self.assertEqual(q["regions"][0]["primaryStationId"], "matched")

    def test_queue_never_approves_or_verifies_daily_data(self):
        q = build_queue({"regions":[{"subregionId":"JP-A","candidates":[candidate("one")]}]})
        self.assertEqual(q["summary"]["dailyDataVerifiedStations"], 0)
        self.assertFalse(q["uniqueStationQueue"][0]["stationApproved"])

if __name__ == "__main__":
    unittest.main()
