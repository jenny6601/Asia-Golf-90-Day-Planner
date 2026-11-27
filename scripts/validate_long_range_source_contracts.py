#!/usr/bin/env python3
"""Strictly validate normalized long-range weather inputs; never generate weather."""
from __future__ import annotations
import argparse, json, math, re
from datetime import date, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
EXPECTED_SOURCES = {
 "era5-land-daily": ("ERA5_LAND", "reanalysis-era5-land"),
 "ecmwf-extended-range": ("ECMWF_IFS", "IFS-EXTENDED-RANGE"),
 "c3s-seasonal": ("C3S_MULTI_SYSTEM", "C3S-SEASONAL-MULTI-SYSTEM")}
def load(path): return json.loads(path.read_text(encoding="utf-8"))
def is_number(v): return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def parse_date(v):
 try: return date.fromisoformat(v)
 except (TypeError,ValueError): return None
def parse_dt(v):
 try:
  d=datetime.fromisoformat(v.replace("Z","+00:00"))
  return d if d.tzinfo is not None and d.utcoffset() is not None else None
 except (TypeError,ValueError,AttributeError): return None
def validate_document(doc,kind,known_regions):
 errors=[]
 def req(obj,key,typ=None,where="document"):
  if key not in obj: errors.append(f"{where}: missing {key}"); return None
  value=obj[key]
  if typ and not isinstance(value,typ): errors.append(f"{where}: {key} must be {typ.__name__}")
  return value
 if not isinstance(doc,dict): return ["document: root must be object"],set()
 if req(doc,"schemaVersion",int)!=1: errors.append("schemaVersion must equal 1")
 if req(doc,"contractType",str)!=kind: errors.append(f"contractType must equal {kind}")
 src=EXPECTED_SOURCES[kind]
 if req(doc,"sourceId",str)!=src[0]: errors.append(f"sourceId must equal {src[0]}")
 if req(doc,"datasetId",str)!=src[1]: errors.append(f"datasetId must equal {src[1]}")
 if not parse_dt(req(doc,"retrievedAt",str) or ""): errors.append("retrievedAt must be ISO-8601 with timezone")
 if not req(doc,"sourceVersion",str): errors.append("sourceVersion must be non-empty")
 req(doc,"units",dict)
 units=doc.get("units",{}) if isinstance(doc.get("units"),dict) else {}
 records=req(doc,"records",list) or []
 if not records: errors.append("records must contain at least one record")
 seen=set(); covered=set()
 for i,r in enumerate(records):
  w=f"records[{i}]"
  if not isinstance(r,dict): errors.append(f"{w}: must be object"); continue
  rid=req(r,"subregionId",str,w); pid=req(r,"representativePointId",str,w); tz=req(r,"timezone",str,w)
  if rid and rid not in known_regions: errors.append(f"{w}: unknown subregionId {rid}")
  if rid: covered.add(rid)
  if tz and "/" not in tz: errors.append(f"{w}: timezone must be an IANA region name")
  if not pid: errors.append(f"{w}: representativePointId must be non-empty")
  if kind=="era5-land-daily":
   ds=req(r,"dateLocal",str,w); d=parse_date(ds)
   if not d: errors.append(f"{w}: dateLocal must be YYYY-MM-DD")
   key=(rid,ds)
   if key in seen: errors.append(f"{w}: duplicate subregion/date {key}")
   seen.add(key)
   vals=req(r,"values",dict,w) or {}
   expected={"precipitationMm":"mm","temperatureMinC":"degC","temperatureMaxC":"degC","temperatureMeanC":"degC","windSpeedMs":"m/s","relativeHumidityPct":"%"}
   for field,unit in expected.items():
    if field in vals and not is_number(vals[field]): errors.append(f"{w}: {field} must be finite number or omitted")
    if field in vals and units.get(field)!=unit: errors.append(f"units.{field} must be {unit}")
   for f in ("precipitationMm","windSpeedMs"):
    if is_number(vals.get(f)) and vals[f]<0: errors.append(f"{w}: {f} cannot be negative")
   if is_number(vals.get("relativeHumidityPct")) and not 0<=vals["relativeHumidityPct"]<=100: errors.append(f"{w}: relativeHumidityPct must be 0..100")
   if is_number(vals.get("temperatureMinC")) and is_number(vals.get("temperatureMaxC")) and vals["temperatureMinC"]>vals["temperatureMaxC"]: errors.append(f"{w}: Tmin exceeds Tmax")
   grid=req(r,"gridCell",dict,w) or {}
   for f in ("latitude","longitude"):
    if not is_number(grid.get(f)): errors.append(f"{w}: gridCell.{f} must be finite number")
   if is_number(grid.get("latitude")) and not -90<=grid["latitude"]<=90: errors.append(f"{w}: latitude out of range")
   if is_number(grid.get("longitude")) and not -180<=grid["longitude"]<=180: errors.append(f"{w}: longitude out of range")
   flags=req(r,"qualityFlags",list,w)
   if isinstance(flags,list) and any(not isinstance(x,str) for x in flags): errors.append(f"{w}: qualityFlags must contain strings")
  elif kind=="ecmwf-extended-range":
   start=req(r,"validStart",str,w); end=req(r,"validEnd",str,w)
   if not parse_date(start) or not parse_date(end) or (parse_date(start) and parse_date(end) and parse_date(start)>parse_date(end)): errors.append(f"{w}: invalid validStart/validEnd")
   a=req(r,"leadDayStart",int,w); b=req(r,"leadDayEnd",int,w)
   if isinstance(a,int) and isinstance(b,int) and (a<1 or b<a): errors.append(f"{w}: invalid lead-day interval")
   req(r,"initializationTime",str,w); req(r,"modelRunId",str,w)
   stats=req(r,"ensembleStatistics",dict,w) or {}
   for f in ("precipitationAnomalyMm","temperatureAnomalyC","precipitationWetProbability","temperatureAboveNormalProbability","ensembleSpread"):
    if f in stats and not is_number(stats[f]): errors.append(f"{w}: {f} must be finite number")
   for f in ("precipitationWetProbability","temperatureAboveNormalProbability"):
    if is_number(stats.get(f)) and not 0<=stats[f]<=1: errors.append(f"{w}: {f} must be 0..1")
  else:
   month=req(r,"validMonth",str,w)
   if not isinstance(month,str) or not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])",month): errors.append(f"{w}: validMonth must be YYYY-MM")
   if not req(r,"systemId",str,w): errors.append(f"{w}: systemId required")
   req(r,"initializationTime",str,w)
   probs=req(r,"tercileProbabilities",dict,w) or {}
   for variable in ("precipitation","temperature"):
    p=probs.get(variable)
    if not isinstance(p,dict) or any(not is_number(p.get(k)) for k in ("below","near","above")): errors.append(f"{w}: {variable} tercile probabilities require below/near/above")
    elif any(not 0<=p[k]<=1 for k in ("below","near","above")) or abs(sum(p[k] for k in ("below","near","above"))-1)>0.015: errors.append(f"{w}: {variable} tercile probabilities must be 0..1 and sum to 1")
   anomalies=req(r,"anomalies",dict,w) or {}
   for f in ("precipitationPct","temperatureC"):
    if f in anomalies and not is_number(anomalies[f]): errors.append(f"{w}: anomalies.{f} must be finite number")
 return errors,covered
def validate_root(root=ROOT):
 registry=load(root/"config/global/weather-subregions.json")
 regions={s["id"] for c in registry.get("countries",[]) for s in c.get("subregions",[])}
 report={"schemaVersion":1,"status":"contracts-validated-no-production-generation","expectedSubregions":len(regions),"contracts":{}}
 base=root/"data/long-range-inputs"
 for kind in EXPECTED_SOURCES:
  files=sorted((base/kind).glob("*.json")) if (base/kind).exists() else []
  errors=[]; covered=set(); count=0
  for path in files:
   try:
    doc=load(path); errs,ids=validate_document(doc,kind,regions)
    errors.extend({"file":str(path.relative_to(root)),"error":e} for e in errs)
    covered.update(ids); count+=len(doc.get("records",[])) if isinstance(doc,dict) and isinstance(doc.get("records"),list) else 0
   except Exception as exc: errors.append({"file":str(path.relative_to(root)),"error":str(exc)})
  report["contracts"][kind]={"fileCount":len(files),"recordCount":count,"regionsCovered":len(covered),"missingRegions":sorted(regions-covered),"valid":bool(files) and not errors,"errors":errors}
 report["productionReady"]=False
 report["limitations"]=["Structural validity does not prove spatial/temporal completeness, forecast skill or hindcast calibration.","Missing inputs remain unavailable; no daily estimates are generated."]
 return report
def main():
 p=argparse.ArgumentParser(); p.add_argument("--root",type=Path,default=ROOT); a=p.parse_args()
 report=validate_root(a.root); out=a.root/"data/long-range-readiness"; out.mkdir(parents=True,exist_ok=True)
 (out/"long-range-source-contract-validation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print(json.dumps({"status":report["status"],"productionReady":False,"contracts":{k:{"files":v["fileCount"],"valid":v["valid"],"regions":v["regionsCovered"]} for k,v in report["contracts"].items()}},ensure_ascii=False))
 if any(v["errors"] for v in report["contracts"].values()): raise SystemExit(1)
if __name__=="__main__": main()
