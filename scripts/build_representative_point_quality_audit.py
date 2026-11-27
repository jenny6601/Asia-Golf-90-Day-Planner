#!/usr/bin/env python3
"""Build a reproducible preflight audit of all regional ERA5-Land representative points.

No network access and no data download. Rounded 0.1-degree cells are candidates only;
the actual returned grid coordinates must be read from each downloaded data file.
"""
from __future__ import annotations
import argparse, importlib.util, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(path):
    return json.loads((ROOT/path).read_text(encoding="utf-8"))
def haversine_km(a,b):
    r=6371.0088
    p1,p2=math.radians(a["latitude"]),math.radians(b["latitude"])
    dp=math.radians(b["latitude"]-a["latitude"]);dl=math.radians(b["longitude"]-a["longitude"])
    q=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(q))
def compile_registry():
    spec=importlib.util.spec_from_file_location("registry_builder",ROOT/"scripts/build_eight_country_climate_registry.py")
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module.compile_registry(load("config/global/countries.json"),load("config/global/weather-subregions.json"),load("config/global/courses.json"))
def build_audit(registry):
    points=[]
    for p in registry["points"]:
        lat=p["representativePoint"]["latitude"];lon=p["representativePoint"]["longitude"]
        grid={"latitude":round(round(lat*10)/10,1),"longitude":round(round(lon*10)/10,1)}
        points.append({"countryCode":p["countryCode"],"countryNameZh":p["countryNameZh"],
          "subregionId":p["subregionId"],"subregionName":p["label"],
          "representativeCourseId":p["representativeCourseId"],"representativeCourseName":p["representativeCourseName"],
          "representativePoint":p["representativePoint"],"timezone":p["timezone"],
          "coordinateEvidence":{"status":p["coordinateStatus"],"sourceUrl":p.get("coordinateSourceUrl"),"sourceLinkPresent":bool(p.get("coordinateSourceUrl"))},
          "expectedEra5LandGridPoint":grid,"representativeToExpectedGridKm":round(haversine_km(p["representativePoint"],grid),3),
          "returnedGridPointVerified":False,"stationMatchStatus":"not-started","historicalDataStatus":"not-acquired"})
    country_codes=sorted({p["countryCode"] for p in points});evidence={}
    for p in points:
        k=p["coordinateEvidence"]["status"];evidence[k]=evidence.get(k,0)+1
    return {"schemaVersion":1,"status":"representative-point-preflight-inventory-only",
      "purpose":"Inventory and coordinate-grid preflight only; not proof of returned CDS grid cells, station representativeness or historical acquisition.",
      "dataset":"reanalysis-era5-land","datasetDocumentation":"https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
      "productGuide":"https://confluence.ecmwf.int/pages/viewpage.action?pageId=690470575",
      "datasetFacts":{"spatialGridDegrees":0.1,"temporalResolution":"hourly","coverage":"1950-present",
        "variables":["2m_temperature","2m_dewpoint_temperature","total_precipitation","10m_u_component_of_wind","10m_v_component_of_wind"]},
      "summary":{"countryCount":len(country_codes),"subregionCount":len(points),"representativePoints":len(points),
        "missingCoordinateCount":sum(not math.isfinite(p["representativePoint"]["latitude"]) or not math.isfinite(p["representativePoint"]["longitude"]) for p in points),
        "missingTimezoneCount":sum(not p["timezone"] for p in points),"missingCoordinateSourceLinkCount":sum(not p["coordinateEvidence"]["sourceLinkPresent"] for p in points),
        "expectedGridPointVerifiedCount":0,"stationMatchedCount":0,"historicalDataAcquiredCount":0,
        "subregionsByCountry":{c:sum(p["countryCode"]==c for p in points) for c in country_codes},"coordinateEvidenceStatusCounts":evidence},
      "methodology":{"expectedGrid":"nearest 0.1-degree rounded point is candidate only; audit actual coordinates returned in downloaded files",
        "distance":"great-circle distance between representative point and rounded candidate grid point",
        "limits":"not proof of valid land cell or regional representativeness; no universal distance threshold",
        "missingData":"never replace missing values with zero"},"points":points}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--output",default="data/era5-land-eight-country-1991-2020/representative-point-quality-audit.json");ap.add_argument("--write",action="store_true");args=ap.parse_args()
    audit=build_audit(compile_registry())
    if args.write:
        path=ROOT/args.output;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(audit["summary"],ensure_ascii=False,indent=2))
if __name__=="__main__":main()
