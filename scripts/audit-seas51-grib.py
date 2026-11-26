#!/usr/bin/env python3
"""Audit GRIB provenance, lead semantics, ensemble coverage and grid geometry."""
import json
from collections import defaultdict
from pathlib import Path
from eccodes import codes_get, codes_grib_new_from_file, codes_release
source = Path("artifacts/seas51-2016-01-01-lead408-426-okinawa.grib")
keys = ["dataDate","dataTime","validityDate","validityTime","shortName","name","paramId","units","stepType","stepRange","startStep","endStep","forecastTime","number","perturbationNumber","type","gridType","Ni","Nj","numberOfPoints","latitudeOfFirstGridPointInDegrees","longitudeOfFirstGridPointInDegrees","latitudeOfLastGridPointInDegrees","longitudeOfLastGridPointInDegrees","iDirectionIncrementInDegrees","jDirectionIncrementInDegrees","iScansNegatively","jScansPositively","jPointsAreConsecutive","alternativeRowScanning"]
def get(g,k):
    try: return codes_get(g,k)
    except Exception: return None
def lead_key(r):
    v=r.get("endStep") if r.get("endStep") is not None else r.get("stepRange")
    if isinstance(v,str) and "-" in v: v=v.split("-")[-1]
    try: return int(v)
    except (TypeError,ValueError): return str(v)
def main():
    if not source.exists(): raise SystemExit("GRIB file missing")
    rows=[]
    with source.open("rb") as f:
        while (g:=codes_grib_new_from_file(f)) is not None:
            try: rows.append({k:get(g,k) for k in keys})
            finally: codes_release(g)
    if not rows: raise SystemExit("No GRIB messages decoded")
    groups=defaultdict(list)
    for r in rows: groups[(r["shortName"],lead_key(r))].append(r)
    summary=[]
    for (name,lead),items in sorted(groups.items(),key=lambda x:(str(x[0][0]),str(x[0][1]))):
        members=sorted({x["number"] for x in items if x["number"] is not None})
        summary.append({"shortName":name,"leadHour":lead,"messages":len(items),"ensembleNumbers":members,"ensembleMemberCount":len(members),"stepTypes":sorted({str(x["stepType"]) for x in items}),"stepRanges":sorted({str(x["stepRange"]) for x in items}),"startSteps":sorted({str(x["startStep"]) for x in items}),"endSteps":sorted({str(x["endStep"]) for x in items}),"units":sorted({str(x["units"]) for x in items})})
    gkeys=["gridType","Ni","Nj","numberOfPoints","latitudeOfFirstGridPointInDegrees","longitudeOfFirstGridPointInDegrees","latitudeOfLastGridPointInDegrees","longitudeOfLastGridPointInDegrees","iDirectionIncrementInDegrees","jDirectionIncrementInDegrees","iScansNegatively","jScansPositively","jPointsAreConsecutive","alternativeRowScanning"]
    signatures={}
    for r in rows:
        sig=json.dumps({k:r.get(k) for k in gkeys},sort_keys=True,default=str)
        signatures[sig]=signatures.get(sig,0)+1
    geometries=[{"messageCount":n,**json.loads(sig)} for sig,n in signatures.items()]
    expected=[408,414,420,426]
    variables=sorted({r["shortName"] for r in rows})
    coverage={v:{str(lead):next((g["ensembleMemberCount"] for g in summary if g["shortName"]==v and g["leadHour"]==lead),0) for lead in expected} for v in variables}
    result={"messageCount":len(rows),"variables":variables,"groups":summary,"leadHours":sorted({lead_key(r) for r in rows},key=str),"gridGeometry":geometries,"gridGeometrySignatureCount":len(geometries),"ensembleCoverageByVariableAndLead":coverage,"qualityFindings":["Grid geometry is copied from GRIB metadata; no spatial resolution is inferred from a provider name.","Nearest-grid distance must be interpreted together with the actual grid geometry.","A nearest grid point is not a course-wide spatial average.","Total precipitation is present only at lead 408 in this pilot; leads 414, 420 and 426 are missing.","Precipitation stepType is instant and stepRange is 408; do not interpret this as a six-hour accumulation.","This single initialization and sparse lead coverage cannot support D17-D90 skill scoring or calibration."]}
    Path("artifacts/seas51-grib-audit.json").write_text(json.dumps(result,indent=2,default=str)+"\n")
    lines=["# SEAS5.1 GRIB audit","",f"Messages decoded: {len(rows)}","","| Variable | Lead hour | Messages | Ensemble members | Step type | Step range | Units |","|---|---:|---:|---:|---|---|---|"]
    for x in summary: lines.append(f"| {x['shortName']} | {x['leadHour']} | {x['messages']} | {x['ensembleMemberCount']} | {x['stepTypes']} | {x['stepRanges']} | {x['units']} |")
    lines += ["","## GRIB grid geometry","",json.dumps(geometries,indent=2,default=str),"","## Variable/lead coverage","",json.dumps(coverage,indent=2),"","## Quality findings",""]+["- "+x for x in result["qualityFindings"]]+[""]
    Path("artifacts/seas51-grib-audit.md").write_text("\n".join(lines))
    print(json.dumps(result,indent=2,default=str))
if __name__=="__main__": main()
