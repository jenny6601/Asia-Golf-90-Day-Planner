import importlib.util, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("era5_full_pilot",ROOT/"scripts/acquire_era5_land_full_dataset_pilot.py")
M=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(M)
class FullDatasetPilotTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.registry=M.compile_registry()
 def test_all_registry_points_can_build_single_year_request(self):
  self.assertEqual(len(self.registry["points"]),80)
  for point in self.registry["points"]:
   r=M.build_request(point,1991);self.assertEqual(r["data_format"],"grib");self.assertEqual(r["download_format"],"zip")
   self.assertEqual(len(r["variable"]),5);self.assertEqual(len(r["time"]),24);self.assertEqual(r["year"],["1991"]);self.assertEqual(len(r["area"]),4)
 def test_invalid_year_rejected(self):
  with self.assertRaises(ValueError): M.build_request(self.registry["points"][0],1949)
if __name__=="__main__":unittest.main()
