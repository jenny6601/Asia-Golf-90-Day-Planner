import unittest
from scripts.discover_kma_asos_candidates import parse_inventory, rank_candidates

CSV = """지점번호,지점명,시작일,종료일,위도,경도,노장 해발고도(m),지점유형
101,춘천,1980-01-01,,37.9,127.7,75,ASOS
102,인근AWS,1980-01-01,,37.8,127.6,80,AWS
101,춘천이전,1991-01-01,2000-12-31,37.91,127.71,76,ASOS
103,먼곳,1991-01-01,,35.0,129.0,10,ASOS
"""

class KMAASOSCandidateTests(unittest.TestCase):
    def test_filters_non_asos_and_groups_station_history(self):
        stations = parse_inventory(CSV)
        self.assertEqual(set(stations), {"101", "103"})
        self.assertEqual(len(stations["101"]), 2)

    def test_metadata_coverage_precedes_distance_and_never_approves(self):
        stations = parse_inventory(CSV)
        regions = [{"subregionId":"KR-GW-01","subregionLabel":"Gangwon",
                    "latitude":37.9,"longitude":127.7}]
        result = rank_candidates(regions, stations, top_n=5, radius_km=100)
        rows = result["regions"][0]["candidates"]
        self.assertEqual(rows[0]["stationId"], "101")
        self.assertEqual(rows[0]["historyConfigurations"], 2)
        self.assertFalse(rows[0]["stationApproved"])
        self.assertEqual(result["summary"]["approvedStations"], 0)

    def test_empty_end_means_current_metadata_period(self):
        stations = parse_inventory(CSV)
        self.assertGreater(stations["101"][0]["overlapDays"], 0)

if __name__ == "__main__":
    unittest.main()
