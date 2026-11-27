#!/usr/bin/env python3
"""Audit actual GHCN-Daily observations for a bounded shortlist; never approves stations."""
from __future__ import annotations
import argparse, datetime as dt, json, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

BASE = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/"
ELEMENTS = ("PRCP", "TMAX", "TMIN")
START_YEAR, END_YEAR = 1991, 2020

def parse_dly(text, start_year=START_YEAR, end_year=END_YEAR):
    stats = {e: {"validDays": 0, "flaggedDays": 0, "missingDays": 0, "byYear": {}} for e in ELEMENTS}
    for line in text.splitlines():
        if len(line) < 269:
            continue
        element = line[17:21]
        if element not in stats:
            continue
        try:
            year, month = int(line[11:15]), int(line[15:17])
        except ValueError:
            continue
        if year < start_year or year > end_year:
            continue
        for day in range(1, 32):
            pos = 21 + (day - 1) * 8
            chunk = line[pos:pos+8]
            if len(chunk) < 8:
                continue
            try:
                date = dt.date(year, month, day)
                value = int(chunk[:5])
            except ValueError:
                continue
            item = stats[element]["byYear"].setdefault(str(year), {"validDays":0,"flaggedDays":0,"missingDays":0})
            if value == -9999:
                item["missingDays"] += 1
                stats[element]["missingDays"] += 1
            elif chunk[6:7].strip():
                item["flaggedDays"] += 1
                stats[element]["flaggedDays"] += 1
            else:
                item["validDays"] += 1
                stats[element]["validDays"] += 1
    for element, data in stats.items():
        annual = []
        for year in range(start_year, end_year + 1):
            expected = 366 if __import__("calendar").isleap(year) else 365
            row = data["byYear"].get(str(year), {})
            valid = row.get("validDays", 0)
            annual.append({"year":year,"validDays":valid,"coveragePct":round(valid/expected*100,1)})
        data["annualCoverage"] = annual
        data["yearsAtLeast80Pct"] = sum(x["coveragePct"] >= 80 for x in annual)
        data["meanAnnualCoveragePct"] = round(sum(x["coveragePct"] for x in annual)/len(annual),1)
    return stats

def fetch_station(station_id, timeout=60):
    req = urllib.request.Request(BASE + station_id + ".dly", headers={"User-Agent":"Asia-Golf-Climate-Record-Audit/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("ascii", errors="replace")

def shortlist(report, per_region=3):
    chosen=[]
    for region in report.get("regions", []):
        candidates=[x for x in region.get("nearestCandidates",[]) if x.get("requiredClimateElementsPresent")]
        for candidate in candidates[:per_region]:
            chosen.append({"countryCode":region["countryCode"],"subregionId":region["subregionId"],**candidate})
    return chosen

def build_audit(report, downloader=fetch_station, per_region=3, workers=8):
    candidates=shortlist(report,per_region)
    results=[]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        jobs={pool.submit(downloader,c["stationId"]):c for c in candidates}
        for future in as_completed(jobs):
            c=jobs[future]
            base={k:v for k,v in c.items() if k!="elements"}
            try:
                parsed=parse_dly(future.result())
                element_ok=all(parsed[e]["validDays"] > 0 for e in ELEMENTS)
                base.update({"downloadStatus":"downloaded","elementCoverage":parsed,
                    "allRequiredElementsHaveValidRecords":element_ok,
                    "stationApproval":"not-approved-record-level-review-required"})
            except Exception as exc:
                base.update({"downloadStatus":"failed","error":str(exc)[:300],
                    "stationApproval":"not-approved"})
            results.append(base)
    results.sort(key=lambda x:(x["countryCode"],x["subregionId"],x["distanceKm"]))
    return {"schemaVersion":1,"status":"ghcnd-daily-record-coverage-audit-not-station-approval",
        "source":"NOAA GHCN-Daily .dly daily records","referencePeriod":{"startYear":START_YEAR,"endYear":END_YEAR},
        "qualityRules":["-9999 is missing.","Any nonblank quality flag is counted as flagged, not valid.","Valid counts retain source values and flags; no imputation is performed.","Inventory overlap and successful download do not constitute station approval."],
        "selection":{"maxCandidatesPerRegion":per_region,"candidateCount":len(candidates)},
        "summary":{"downloaded":sum(x["downloadStatus"]=="downloaded" for x in results),
            "failed":sum(x["downloadStatus"]!="downloaded" for x in results),
            "regionsRepresented":len({x["subregionId"] for x in results}),
            "regionsWithAllElementsHavingValidRecords":sum(x.get("allRequiredElementsHaveValidRecords",False) for x in results)},
        "stations":results}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",default="data/observation-stations/ghcnd-candidates-1991-2020.json")
    ap.add_argument("--output",default="data/observation-stations/ghcnd-daily-record-audit-1991-2020.json")
    ap.add_argument("--per-region",type=int,default=3)
    ap.add_argument("--workers",type=int,default=8)
    args=ap.parse_args()
    report=json.loads(Path(args.input).read_text(encoding="utf-8"))
    result=build_audit(report,per_region=args.per_region,workers=args.workers)
    result["retrievedAtUtc"]=dt.datetime.now(dt.timezone.utc).isoformat()
    target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result["summary"],indent=2))
if __name__=="__main__": main()
