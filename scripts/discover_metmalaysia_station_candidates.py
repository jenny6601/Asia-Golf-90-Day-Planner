#!/usr/bin/env python3
"""Rank official MET Malaysia station-location candidates near Malaysian golf clusters.

The ArcGIS layer is an official station-location inventory only. It does not
establish which historical elements or dates are available for each station.
No station is approved for climate validation by this script.
"""
from __future__ import annotations
import argparse,json,math,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LAYER="https://bpp1.met.gov.my/agssvr3/rest/services/Asas6/MapServer/2"
FIELDS="OBJECTID,ID,STN_NUM,STN_NAME,STATE,TYPE_,LONG_DD,LAT_DD"
def request_json(url,timeout=90):
    req=urllib.request.Request(url,headers={"User-Agent":"Asia-Golf-Climate-Research/1.0"})
    with urllib.request.urlopen(req,timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))
def fetch_stations():
    meta=request_json(LAYER+"?"+urllib.parse.urlencode({"f":"json"}))
    if meta.get("geometryType")!="esriGeometryPoint":
        raise ValueError("MET Malaysia layer is not a point station layer")
    query={"where":"1=1","outFields":FIELDS,"returnGeometry":False,"f":"json","resultRecordCount":1000}
    features=[];offset=0
    while True:
        query["resultOffset"]=offset
        payload=request_json(LAYER+"/query?"+urllib.parse.urlencode(query))
        if payload.get("error"):raise RuntimeError(str(payload["error"]))
        batch=payload.get("features",[])
        features.extend(batch)
        if not payload.get("exceededTransferLimit",False) or not batch:break
        offset+=len(batch)
    stations=[]
    for feature in features:
        a=feature.get("attributes") or {}
        try:lat=float(a["LAT_DD"]);lon=float(a["LONG_DD"])
        except (KeyError,TypeError,ValueError):continue
        if not math.isfinite(lat) or not math.isfinite(lon):continue
        stations.append({"objectId":a.get("OBJECTID"),"stationId":a.get("STN_NUM") or a.get("ID"),
          "name":a.get("STN_NAME"),"state":a.get("STATE"),"stationType":a.get("TYPE_"),
          "latitude":lat,"longitude":lon,"sourceId":"METMALAYSIA_ARCGIS_STATION_INVENTORY",
          "historicalElementsVerified":False,"observationPeriodVerified":False,"autoSelected":False})
    return stations,meta
def haversine_km(a,b):
    r=6371.0088;p1=math.radians(a["latitude"]);p2=math.radians(b["latitude"])
    dp=p2-p1;dl=math.radians(b["longitude"]-a["longitude"])
    q=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(q))
def build(points,stations,top_n=10):
    regions=[]
    for p in points:
        if p.get("countryCode")!="MY":continue
        ranked=[]
        for s in stations:
            row=dict(s);row.setdefault("autoSelected",False);row.setdefault("historicalElementsVerified",False);row.setdefault("observationPeriodVerified",False);row["distanceKm"]=round(haversine_km(p["representativePoint"],s),2)
            ranked.append(row)
        ranked.sort(key=lambda x:x["distanceKm"])
        within75=sum(x["distanceKm"]<=75 for x in ranked)
        regions.append({"countryCode":"MY","subregionId":p["subregionId"],
          "representativePoint":p["representativePoint"],"stationCount":len(ranked),
          "stationWithin50KmCount":sum(x["distanceKm"]<=50 for x in ranked),
          "stationWithin75KmCount":within75,"nearestStation":ranked[0] if ranked else None,
          "nearestCandidates":ranked[:top_n],
          "status":"official-location-candidates-awaiting-historical-data-verification" if ranked else "no-official-station-candidate"})
    return {"schemaVersion":1,"status":"metmalaysia-station-location-candidates-not-observation-validation",
      "sourceId":"METMALAYSIA_ARCGIS_STATION_INVENTORY","sourceUrl":LAYER,
      "sourceLayerName":"Stesen MET","stationTypes":["AWS","AWS - VAISALA","CLIMATOLOGICAL","RAINFALL"],
      "requiredNextChecks":["Obtain official station IDs and station-history/relocation records.","Request 1991-2020 daily PRCP, TMAX and TMIN availability for the nearest candidate stations.","Confirm each station's element-specific record length, daily completeness, QC policy and observation-day convention.","Check elevation and coastal/highland representativeness before approving a station."],
      "stationCount":len(stations),"regions":regions,
      "summary":{"malaysiaRegionCount":len(regions),"regionsWithOfficialStationCandidates":sum(bool(x["nearestCandidates"]) for x in regions),
        "regionsWithStationWithin75Km":sum(x["stationWithin75KmCount"]>0 for x in regions),
        "stationRows":sum(len(x["nearestCandidates"]) for x in regions)}}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--output",default="data/observation-stations/metmalaysia-candidates.json");ap.add_argument("--top-n",type=int,default=10);ap.add_argument("--input-json",type=Path);args=ap.parse_args()
    if args.top_n<1:ap.error("--top-n must be >=1")
    registry=json.loads((ROOT/"data/era5-land-eight-country-1991-2020/representative-point-quality-audit.json").read_text(encoding="utf-8"))
    if args.input_json:
        payload=json.loads(args.input_json.read_text(encoding="utf-8"));stations=payload["stations"];meta={}
    else:stations,meta=fetch_stations()
    report=build(registry["points"],stations,args.top_n);report["retrievedAtUtc"]=datetime.now(timezone.utc).isoformat()
    report["serviceLayerMaxRecordCount"]=meta.get("maxRecordCount")
    target=ROOT/args.output;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report["summary"],ensure_ascii=False,indent=2))
if __name__=="__main__":main()
