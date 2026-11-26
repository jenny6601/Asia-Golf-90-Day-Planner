#!/usr/bin/env python3
"""Audit GRIB provenance, leads, ensemble identifiers and accumulation semantics."""
import json
from collections import defaultdict
from pathlib import Path
from eccodes import codes_get, codes_grib_new_from_file, codes_release
source=Path("artifacts/seas51-2016-01-01-lead408-426-okinawa.grib")
keys=["dataDate","dataTime","validityDate","validityTime","shortName","name","paramId","units","stepType","stepRange","startStep","endStep","forecastTime","number","perturbationNumber","type","gridType","Ni","Nj","numberOfPoints","latitudeOfFirstGridPointInDegrees","longitudeOfFirstGridPointInDegrees","latitudeOfLastGridPointInDegrees","longitudeOfLastGridPointInDegrees"]
def get(g,k):
    try:return codes_get(g,k)
    except Exception:return None
def main():
    if not source.exists(): raise SystemExit("GRIB file missing")
    rows=[]
    with source.open("rb") as f:
        while (g:=codes_grib_new_from_file(f)) is not None:
            try: rows.append({k:get(g,k) for k in keys})
            finally: codes_release(g)
    if not rows: raise SystemExit("No GRIB messages decoded")
    groups=defaultdict(list)
    for r in rows: groups[(r["shortName"],r["forecastTime"])].append(r)
    summary=[]
    for (name,lead),items in sorted(groups.items(),key=lambda x:(str(x[0][0]),str(x[0][1]))):
        summary.append({"shortName":name,"forecastTime":lead,"messages":len(items),
            "ensembleNumbers":sorted({x["number"] for x in items if x["number"] is not None}),
            "perturbationNumbers":sorted({x["perturbationNumber"] for x in items if x["perturbationNumber"] is not None}),
            "stepTypes":sorted({str(x["stepType"]) for x in items}),
            "stepRanges":sorted({str(x["stepRange"]) for x in items}),
            "startSteps":sorted({str(x["startStep"]) for x in items}),
            "endSteps":sorted({str(x["endStep"]) for x in items}),
            "units":sorted({str(x["units"]) for x in items})})
    result={"messageCount":len(rows),"groups":summary,
        "leadsHours":sorted({r["forecastTime"] for r in rows if r["forecastTime"] is not None}),
        "guardrail":"Message count is not ensemble size. Six-hour lead spacing is not proof of six-hour precipitation accumulation; inspect stepType/stepRange/startStep/endStep."}
    Path("artifacts/seas51-grib-audit.json").write_text(json.dumps(result,indent=2,default=str)+"\n")
    lines=["# SEAS5.1 GRIB audit","",f"Messages decoded: {len(rows)}","", "| Variable | Lead hour | Messages | Ensemble IDs | Step type | Step range | Units |","|---|---:|---:|---|---|---|---|"]
    for x in summary: lines.append(f"| {x['shortName']} | {x['forecastTime']} | {x['messages']} | {x['ensembleNumbers']} | {x['stepTypes']} | {x['stepRanges']} | {x['units']} |")
    lines += ["","## Interpretation limit","",result["guardrail"],""]
    Path("artifacts/seas51-grib-audit.md").write_text("\n".join(lines))
    print(json.dumps(result,indent=2,default=str))
if __name__=="__main__": main()
