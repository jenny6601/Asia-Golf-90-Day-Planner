import importlib.util, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("point_audit",ROOT/"scripts/build_representative_point_quality_audit.py")
MODULE=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(MODULE)
class RepresentativePointQualityAuditTests(unittest.TestCase):
 def test_all_80_points_are_preflighted_without_false_verification_claims(self):
  audit=MODULE.build_audit(MODULE.compile_registry());s=audit["summary"]
  self.assertEqual(s["countryCount"],8);self.assertEqual(s["subregionCount"],80)
  self.assertEqual(s["missingCoordinateCount"],0);self.assertEqual(s["missingTimezoneCount"],0)
  self.assertEqual(s["expectedGridPointVerifiedCount"],0);self.assertEqual(s["stationMatchedCount"],0)
  self.assertEqual(s["historicalDataAcquiredCount"],0);self.assertEqual(sum(s["subregionsByCountry"].values()),80)
  for p in audit["points"]:
   self.assertFalse(p["returnedGridPointVerified"]);self.assertEqual(p["historicalDataStatus"],"not-acquired")
   self.assertEqual(p["stationMatchStatus"],"not-started");self.assertGreaterEqual(p["representativeToExpectedGridKm"],0)
 def test_grid_candidate_is_nearest_tenth_only(self):
  audit=MODULE.build_audit(MODULE.compile_registry())
  for p in audit["points"]:
   lat=p["representativePoint"]["latitude"];lon=p["representativePoint"]["longitude"]
   self.assertEqual(p["expectedEra5LandGridPoint"]["latitude"],round(round(lat*10)/10,1))
   self.assertEqual(p["expectedEra5LandGridPoint"]["longitude"],round(round(lon*10)/10,1))
if __name__=="__main__":unittest.main()
