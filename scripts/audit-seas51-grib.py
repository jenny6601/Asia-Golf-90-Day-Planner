#!/usr/bin/env python3
"""Audit GRIB provenance, actual lead step, ensemble members and accumulation semantics."""
import json
from collections import defaultdict
from pathlib import Path
from eccodes import codes_get, codes_grib_new_from_file, codes_release
source=Path("artifacts/seas51-2016-01-01-lead408-426-okinawa.grib")
keys=["dataDate","dataTime","validityDate","validityTime","shortName","name","paramId","units","stepType","stepRange","startStep","endStep","forecastTime","number","perturbationNumber","type","gridType","Ni","Nj","numberOfPoints","latitudeOfFirstGridPointInDegrees","longitudeOfFirstGridPointInDegrees","latitudeOfLastGridPointInDegrees","longitudeOfLastGridPointInDegrees"]
def get(g,k):
    try:return codes_get(g,k)
    except Exception:return None
def lead_key(row):
    # For this dataset forecastTime is not populated; use endStep then stepRange.
    value=row.get("endStep")
    if value is None: value=row.get("stepRange")
    if isinstance(value,str) and "-" in value: value=value.split("-")[-1]
    try:return int(value)
    except (TypeError,ValueError):return str(value)
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
        summary.append({"shortName":name,"leadHour":lead,"messages":len(items),
            "ensembleNumbers":members,"ensembleMemberCount":len(members),
            "stepTypes":sorted({str(x["stepType"]) for x in items}),
            "stepRanges":sorted({str(x["stepRange"]) for x in items}),
            "startSteps":sorted({str(x["startStep"]) for x in items}),
            "endSteps":sorted({str(x["endStep"]) for x in items}),
            "units":sorted({str(x["units"]) for x in items})})
    expected=[408,414,420,426]
    variables=sorted({r["shortName"] for r in rows})
    coverage={v:{str(lead):next((g["ensembleMemberCount"] for g in summary if g["shortName"]==v and g["leadHour"]==lead),0) for lead in expected} for v in variables}
    result={"messageCount":len(rows),"variables":variables,"groups":summary,
        "leadHours":sorted({lead_key(r) for r in rows},key=str),
        "ensembleCoverageByVariableAndLead":coverage,
        "qualityFindings":[
            "forecastTime key is absent in this file; lead hours are recovered from endStep/stepRange.",
            "Total precipitation is present only at lead 408 in this pilot; leads 414, 420 and 426 are missing.",
            "Precipitation stepType is instant and stepRange is 408; do not interpret this as a six-hour accumulation.",
            "This single initialization and sparse lead coverage cannot support D17-D90 skill scoring or calibration."
        ]}
    Path("artifacts/seas51-grib-audit.json").write_text(json.dumps(result,indent=2,default=str)+"\n")
    lines=["# SEAS5.1 GRIB audit","",f"Messages decoded: {len(rows)}","",
        "| Variable | Lead hour | Messages | Ensemble members | Step type | Step range | Units |",
        "|---|---:|---:|---:|---|---|---|"]
    for x in summary: lines.append(f"| {x['shortName']} | {x['leadHour']} | {x['messages']} | {x['ensembleMemberCount']} | {x['stepTypes']} | {x['stepRanges']} | {x['units']} |")
    lines += ["","## Variable/lead coverage","", "```json",json.dumps(coverage,indent=2),"```","",
        "## Quality findings",""]+["- "+x for x in result["qualityFindings"]]+[""]
    Path("artifacts/seas51-grib-audit.md").write_text("\n".join(lines))
    print(json.dumps(result,indent=2,default=str))
if __name__=="__main__": main()
