#!/usr/bin/env python3
"""Inventory genuinely present long-range weather inputs; never synthesizes weather."""
from __future__ import annotations
import argparse, json
from collections import defaultdict
from datetime import date
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def read_json(path): return json.loads(path.read_text(encoding="utf-8"))

def inventory(root: Path=ROOT):
    registry=read_json(root/"config/global/weather-subregions.json")
    subs=[s for c in registry.get("countries",[]) for s in c.get("subregions",[])]
    files=sorted((root/"data/long-range-inputs/era5-daily").glob("*-daily.json"))
    by_region=defaultdict(list); malformed=[]
    for path in files:
        try:
            rows=read_json(path).get("records")
            if not isinstance(rows,list): raise ValueError("missing records[]")
            for row in rows:
                if row.get("subregionId"): by_region[row["subregionId"]].append(row)
        except Exception as exc: malformed.append({"file":str(path.relative_to(root)),"error":str(exc)})
    region_rows=[]
    for sub in subs:
        rid=sub["id"]; rows=by_region.get(rid,[])
        dates=sorted({r.get("dateLocal") for r in rows if isinstance(r.get("dateLocal"),str)})
        region_rows.append({"subregionId":rid,"dailyRecordCount":len(rows),
          "coveredYears":sorted({d[:4] for d in dates if len(d)>=4}),
          "firstDate":dates[0] if dates else None,"lastDate":dates[-1] if dates else None,
          "hasHistoricalDailyInput":bool(rows)})
    snapshots=[]
    for path in sorted((root/"data/okinawa-forecast-snapshots").glob("*.json")):
        try:
            p=read_json(path); regions=[]
            for rid,reg in (p.get("seasonal") or {}).items():
                w=reg.get("weekly") or {}; m=reg.get("monthly") or {}; daily=reg.get("daily") or {}
                wt=w.get("time") or []; mt=m.get("time") or []; dt=daily.get("time") or []
                regions.append({"regionId":rid,"weeklyRecords":len(wt),"weeklyFirst":wt[0] if wt else None,
                  "weeklyLast":wt[-1] if wt else None,"monthlyRecords":len(mt),
                  "monthlyFirst":mt[0] if mt else None,"monthlyLast":mt[-1] if mt else None,
                  "seasonalDailyRecords":len(dt)})
            snapshots.append({"file":str(path.relative_to(root)),"fetchedAt":p.get("fetchedAt"),
              "provider":p.get("seasonalProvider"),"model":p.get("seasonalModel"),"regions":regions})
        except Exception as exc: snapshots.append({"file":str(path.relative_to(root)),"error":str(exc)})
    n=len(subs); with_data=sum(x["hasHistoricalDailyInput"] for x in region_rows)
    unmapped_regions=sorted(set(by_region)-{s["id"] for s in subs})
    unmapped_rows=sum(len(by_region[rid]) for rid in unmapped_regions)
    seasonal_daily=sum(r["seasonalDailyRecords"] for s in snapshots for r in s.get("regions",[]))
    return {"schemaVersion":1,"inventoryType":"repository-file-presence-and-structure-only",
      "generatedAt":date.today().isoformat(),"status":"not-ready-for-production-daily-generation",
      "scope":{"expectedSubregions":n,"uniqueSubregionIds":len({s["id"] for s in subs})},
      "historicalEra5":{"fileCount":len(files),"regionsWithDailyRecords":with_data,
        "regionsWithoutDailyRecords":n-with_data,"dailyRecordCount":sum(len(by_region.get(s["id"],[])) for s in subs),
        "allDailyRowsFoundIncludingUnmappedPilotFiles":sum(len(v) for v in by_region.values()),
        "unmappedHistoricalSubregionIds":unmapped_regions,"unmappedHistoricalDailyRows":unmapped_rows,
        "referenceYearsPresent":sorted({y for x in region_rows for y in x["coveredYears"]}),
        "targetReferenceYears":[1991,2020],"full1991_2020BaselineAvailable":False,
        "regions":region_rows,"malformedFiles":malformed},
      "forecastSnapshots":{"fileCount":len(snapshots),
        "seasonalRegionSnapshotCount":sum(len(s.get("regions",[])) for s in snapshots if not s.get("error")),
        "seasonalDailyRecordCount":seasonal_daily,"snapshots":snapshots},
      "sourceReadiness":{
        "D17_D18":{"weeklyExtendedRangeInput":"partial-research-snapshot-only" if snapshots else "not-present",
          "historicalDailySequenceInput":"single-region-pilot-only" if with_data else "not-present","productionReady":False},
        "D19_D46":{"ecmwfWeeklyOperationalInputs":"not-present-as-eight-country-ingestion",
          "historicalDailySequenceInput":"single-region-pilot-only" if with_data else "not-present","productionReady":False},
        "D47_D90":{"c3sMultiSystemMonthlyInputs":"not-present-as-eight-country-ingestion",
          "historicalDailySequenceInput":"single-region-pilot-only" if with_data else "not-present","productionReady":False}},
      "limitations":["A request manifest, coordinate audit or station metadata file is not an acquired historical daily dataset.",
        "A forecast snapshot is not a multi-cycle archive or hindcast verification dataset.",
        "Weekly/monthly signals do not by themselves constitute daily weather values.",
        "No daily values are generated by this inventory.",
        "Missing inputs remain missing; no zero-fill, D16 carry-forward or synthetic values are allowed."],
      "nextRequiredActions":["Acquire and QA ERA5 1991-2020 daily sequences for all 80 representative points.",
        "Ingest date-stamped ECMWF extended-range weekly ensemble inputs and matching hindcasts for D17-D46.",
        "Ingest C3S multi-system monthly forecasts and matching hindcasts for D47-D90.",
        "Normalize sources with model, initialization, valid period, timezone, grid and retrieval provenance.",
        "Only then implement coherent conditional daily analogue generation and lead-band backtests."]}

def write_outputs(report, output_dir):
    output_dir.mkdir(parents=True,exist_ok=True)
    (output_dir/"long-range-data-inventory.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    h=report["historicalEra5"]; s=report["forecastSnapshots"]
    lines=["# Long-range weather data inventory","",f"- Generated: {report['generatedAt']}",
      f"- Status: **{report['status']}**",f"- Regional points: {report['scope']['uniqueSubregionIds']}/{report['scope']['expectedSubregions']}","",
      "## Actual files found","",f"- ERA5 daily files: {h['fileCount']}",
      f"- Regions with historical daily rows: {h['regionsWithDailyRecords']}/{report['scope']['expectedSubregions']}",
      f"- Historical daily rows: {h['dailyRecordCount']}",
      f"- Historical years present: {', '.join(h['referenceYearsPresent']) or 'none'}",
      f"- Seasonal snapshot files: {s['fileCount']}",f"- Seasonal region snapshots: {s['seasonalRegionSnapshotCount']}",
      f"- Daily-shaped seasonal records: {s['seasonalDailyRecordCount']}","","## Production readiness","",
      "| Horizon | Current input state | Ready |","|---|---|---|",
      "| D17-D18 | Weekly research snapshot only; historical daily sequence pilot only | No |",
      "| D19-D46 | No eight-country ECMWF operational ingestion; historical daily sequence pilot only | No |",
      "| D47-D90 | No eight-country C3S multi-system ingestion; historical daily sequence pilot only | No |",
      "","## Interpretation","","This is a file-presence and structure inventory, not a forecast. Manifests, station metadata and coordinate audits are not acquired daily climate data. No synthetic daily estimates were generated.","",
      "## Next required actions",""]
    lines.extend(f"{i}. {v}" for i,v in enumerate(report["nextRequiredActions"],1))
    (output_dir/"long-range-data-inventory.md").write_text("\n".join(lines)+"\n",encoding="utf-8")

def main():
    p=argparse.ArgumentParser(); p.add_argument("--root",type=Path,default=ROOT); p.add_argument("--output-dir",type=Path)
    a=p.parse_args(); r=inventory(a.root); write_outputs(r,a.output_dir or a.root/"data/long-range-readiness")
    print(json.dumps({"status":r["status"],"regions":r["scope"]["expectedSubregions"],
      "historicalRegionsWithData":r["historicalEra5"]["regionsWithDailyRecords"],
      "historicalDailyRows":r["historicalEra5"]["dailyRecordCount"],
      "seasonalSnapshots":r["forecastSnapshots"]["fileCount"]},ensure_ascii=False))
if __name__=="__main__": main()
