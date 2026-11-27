import unittest
from scripts.discover_jma_station_candidates import parse_stations, build_candidates

CSV="""Station Number,Station Name(Kanji),Station Name(Kana),Station Name,Latitude_Precipitation(degree),Longitude_Precipitation(degree),Altitude_Precipitation(m),Precipitation,Temperature,Start Date,End Date
12345,Test,TEST,TEST,43.1,141.2,20,1,1,1980-01-01,9999-99-99
12346,NoTemp,NO,NO,43.2,141.3,20,1,0,1980-01-01,9999-99-99
12347,Old,OLD,OLD,43.2,141.3,20,1,1,1950-01-01,1980-01-01
"""
class JmaCandidateTests(unittest.TestCase):
 def test_capability_and_period_filter(self):
  s=parse_stations(CSV)
  self.assertEqual([x["stationId"] for x in s],["12345"])
 def test_candidates_are_never_approved(self):
  q={"queue":[{"countryCode":"JP","subregionId":"JP-X","subregionLabel":"X","latitude":43.1,"longitude":141.2,"searchRadiusKm":100}]}
  r=build_candidates(q,parse_stations(CSV))
  self.assertEqual(r["summary"]["regionsWithCandidates"],1)
  self.assertFalse(r["regions"][0]["stationApproved"])
  self.assertFalse(r["regions"][0]["weatherIngestionEnabled"])
if __name__=="__main__": unittest.main()
