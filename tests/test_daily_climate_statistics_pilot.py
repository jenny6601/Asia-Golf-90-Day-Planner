import importlib.util, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("daily_stats_pilot",ROOT/"scripts/acquire_daily_climate_statistics_pilot.py")
M=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(M)
class DailyStatisticsPilotTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.registry=M.compile_registry()
 def test_all_eighty_points_have_era5_only_daily_requests(self):
  self.assertEqual(len(self.registry["points"]),80)
  for point in self.registry["points"]:
   req=M.build_requests(point,1991)
   self.assertEqual(len(req),4)
   self.assertEqual([x["dailyStatistic"] for x in req],["daily_min","daily_mean","daily_max","daily_sum"])
   self.assertTrue(all(x["dataset"]==M.DATASET for x in req))
   self.assertTrue(all("time" not in x["request"] for x in req))
   self.assertTrue(all(x["request"]["frequency"]=="1_hourly" for x in req))
   self.assertTrue(all(x["sourceId"]=="ERA5_DAILY_STATS" for x in req))
   self.assertEqual(req[-1]["request"]["variable"],["total_precipitation"])
 def test_temperature_daily_min_and_max(self):
  req=M.build_requests(self.registry["points"][0],1991)
  self.assertEqual(req[0]["request"]["variable"],["2m_temperature"])
  self.assertEqual(req[2]["request"]["variable"],["2m_temperature"])
 def test_timezone_mapping(self):
  expected={"Asia/Tokyo":"utc+09:00","Asia/Seoul":"utc+09:00","Asia/Shanghai":"utc+08:00",
   "Asia/Ho_Chi_Minh":"utc+07:00","Asia/Bangkok":"utc+07:00","Asia/Kuala_Lumpur":"utc+08:00",
   "Asia/Singapore":"utc+08:00","Asia/Jakarta":"utc+07:00","Asia/Makassar":"utc+08:00","Asia/Jayapura":"utc+09:00"}
  for zone,offset in expected.items(): self.assertEqual(M.utc_offset(zone),offset)
 def test_unknown_timezone_fails_closed(self):
  with self.assertRaises(ValueError): M.utc_offset("Pacific/Honolulu")
 def test_invalid_year_rejected(self):
  with self.assertRaises(ValueError): M.build_requests(self.registry["points"][0],1939)
if __name__=="__main__": unittest.main()
