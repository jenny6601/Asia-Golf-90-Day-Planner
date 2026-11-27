#!/usr/bin/env python3
"""Rank JMA AMeDAS station candidates against Japan golf-cluster points.

Station metadata mirror is derived from JMA AMeDAS station information history.
It is discovery-only; daily element completeness must be verified from JMA records.
"""
import argparse, csv, io, json, math, urllib.request
from pathlib import Path

STATION_CSV_URL="https://raw.githubusercontent.com/code4fukui/jma_station/main/jma_station_active.csv"
START="1991-01-01"; END="2020-12-31"

def haversine_km(a,b,c,d):
    r=6371.0088
    p1,p2=math.radians(float(a)),math.radians(float(c))
    dp=math.radians(float(c)-float(a)); dl=math.radians(float(d)-float(b))
    h=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(h))

def parse_stations(text):
    rows=[]
    reader=csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    for x in reader:
        try:
            lat=float(x["Latitude_Precipitation(degree)"]); lon=float(x["Longitude_Precipitation(degree)"])
            elev=float(x["Altitude_Precipitation(m)"])
        except (KeyError,TypeError,ValueError): continue
        start=x.get("Start Date",""); end=x.get("End Date","")
        if not start or start>END or (end and end<START): continue
        if x.get("Precipitation")!="1" or x.get("Temperature")!="1": continue
        rows.append({"stationId":x.get("Station Number",""),"name":x.get("Station Name",""),"nameJa":x.get("Station Name(Kanji)",""),"latitude":lat,"longitude":lon,"elevationM":elev,"startDate":start,"endDate":end,"precipitationCapability":x.get("Precipitation"),"temperatureCapability":x.get("Temperature"),"catalogSource":"JMA AMeDAS station information history file via code4fukui/jma_station active mirror"})
    return rows

def build_candidates(queue, stations, limit=10):
    out=[]
    for region in queue.get("queue",[]):
        if region.get("countryCode")!="JP": continue
        ranked=[]
        for s in stations:
            dist=haversine_km(region["latitude"],region["longitude"],s["latitude"],s["longitude"])
            if dist>region.get("searchRadiusKm",100): continue
            ranked.append({**s,"distanceKm":round(dist,2)})
        ranked.sort(key=lambda x:(x["distanceKm"],x["stationId"]))
        out.append({"countryCode":"JP","subregionId":region["subregionId"],"subregionLabel":region["subregionLabel"],"representativeCourseId":region.get("representativeCourseId"),"candidateCountWithinRadius":len(ranked),"candidates":ranked[:limit],"status":"metadata-candidates-only-no-daily-record-verification","stationApproved":False,"weatherIngestionEnabled":False})
    return {"schemaVersion":1,"status":"jma-metadata-candidate-discovery-only","period":{"start":START,"end":END},"stationCatalogUrl":STATION_CSV_URL,"stationCatalogProvenance":"Third-party machine-readable mirror derived from JMA AMeDAS station information history file; verify candidate metadata against JMA source before approval.","summary":{"japanSubregions":len(out),"regionsWithCandidates":sum(bool(x["candidates"]) for x in out),"regionsWithoutCandidates":sum(not x["candidates"] for x in out),"candidateRows":sum(len(x["candidates"]) for x in out),"approvedStations":0,"dailyRecordsDownloaded":0},"regions":out}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--queue",default="data/observation-stations/jp-kr-official-acquisition-queue.json")
    ap.add_argument("--output",default="data/observation-stations/jma-station-candidates-1991-2020.json")
    ap.add_argument("--catalog",default="")
    a=ap.parse_args()
    if a.catalog: raw=Path(a.catalog).read_text(encoding="utf-8-sig")
    else:
        req=urllib.request.Request(STATION_CSV_URL,headers={"User-Agent":"AsiaGolfClimateResearch/1.0"})
        with urllib.request.urlopen(req,timeout=45) as r: raw=r.read().decode("utf-8-sig")
    result=build_candidates(json.loads(Path(a.queue).read_text(encoding="utf-8")),parse_stations(raw))
    p=Path(a.output);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result["summary"],ensure_ascii=False))
if __name__=="__main__": main()
