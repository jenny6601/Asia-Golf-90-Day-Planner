#!/usr/bin/env python3
"""Acquire and inspect one ERA5-Land full-dataset point/year pilot; no daily aggregation."""
from __future__ import annotations
import argparse, importlib.util, json, os, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
VARIABLES=["2m_temperature","2m_dewpoint_temperature","total_precipitation","10m_u_component_of_wind","10m_v_component_of_wind"]
SHORT={"2m_temperature":"t2m","2m_dewpoint_temperature":"d2m","total_precipitation":"tp","10m_u_component_of_wind":"u10","10m_v_component_of_wind":"v10"}
def compile_registry():
 spec=importlib.util.spec_from_file_location("climate_registry",ROOT/"scripts/build_eight_country_climate_registry.py")
 mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
 def read(p): return json.loads((ROOT/p).read_text(encoding="utf-8"))
 return mod.compile_registry(read("config/global/countries.json"),read("config/global/weather-subregions.json"),read("config/global/courses.json"))
def build_request(point,year):
 if not 1950<=year<=2100: raise ValueError("year outside ERA5-Land range")
 lat=point["gridMapping"]["candidateLatitude"]; lon=point["gridMapping"]["candidateLongitude"]; pad=0.06
 return {"variable":VARIABLES,"year":[str(year)],"month":[f"{m:02d}" for m in range(1,13)],"day":[f"{d:02d}" for d in range(1,32)],
  "time":[f"{h:02d}:00" for h in range(24)],"area":[round(min(90,lat+pad),4),round(lon-pad,4),round(max(-90,lat-pad),4),round(lon+pad,4)],
  "data_format":"grib","download_format":"zip"}
def inspect_archive(archive,point,year):
 import numpy as np, cfgrib, tempfile
 found=set(); datasets=[]; coordinates=[]; precip=[]
 with zipfile.ZipFile(archive) as z:
  bad=z.testzip()
  if bad: raise ValueError(f"corrupt ZIP member: {bad}")
  members=[n for n in z.namelist() if n.lower().endswith((".grib",".grb",".grb2"))]
  if not members: raise ValueError("ZIP contains no GRIB members")
  with tempfile.TemporaryDirectory(prefix="era5-land-full-") as tmp:
   z.extractall(tmp)
   for member in members:
    for ds in cfgrib.open_datasets(str(Path(tmp)/member),backend_kwargs={"indexpath":""}):
     try:
      for name,da in ds.data_vars.items():
       short=da.attrs.get("GRIB_shortName",name)
       if short not in SHORT.values(): continue
       found.add(short); item={"member":member,"variable":name,"shortName":short,"units":da.attrs.get("units"),
         "validValueCount":int(np.isfinite(np.asarray(da.values,dtype="float64")).sum()),"shape":list(da.shape)}
       for coord in ("latitude","longitude"):
        if coord in ds.coords: item[coord+"Values"]=sorted({round(float(v),4) for v in np.asarray(ds.coords[coord].values,dtype="float64").reshape(-1)})
       if short=="tp":
        item["accumulationMetadata"]={k:da.attrs.get(k) for k in ("GRIB_stepType","GRIB_stepRange","GRIB_startStep","GRIB_endStep","GRIB_typeOfLevel")}
        precip.append(item["accumulationMetadata"])
       datasets.append(item)
       if "latitude" in ds.coords and "longitude" in ds.coords:
        lats=np.asarray(ds.coords["latitude"].values,dtype="float64").reshape(-1); lons=np.asarray(ds.coords["longitude"].values,dtype="float64").reshape(-1)
        coordinates.extend((float(a),float(b)) for a in lats for b in lons)
     finally: ds.close()
 missing=sorted(set(SHORT.values())-found); expected=(point["gridMapping"]["candidateLatitude"],point["gridMapping"]["candidateLongitude"])
 unique=sorted({(round(a,4),round(b,4)) for a,b in coordinates})
 nearest=min(unique,key=lambda x:(x[0]-expected[0])**2+(x[1]-expected[1])**2) if unique else None
 return {"status":"structural-inspection-passed" if not missing and nearest else "structural-inspection-failed","subregionId":point["subregionId"],"year":year,
  "sourceId":"ERA5_LAND_FULL_DATASET","datasetId":"reanalysis-era5-land","archiveBytes":Path(archive).stat().st_size,
  "expectedGridCandidate":{"latitude":expected[0],"longitude":expected[1]},"returnedGridCoordinates":[{"latitude":a,"longitude":b} for a,b in unique],
  "nearestReturnedGridPoint":{"latitude":nearest[0],"longitude":nearest[1]} if nearest else None,
  "gridPointOffsetDegrees":{"latitude":round(nearest[0]-expected[0],4),"longitude":round(nearest[1]-expected[1],4)} if nearest else None,
  "variablesFound":sorted(found),"missingVariables":missing,"datasetGroups":datasets,"precipitationAccumulationMetadata":precip,
  "criticalLimitations":["Structure and returned grid coordinates only; not proof of complete hourly coverage or land representativeness.",
   "Do not aggregate precipitation until full-dataset accumulation semantics are independently confirmed.","This pilot is not a daily climate baseline and is not eligible for production decision use."]}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument("--subregion",required=True);p.add_argument("--year",type=int,default=1991)
 p.add_argument("--output-dir",default="data/era5-land-full-dataset-pilot");p.add_argument("--dry-run",action="store_true");p.add_argument("--overwrite",action="store_true");a=p.parse_args()
 try:
  reg=compile_registry(); point=next((x for x in reg["points"] if x["subregionId"]==a.subregion),None)
  if point is None: raise ValueError(f"unknown or blocked subregion: {a.subregion}")
  request=build_request(point,a.year)
 except Exception as e: p.error(str(e))
 manifest={"sourceId":"ERA5_LAND_FULL_DATASET","datasetId":"reanalysis-era5-land","subregionId":a.subregion,"year":a.year,"timezone":point["timezone"],
  "representativePoint":point["representativePoint"],"expectedGridCandidate":point["gridMapping"],"request":request,"aggregationEnabled":False,"productionEligible":False}
 if a.dry_run: print(json.dumps({"status":"dry-run-no-network","manifest":manifest},ensure_ascii=False));return 0
 if not os.environ.get("CDSAPI_KEY") and not Path.home().joinpath(".cdsapirc").exists(): print("CDS credentials missing; no request submitted.",file=sys.stderr);return 2
 try: import cdsapi
 except ImportError: print("Install requirements-data.txt.",file=sys.stderr);return 2
 out=ROOT/a.output_dir;out.mkdir(parents=True,exist_ok=True);stem=f"{a.subregion}-{a.year}";archive=out/(stem+".zip");report=out/(stem+"-inspection.json")
 if archive.exists() and not a.overwrite: print(f"Refusing to overwrite {archive}",file=sys.stderr);return 2
 try:
  cdsapi.Client().retrieve("reanalysis-era5-land",request,str(archive))
  if not archive.exists() or archive.stat().st_size==0: raise RuntimeError("CDS returned no archive")
  result=inspect_archive(archive,point,a.year);result["requestManifest"]=manifest
  report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  print(json.dumps({"status":result["status"],"archive":str(archive),"inspection":str(report),"variablesFound":result["variablesFound"],"missingVariables":result["missingVariables"],"productionEligible":False},ensure_ascii=False))
  return 0 if result["status"]=="structural-inspection-passed" else 3
 except Exception as e: print(f"ERA5-Land pilot failed: {e}",file=sys.stderr);return 3
if __name__=="__main__": raise SystemExit(main())
