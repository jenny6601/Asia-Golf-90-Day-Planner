#!/usr/bin/env python3
"""Discover GHCN-Daily station candidates near the 80 regional climate points.

Downloads only NOAA's public metadata inventories, never observation values.
Country membership is resolved from NOAA's own country-codes file; nearest
stations are ranked, not auto-approved. No fixed distance cutoff is applied.
"""
from __future__ import annotations
import argparse,csv,json,math,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE="https://www.ncei.noaa.gov/pub/data/ghcn/daily/"
FILES={"stations":"ghcnd-stations.txt","inventory":"ghcnd-inventory.txt","countries":"ghcnd-countries.txt"}
ALIASES={"JP":["japan"],"KR":["south korea","republic of korea","korea, republic of","korea, south"],"CN":["china"],"VN":["vietnam"],"TH":["thailand"],"MY":["malaysia"],"SG":["singapore"],"ID":["indonesia"]}
def fetch(name,timeout=90):
    req=urllib.request.Request(BASE+FILES[name],headers={"User-Agent":"Asia-Golf-Climate-Research/1.0"})
    with urllib.request.urlopen(req,timeout=timeout) as response:
        return response.read().decode("ascii",errors="replace")
def parse_countries(raw):
    result={}
    for line in raw.splitlines():
        if len(line)>=3:
            code=line[:2].strip();name=line[3:].strip()
            if code and name:result[code]=name
    return result
def parse_stations(raw):
    out={}
    for line in raw.splitlines():
        if len(line)<68:continue
        sid=line[:11].strip()
        try:lat=float(line[12:20]);lon=float(line[21:30]);elev=float(line[31:37].strip() or "nan")
        except ValueError:continue
        out[sid]={"stationId":sid,"countryCode":sid[:2],"latitude":lat,"longitude":lon,
          "elevationM":None if not math.isfinite(elev) else elev,"name":line[41:71].strip(),
          "gsnFlag":line[72:75].strip() or None,"hcnFlag":line[76:79].strip() or None,"wmoId":line[80:85].strip() or None}
    return out
def parse_inventory(raw):
    out={}
    for line in raw.splitlines():
        if len(line)<22:continue
        sid=line[:11].strip();element=line[31:35].strip()
        try:start=int(line[36:40]);end=int(line[41:45])
        except ValueError:continue
        out.setdefault(sid,{})[element]={"startYear":start,"endYear":end,"overlap1991_2020Years":max(0,min(end,2020)-max(start,1991)+1)}
    return out
def haversine_km(a,b):
    r=6371.0088;p1=math.radians(a["latitude"]);p2=math.radians(b["latitude"])
    dp=p2-p1;dl=math.radians(b["longitude"]-a["longitude"])
    q=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(q))
def country_codes(country_names):
    normalized={name.casefold():code for code,name in country_names.items()}
    result={}
    for code,aliases in ALIASES.items():
        for alias in aliases:
            if alias.casefold() in normalized:result[code]=normalized[alias.casefold()]
    missing=set(ALIASES)-set(result)
    if missing:raise ValueError("NOAA country code mapping missing for: "+",".join(sorted(missing)))
    return result
def build_candidates(points,countries,stations,inventory,top_n=10):
    mapping=country_codes(countries);out=[]
    for point in points:
        code=mapping[point["countryCode"]];ranked=[]
        for sid,st in stations.items():
            if st["countryCode"]!=code:continue
            elems=inventory.get(sid,{})
            overlap={e:v for e,v in elems.items() if v["overlap1991_2020Years"]>0}
            if not overlap:continue
            ranked.append({"stationId":sid,"name":st["name"],"latitude":st["latitude"],"longitude":st["longitude"],
              "elevationM":st["elevationM"],"distanceKm":round(haversine_km(point["representativePoint"],st),2),
              "gsnFlag":st["gsnFlag"],"hcnFlag":st["hcnFlag"],"wmoId":st["wmoId"],
              "elements":overlap,"stationHistoryReview":"required","representativenessReview":"required","autoSelected":False})
        ranked.sort(key=lambda x:x["distanceKm"])
        out.append({"countryCode":point["countryCode"],"subregionId":point["subregionId"],
          "representativePoint":point["representativePoint"],"candidateCount":len(ranked),
          "nearestCandidates":ranked[:top_n],"status":"candidates-only-not-validated" if ranked else "no-ghcnd-candidate-with-1991-2020-overlap"})
    return {"schemaVersion":1,"status":"ghcnd-station-candidate-discovery-not-validation",
      "sourceId":"NOAA_GHCN_DAILY_METADATA","sourceBaseUrl":BASE,"referencePeriod":{"startYear":1991,"endYear":2020},
      "rules":["NOAA country code mapping is used; do not infer country from station name.","Rank nearest candidates but do not auto-select the nearest station.","Only stations with at least one inventory element overlapping 1991-2020 are listed.","Review per-element coverage, station history, elevation and coastal/mountain representativeness before pairing.","No fixed distance cutoff is applied; distance is a ranking signal, not an automatic rejection."],
      "stationCount":len(stations),"inventoryStationCount":len(inventory),"regions":out,
      "summary":{"regionCount":len(out),"regionsWithCandidates":sum(bool(x["nearestCandidates"]) for x in out),
        "regionsWithoutCandidates":sum(not x["nearestCandidates"] for x in out),"candidateStationRows":sum(len(x["nearestCandidates"]) for x in out)}}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--output",default="data/observation-stations/ghcnd-candidates-1991-2020.json");ap.add_argument("--top-n",type=int,default=10);ap.add_argument("--input-dir",type=Path);args=ap.parse_args()
    if args.top_n<1:ap.error("--top-n must be >= 1")
    if args.input_dir:
        raw={k:(args.input_dir/FILES[k]).read_text(encoding="ascii",errors="replace") for k in FILES}
    else:raw={k:fetch(k) for k in FILES}
    countries=parse_countries(raw["countries"]);stations=parse_stations(raw["stations"]);inventory=parse_inventory(raw["inventory"])
    registry=json.loads((ROOT/"data/era5-land-eight-country-1991-2020/representative-point-quality-audit.json").read_text(encoding="utf-8"))
    report=build_candidates(registry["points"],countries,stations,inventory,args.top_n)
    report["retrievedAtUtc"]=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    target=ROOT/args.output;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report["summary"],ensure_ascii=False,indent=2))
if __name__=="__main__":main()
