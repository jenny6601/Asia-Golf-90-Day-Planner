#!/usr/bin/env python3
"""Probe total-precipitation availability one lead per CDS request."""
import json
from pathlib import Path
from eccodes import codes_get, codes_grib_new_from_file, codes_release
import cdsapi
LEADS=["408","414","420","426"]
BASE={
 "originating_centre":"ecmwf","system":"51","variable":["total_precipitation"],
 "year":["2016"],"month":["01"],"day":["01"],"data_format":"grib",
 "area":[27,127,25,129]
}
def get(g,k):
 try:return codes_get(g,k)
 except Exception:return None
def inspect(path):
 rows=[]
 with path.open("rb") as f:
  while (g:=codes_grib_new_from_file(f)) is not None:
   try:rows.append({k:get(g,k) for k in ["shortName","units","number","stepType","stepRange","startStep","endStep","validityDate","validityTime"]})
   finally:codes_release(g)
 return {"messages":len(rows),"members":sorted({r["number"] for r in rows if r["number"] is not None}),
  "stepTypes":sorted({str(r["stepType"]) for r in rows}),
  "stepRanges":sorted({str(r["stepRange"]) for r in rows}),
  "startSteps":sorted({str(r["startStep"]) for r in rows}),
  "endSteps":sorted({str(r["endStep"]) for r in rows})}
def main():
 out=Path("artifacts/precipitation-lead-probe");out.mkdir(parents=True,exist_ok=True)
 client=cdsapi.Client(); results=[]
 for lead in LEADS:
  path=out/f"tp-lead-{lead}.grib"
  req={**BASE,"leadtime_hour":[lead]}
  try:
   client.retrieve("seasonal-original-single-levels",req,str(path))
   results.append({"leadHour":int(lead),"ok":path.exists() and path.stat().st_size>0,
      "sizeBytes":path.stat().st_size if path.exists() else 0,
      "audit":inspect(path) if path.exists() and path.stat().st_size else None})
  except Exception as e: results.append({"leadHour":int(lead),"ok":False,"error":str(e)})
 report={"dataset":"seasonal-original-single-levels","system":"51","requestBase":BASE,"results":results,
 "interpretation":"Separate single-lead retrievals test whether the missing precipitation leads were caused by a multi-lead request. stepType/stepRange must still be checked; no rainfall accumulation is assumed."}
 Path("artifacts/seas51-precipitation-lead-probe.json").write_text(json.dumps(report,indent=2,default=str)+"\n")
 print(json.dumps(report,indent=2,default=str))
if __name__=="__main__":main()
