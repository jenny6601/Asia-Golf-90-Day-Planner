import importlib.util,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("metmalaysia_candidates",ROOT/"scripts/discover_metmalaysia_station_candidates.py")
M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)
class MetMalaysiaCandidateTests(unittest.TestCase):
 def test_only_malaysia_regions_are_ranked_and_no_station_is_approved(self):
  points=[{"countryCode":"MY","subregionId":"MY-X","representativePoint":{"latitude":3.0,"longitude":101.0}},{"countryCode":"SG","subregionId":"SG-X","representativePoint":{"latitude":1.3,"longitude":103.8}}]
  stations=[{"stationId":48647,"name":"SUBANG","stationType":"CLIMATOLOGICAL","latitude":3.12,"longitude":101.55}]
  out=M.build(points,stations)
  self.assertEqual(out["summary"]["malaysiaRegionCount"],1)
  self.assertEqual(out["regions"][0]["nearestStation"]["stationId"],48647)
  self.assertFalse(out["regions"][0]["nearestStation"]["autoSelected"])
  self.assertFalse(out["regions"][0]["nearestStation"]["historicalElementsVerified"])
 def test_haversine_distance(self):
  a={"latitude":0.0,"longitude":0.0};b={"latitude":0.0,"longitude":1.0}
  self.assertAlmostEqual(M.haversine_km(a,b),111.195,places=1)
if __name__=="__main__":unittest.main()
