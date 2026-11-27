#!/usr/bin/env python3
"""Rank JMA AMeDAS historical station configurations against Japan golf-cluster points.

Uses the complete station-information history (not the active-only list).
Candidate discovery only: element capability flags do not prove daily record completeness.
"""
import argparse, csv, io, json, math, urllib.request
from collections import defaultdict
from pathlib import Path

STATION_CSV_URL="https://raw.githubusercontent.com/code4fukui/jma_station/main/jma_station.csv"
START="1991-01-01"; END="2020-12-31"

def haversine_km(a,b,c,d):
    r=6371.0088
    p1,p2=math.radians(float(a)),math.radians(float(c))
    dp=math.radians(float(c)-float(a)); dl=math.radians(float(d)-float(b))
    h=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(h))

def parse_stations(text):
    grouped=defaultdict(list)
    reader=csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    for x in reader:
        try:
            lat=float(x["Latitude_Precipitation(degree)"]); lon=float(x["Longitude_Precipitation(degree)"])
            elev=float(x["Altitude_Precipitation(m)"])
        except (KeyError,TypeError,ValueError): continue
        start=x.get("Start Date",""); end=x.get("End Date","")
        if not start or start>END or (end and end<START): continue
        if x.get("Precipitation")!="1" or x.get("Temperature")!="1": continue
        sid=x.get("Station Number","")
        if not sid: continue
        grouped[sid].append({
          "startDate":start,"endDate":end,"latitude":lat,"longitude":lon,"elevationM":elev,
          "precipitationCapability":x.get("Precipitation"),"temperatureCapability":x.get("Temperature"),
          "precipitationDisconnectionFlag":x.get("Disconnection of Precipitation"),
          "temperatureDisconnectionFlag":x.get("Disconnection of Temperature"),
          "windSpeedHeightM":x.get("Height of Anemometer")
        })
    stations=[]
    for sid,segments in grouped.items():
        segments.sort(key=lambda x:x["startDate"])
        overlapping=[s for s in segments if s["startDate"]<=END and (not s["endDate"] or s["endDate"]>=START)]
        if not overlapping: continue
        # Prefer the latest segment overlapping the target normal period for the representative location.
        rep=overlapping[-1]
        stations.append({
          "stationId":sid,"name":None,"nameJa":None,
          "latitude":rep["latitude"],"longitude":rep["longitude"],"elevationM":rep["elevationM"],
          "historySegments":overlapping,
          "historyStart":min(s["startDate"] for s in overlapping),
          "historyEnd":max(s["endDate"] for s in overlapping),
          "hasAnySegmentOverlapping1991_2020":True,
          "catalogSource":"JMA AMeDAS Station Information History File (complete history dataset mirror)"
        })
    return stations

def build_candidates(queue, stations, limit=10):
    out=[]
    for region in queue.get("queue",[]):
        if region.get("countryCode")!="JP": continue
        ranked=[]
        for s in stations:
            # Score proximity against all historical station positions; retain closest relevant segment position.
            best=None
            for seg in s["historySegments"]:
                d=haversine_km(region["latitude"],region["longitude"],seg["latitude"],seg["longitude"])
                if d<=region.get("searchRadiusKm",100) and (best is None or d<best["distanceKm"]):
                    best={"distanceKm":d,"segment":seg}
            if best is None: continue
            ranked.append({**s,"latitude":best["segment"]["latitude"],"longitude":best["segment"]["longitude"],"elevationM":best["segment"]["elevationM"],"distanceKm":round(best["distanceKm"],2),"nearestHistorySegment":best["segment"]})
        ranked.sort(key=lambda x:(x["distanceKm"],x["stationId"]))
        out.append({"countryCode":"JP","subregionId":region["subregionId"],"subregionLabel":region["subregionLabel"],"representativeCourseId":region.get("representativeCourseId"),"candidateCountWithinRadius":len(ranked),"candidates":ranked[:limit],"status":"historical-metadata-candidates-only-daily-record-completeness-unverified","stationApproved":False,"weatherIngestionEnabled":False})
    return {"schemaVersion":2,"status":"jma-full-history-metadata-candidate-discovery-only","period":{"start":START,"end":END},"stationCatalogUrl":STATION_CSV_URL,"stationCatalogProvenance":"Complete JMA AMeDAS station-information history dataset mirror. Metadata must be cross-checked with original JMA amdmaster.index before approval.","selectionNotes":["Use full station history, not active stations only.","Preserve each historical station configuration and discontinuity flag.","A station is only a candidate if at least one precipitation+temperature configuration overlaps 1991-2020.","Do not infer daily PRCP/TMAX/TMIN record completeness from capability flags."],"summary":{"japanSubregions":len(out),"regionsWithCandidates":sum(bool(x["candidates"]) for x in out),"regionsWithoutCandidates":sum(not x["candidates"] for x in out),"candidateRows":sum(len(x["candidates"]) for x in out),"uniqueStations":len(stations),"approvedStations":0,"dailyRecordsDownloaded":0},"regions":out}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--queue",default="data/observation-stations/jp-kr-official-acquisition-queue.json")
    ap.add_argument("--output",default="data/observation-stations/jma-station-candidates-1991-2020.json")
    ap.add_argument("--catalog",default="")
    ap.add_argument("--top-n",type=int,default=10)
    a=ap.parse_args()
    if a.catalog: raw=Path(a.catalog).read_text(encoding="utf-8-sig")
    else:
        req=urllib.request.Request(STATION_CSV_URL,headers={"User-Agent":"AsiaGolfClimateResearch/1.0"})
        with urllib.request.urlopen(req,timeout=45) as r: raw=r.read().decode("utf-8-sig")
    result=build_candidates(json.loads(Path(a.queue).read_text(encoding="utf-8")),parse_stations(raw),a.top_n)
    p=Path(a.output);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result["summary"],ensure_ascii=False))
if __name__=="__main__": main()
