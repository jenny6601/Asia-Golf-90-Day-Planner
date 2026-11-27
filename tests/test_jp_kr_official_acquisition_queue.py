import unittest
from scripts.build_jp_kr_official_acquisition_queue import build_queue

class AcquisitionQueueTests(unittest.TestCase):
 def test_one_item_per_jp_kr_region_and_no_auto_approval(self):
  data={"countries":[
   {"countryCode":"JP","subregions":[{"id":"JP-A","label":"A","representativeCourseId":"c1","candidateCoordinates":{"latitude":35,"longitude":139,"timezone":"Asia/Tokyo"}}]},
   {"countryCode":"KR","subregions":[{"id":"KR-A","label":"B","candidateCoordinates":{"latitude":37,"longitude":127,"timezone":"Asia/Seoul"}}]},
   {"countryCode":"TH","subregions":[{"id":"TH-A","candidateCoordinates":{"latitude":13,"longitude":100}}]}]}
  result=build_queue(data)
  self.assertEqual(result["summary"]["queueItems"],2)
  self.assertEqual(result["summary"]["JP"],1)
  self.assertEqual(result["summary"]["KR"],1)
  self.assertTrue(all(not x["stationApproved"] and not x["weatherIngestionEnabled"] for x in result["queue"]))
 def test_missing_coordinates_are_not_queued(self):
  result=build_queue({"countries":[{"countryCode":"JP","subregions":[{"id":"JP-X"}]}]})
  self.assertEqual(result["summary"]["queueItems"],0)
if __name__=="__main__": unittest.main()
