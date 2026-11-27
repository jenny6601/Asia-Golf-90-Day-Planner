import importlib.util,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("ghcnd_discovery",ROOT/"scripts/discover_ghcnd_station_candidates.py")
M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)
class GhcnStationDiscoveryTests(unittest.TestCase):
 def test_country_mapping_uses_noaa_country_codes(self):
  self.assertEqual(M.country_codes({"JA":"Japan","KS":"Korea, South","CH":"China","VM":"Vietnam","TH":"Thailand","MY":"Malaysia","SN":"Singapore","ID":"Indonesia"}),{"JP":"JA","KR":"KS","CN":"CH","VN":"VM","TH":"TH","MY":"MY","SG":"SN","ID":"ID"})
 def test_inventory_overlap_is_element_specific(self):
  raw="USC00000001"+" "*20+"PRCP"+" 1980 2020\n"
  parsed=M.parse_inventory(raw)
  self.assertEqual(parsed["USC00000001"]["PRCP"]["overlap1991_2020Years"],30)
 def test_nearest_candidates_are_not_auto_selected(self):
  points=[{"countryCode":"JP","subregionId":"JP-X","representativePoint":{"latitude":35.0,"longitude":139.0}}]
  stations={"JAA00000001":{"stationId":"JAA00000001","countryCode":"JA","latitude":35.1,"longitude":139.1,"elevationM":10,"name":"A","gsnFlag":None,"hcnFlag":None,"wmoId":None}}
  inv={"JAA00000001":{e:{"startYear":1980,"endYear":2020,"overlap1991_2020Years":30} for e in ("PRCP","TMAX","TMIN")}}
  out=M.build_candidates(points,{"JA":"Japan","KS":"South Korea","CH":"China","VM":"Vietnam","TH":"Thailand","MY":"Malaysia","SN":"Singapore","ID":"Indonesia"},stations,inv)
  self.assertEqual(out["summary"]["regionsWithCandidates"],1)
  self.assertFalse(out["regions"][0]["nearestCandidates"][0]["autoSelected"])
  self.assertEqual(out["regions"][0]["nearestCandidates"][0]["elements"]["PRCP"]["overlap1991_2020Years"],30)
  self.assertTrue(out["regions"][0]["nearestCandidates"][0]["requiredClimateElementsPresent"])
  self.assertEqual(out["summary"]["regionsWithCompleteCandidateWithin75Km"],1)
  self.assertEqual(out["regions"][0]["status"],"candidate-ready-for-record-level-quality-review")
if __name__=="__main__":unittest.main()
