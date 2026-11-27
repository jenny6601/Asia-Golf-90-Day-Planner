import json, tempfile, unittest
from pathlib import Path
from scripts.build_long_range_data_inventory import inventory, write_outputs

class LongRangeInventoryTests(unittest.TestCase):
    def fixture(self, root):
        (root/'config/global').mkdir(parents=True)
        (root/'data/long-range-inputs/era5-daily').mkdir(parents=True)
        (root/'data/era5-land-japan-1991-2020/daily').mkdir(parents=True)
        (root/'data/okinawa-forecast-snapshots').mkdir(parents=True)
        (root/'config/global/weather-subregions.json').write_text(json.dumps({'countries':[{'subregions':[{'id':'JP-A'},{'id':'JP-B'}]}]}))
        (root/'data/long-range-inputs/era5-daily/JP-OLD-1991-daily.json').write_text(json.dumps({'records':[{'subregionId':'JP-OLD','dateLocal':'1991-01-01'},{'subregionId':'JP-OLD','dateLocal':'1991-01-02'}]}))
        (root/'data/era5-land-japan-1991-2020/daily/JP-A-1991-daily.json').write_text(json.dumps({'records':[{'subregionId':'JP-A','validDate':'1991-01-01'}]}))
        (root/'data/okinawa-forecast-snapshots/one.json').write_text(json.dumps({'fetchedAt':'2026-11-27T00:00:00Z','seasonalProvider':'test','seasonalModel':'test-model','seasonal':{'north':{'weekly':{'time':['2026-11-23']},'monthly':{'time':['2026-11-01']}}}}))
    def test_legacy_unmapped_rows_do_not_count_as_current_region_coverage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); self.fixture(root); r=inventory(root)
        h=r['historicalEra5']
        self.assertEqual(h['regionsWithDailyRecords'],0)
        self.assertEqual(h['regionsWithoutDailyRecords'],2)
        self.assertEqual(h['dailyRecordCount'],0)
        self.assertEqual(h['allDailyRowsFoundIncludingUnmappedPilotFiles'],2)
        self.assertEqual(h['unmappedHistoricalSubregionIds'],['JP-OLD'])
        self.assertFalse(h['full1991_2020BaselineAvailable'])
        self.assertFalse(r['sourceReadiness']['D17_D18']['productionReady'])
    def test_period_snapshots_are_not_daily_forecasts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); self.fixture(root); r=inventory(root)
        self.assertEqual(r['forecastSnapshots']['seasonalRegionSnapshotCount'],1)
        self.assertEqual(r['forecastSnapshots']['seasonalDailyRecordCount'],0)
    def test_writes_json_and_markdown(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); self.fixture(root); r=inventory(root); out=root/'out'; write_outputs(r,out)
            saved=json.loads((out/'long-range-data-inventory.json').read_text())
            self.assertEqual(saved['status'],'not-ready-for-production-daily-generation')
            self.assertTrue((out/'long-range-data-inventory.md').exists())
if __name__=='__main__': unittest.main()
