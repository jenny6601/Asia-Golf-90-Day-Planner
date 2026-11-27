import unittest
from scripts.discover_kma_asos_candidates import parse_inventory, parse_asos_day_catalog, rank_candidates

CSV = """지점번호,지점명,시작일,종료일,위도,경도,노장 해발고도(m),지점유형
101,춘천,1980-01-01,,37.9,127.7,75,ASOS
102,인근AWS,1980-01-01,,37.8,127.6,80,AWS
101,춘천이전,1991-01-01,2000-12-31,37.91,127.71,76,ASOS
103,먼곳,1991-01-01,,35.0,129.0,10,ASOS
"""

CATALOG = """filename,description
SURFACE_ASOS_101_DAY_1991_1991_2018.zip,Chuncheon daily
SURFACE_ASOS_101_DAY_1992_1995_2018.zip,Chuncheon daily
SURFACE_ASOS_101_HR_1991_2020_2018.zip,Chuncheon hourly
SURFACE_ASOS_102_DAY_1991_2020_2018.zip,Other station
SURFACE_ASOS_103_DAY_2021_2022_2023.zip,outside period
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
        catalog = parse_asos_day_catalog(CATALOG)
        result = rank_candidates(regions, stations, catalog, top_n=5, radius_km=100)
        rows = result["regions"][0]["candidates"]
        self.assertEqual(rows[0]["stationId"], "101")
        self.assertEqual(rows[0]["historyConfigurations"], 2)
        self.assertEqual(rows[0]["catalogDayYearCount"], 5)
        self.assertEqual(rows[0]["catalogDayYears"], [1991, 1992, 1993, 1994, 1995])
        self.assertFalse(rows[0]["stationApproved"])
        self.assertEqual(result["summary"]["approvedStations"], 0)

    def test_catalog_requires_recognized_filename(self):
        with self.assertRaisesRegex(ValueError, "no recognized SURFACE_ASOS"):
            parse_asos_day_catalog("station,year")

    def test_catalog_without_overlapping_day_archives_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "no DAY archives"):
            parse_asos_day_catalog("SURFACE_ASOS_101_HR_1991_2020_2018.zip")

    def test_metadata_station_without_catalog_is_not_ranked(self):
        stations = parse_inventory(CSV)
        catalog = parse_asos_day_catalog(CATALOG)
        regions = [{"subregionId":"KR-GW-01","subregionLabel":"Gangwon",
                    "latitude":37.9,"longitude":127.7}]
        result = rank_candidates(regions, stations, catalog, top_n=5, radius_km=100)
        self.assertEqual({x["stationId"] for x in result["regions"][0]["candidates"]}, {"101"})

    def test_empty_end_means_current_metadata_period(self):
        stations = parse_inventory(CSV)
        self.assertGreater(stations["101"][0]["overlapDays"], 0)

    def test_unclassified_network_is_excluded(self):
        csv_text = """지점번호,지점명,시작일,종료일,위도,경도,지점유형
201,ASOS명칭누락,1990-01-01,,37.0,127.0,
202,AWS,1990-01-01,,37.1,127.1,AWS
203,종관관측소,1990-01-01,,37.2,127.2,종관기상관측
"""
        stations = parse_inventory(csv_text)
        self.assertEqual(set(stations), {"203"})

    def test_missing_network_column_fails_closed(self):
        csv_text = """지점번호,지점명,시작일,종료일,위도,경도
301,미분류관측소,1990-01-01,,37.0,127.0
"""
        with self.assertRaisesRegex(ValueError, "explicit observation-network/type column"):
            parse_inventory(csv_text)

    def test_device_name_network_alias_is_supported(self):
        csv_text = """지점번호,지점명,시작일,종료일,위도,경도,장비명
401,서울,1990-01-01,,37.5,127.0,ASOS
402,서울AWS,1990-01-01,,37.6,127.1,AWS
"""
        stations = parse_inventory(csv_text)
        self.assertEqual(set(stations), {"401"})

if __name__ == "__main__":
    unittest.main()
