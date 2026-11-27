import json, tempfile, unittest
from pathlib import Path
from scripts.validate_long_range_source_contracts import validate_document, validate_root
REGIONS={"JP-A","KR-A"}
def base(kind):
 src={"era5-daily":("ERA5_DAILY","derived-era5-single-levels-daily-statistics"),"ecmwf-extended-range":("ECMWF_IFS","IFS-EXTENDED-RANGE"),"c3s-seasonal":("C3S_MULTI_SYSTEM","C3S-SEASONAL-MULTI-SYSTEM")}[kind]
 return {"schemaVersion":1,"contractType":kind,"sourceId":src[0],"datasetId":src[1],"retrievedAt":"2026-11-27T00:00:00Z","sourceVersion":"test-v1","units":{},"records":[]}
def historical():
 d=base("era5-daily"); d["units"]={"precipitationMm":"mm","temperatureMinC":"degC","temperatureMaxC":"degC","dewpointMeanC":"degC","windDirectionDeg":"degrees","cloudCoverMeanPct":"%","windSpeedMs":"m/s","relativeHumidityPct":"%"}
 d["records"]=[{"dateLocal":"1991-01-01","subregionId":"JP-A","representativePointId":"point-a","timezone":"Asia/Tokyo","gridCell":{"latitude":35.0,"longitude":139.0},"values":{"precipitationMm":0.0,"temperatureMinC":2.0,"temperatureMaxC":9.0,"dewpointMeanC":3.0,"cloudCoverMeanPct":45.0,"windSpeedMs":2.0,"relativeHumidityPct":70},"qualityFlags":[]}]
 return d
def ecmwf():
 d=base("ecmwf-extended-range"); d["records"]=[{"subregionId":"JP-A","representativePointId":"point-a","timezone":"Asia/Tokyo","validStart":"2026-12-14","validEnd":"2026-12-20","leadDayStart":17,"leadDayEnd":23,"initializationTime":"2026-11-27T00:00:00Z","modelRunId":"ifs-2026112700","ensembleStatistics":{"precipitationAnomalyMm":4.2,"temperatureAnomalyC":1.1,"precipitationWetProbability":0.6,"temperatureAboveNormalProbability":0.7,"ensembleSpread":1.8}}]
 return d
def c3s():
 d=base("c3s-seasonal"); d["records"]=[{"subregionId":"JP-A","representativePointId":"point-a","timezone":"Asia/Tokyo","validMonth":"2027-01","initializationTime":"2026-11-01T00:00:00Z","systemId":"ECMWF-SEAS5","tercileProbabilities":{"precipitation":{"below":0.2,"near":0.3,"above":0.5},"temperature":{"below":0.1,"near":0.4,"above":0.5}},"anomalies":{"precipitationPct":12.0,"temperatureC":0.8}}]
 return d
class SourceContractTests(unittest.TestCase):
 def errors(self,d,k): return validate_document(d,k,REGIONS)[0]
 def test_valid_contract_examples(self):
  for k,d in (("era5-daily",historical()),("ecmwf-extended-range",ecmwf()),("c3s-seasonal",c3s())): self.assertEqual(self.errors(d,k),[])
 def test_era5_land_contract_is_not_accepted(self):
  d=historical(); d["datasetId"]="reanalysis-era5-land"
  self.assertTrue(any("datasetId must equal" in x for x in self.errors(d,"era5-daily")))
 def test_historical_rejects_missing_provenance_and_bad_units(self):
  d=historical(); d.pop("sourceVersion"); d["units"]["precipitationMm"]="inch"; e=self.errors(d,"era5-daily")
  self.assertTrue(any("sourceVersion" in x for x in e)); self.assertTrue(any("units.precipitationMm" in x for x in e))
 def test_historical_rejects_duplicate_date_and_bad_timezone(self):
  d=historical(); d["records"].append(dict(d["records"][0])); d["records"][1]["timezone"]="UTC+8"; e=self.errors(d,"era5-daily")
  self.assertTrue(any("duplicate" in x for x in e)); self.assertTrue(any("IANA" in x for x in e))
 def test_ecmwf_rejects_invalid_period_and_probability(self):
  d=ecmwf(); d["records"][0]["validEnd"]="2026-12-01"; d["records"][0]["ensembleStatistics"]["precipitationWetProbability"]=1.4; e=self.errors(d,"ecmwf-extended-range")
  self.assertTrue(any("validStart/validEnd" in x for x in e)); self.assertTrue(any("0..1" in x for x in e))
 def test_c3s_rejects_malformed_tercile_probabilities(self):
  d=c3s(); d["records"][0]["tercileProbabilities"]["temperature"]["above"]=0.9
  self.assertTrue(any("sum to 1" in x for x in self.errors(d,"c3s-seasonal")))
 def test_unknown_region_rejected(self):
  d=historical(); d["records"][0]["subregionId"]="JP-UNKNOWN"
  self.assertTrue(any("unknown subregionId" in x for x in self.errors(d,"era5-daily")))
 def test_empty_input_never_marks_production_ready(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t); (root/"config/global").mkdir(parents=True)
   (root/"config/global/weather-subregions.json").write_text(json.dumps({"countries":[{"subregions":[{"id":"JP-A"}]}]}))
   r=validate_root(root)
  self.assertFalse(r["productionReady"]); self.assertEqual(r["contracts"]["era5-daily"]["fileCount"],0)
if __name__=="__main__": unittest.main()
