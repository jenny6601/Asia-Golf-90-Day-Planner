#!/usr/bin/env python3
"""Rank Korean KMA ASOS metadata candidates for six golf-climate regions.

Input is the official KMA 관측지점정보 CSV export. Metadata overlap is a
screening proxy only; daily PRCP/TMAX/TMIN completeness must be audited later.
"""
import argparse, csv, io, json, math, re
from collections import defaultdict
from datetime import date
from pathlib import Path

START = date(1991, 1, 1)
END = date(2020, 12, 31)
PERIOD_DAYS = (END - START).days + 1
START_YEAR, END_YEAR = START.year, END.year
FILESET_RE = re.compile(r'SURFACE_ASOS_(\d+)_(\w+)_(\d{4})_(\d{4})_(\d{4})\.ZIP', re.IGNORECASE)

ALIASES = {
    "station_id": ["지점번호", "표준지점번호", "기관지점번호", "지점"],
    "name": ["지점명", "지점명(한글)", "관측지점명"],
    "start": ["시작일", "관측개시일", "관측시작일"],
    "end": ["종료일", "관측종료일"],
    "lat": ["위도", "latitude"],
    "lon": ["경도", "longitude"],
    "elevation": ["노장 해발고도(m)", "해발고도(m)", "고도", "elevation"],
    "type": ["지점유형", "관측종류", "관측망", "관측망구분", "장비구분", "장비명"],
}

def pick(row, key, required=False):
    for name in ALIASES[key]:
        if name in row and str(row[name]).strip():
            return str(row[name]).strip()
    if required:
        raise ValueError(f"Missing required KMA CSV column for {key}; expected one of {ALIASES[key]}")
    return ""

def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lon2-lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(math.sqrt(a))

def parse_inventory(csv_text):
    grouped = defaultdict(list)
    reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
    if not reader.fieldnames:
        raise ValueError("KMA station metadata CSV has no header")
    type_columns = [name for name in ALIASES["type"] if name in reader.fieldnames]
    if not type_columns:
        raise ValueError("KMA metadata CSV must include an explicit observation-network/type column; refusing to infer ASOS from an unclassified inventory")
    for row in reader:
        try:
            sid = pick(row, "station_id", True)
            lat, lon = float(pick(row, "lat", True)), float(pick(row, "lon", True))
            start = date.fromisoformat(pick(row, "start", True)[:10])
            end_text = pick(row, "end")
            end = date.fromisoformat(end_text[:10]) if end_text else END
        except (ValueError, TypeError):
            continue
        stype = pick(row, "type")
        # Fail closed: blank or non-ASOS network labels must never enter the ASOS shortlist.
        normalized_type = stype.upper().replace(" ", "")
        if not normalized_type or not ("ASOS" in normalized_type or "종관" in normalized_type):
            continue
        lo, hi = max(start, START), min(end, END)
        if lo > hi:
            continue
        grouped[sid].append({
            "stationId": sid, "name": pick(row, "name"),
            "latitude": lat, "longitude": lon,
            "elevationM": float(pick(row, "elevation")) if pick(row, "elevation") else None,
            "start": lo.isoformat(), "end": hi.isoformat(),
            "overlapDays": (hi-lo).days+1, "network": stype or "ASOS metadata export"
        })
    return grouped


def parse_asos_day_catalog(catalog_text):
    """Parse KMA annual file-set catalog; retain only ASOS DAY archives."""
    matches = FILESET_RE.findall(catalog_text.upper())
    if not matches:
        raise ValueError("KMA ASOS file-set catalog contains no recognized SURFACE_ASOS filenames")
    years_by_station = defaultdict(set)
    files_by_station = defaultdict(set)
    for station_id, data_type, first_year, last_year, generated_year in matches:
        if data_type != "DAY":
            continue
        lo, hi = max(int(first_year), START_YEAR), min(int(last_year), END_YEAR)
        if lo > hi:
            continue
        years_by_station[station_id].update(range(lo, hi + 1))
        files_by_station[station_id].add(
            f"SURFACE_ASOS_{station_id}_DAY_{first_year}_{last_year}_{generated_year}.ZIP"
        )
    if not years_by_station:
        raise ValueError("KMA catalog has no DAY archives overlapping 1991-2020")
    return {
        sid: {"dayYears": sorted(years), "dayYearCount": len(years),
              "dayFileCount": len(files_by_station[sid])}
        for sid, years in years_by_station.items()
    }

def merge_coverage(configs):
    # Merge date intervals to avoid double-counting overlapping coordinate histories.
    intervals = sorted((date.fromisoformat(x["start"]), date.fromisoformat(x["end"])) for x in configs)
    merged = []
    for lo, hi in intervals:
        if not merged or (lo - merged[-1][1]).days > 1:
            merged.append([lo, hi])
        elif hi > merged[-1][1]:
            merged[-1][1] = hi
    return sum((b-a).days+1 for a,b in merged)

def rank_candidates(regions, stations, catalog, top_n=10, radius_km=100):
    output=[]
    for region in regions:
        ranked=[]
        for sid, configs in stations.items():
            if sid not in catalog:
                continue
            days=merge_coverage(configs)
            catalog_info = catalog[sid]
            # Use latest valid in-period coordinate configuration for distance.
            cfg=max(configs, key=lambda x: x["end"])
            distance=haversine_km(float(region["latitude"]), float(region["longitude"]), cfg["latitude"], cfg["longitude"])
            if distance > radius_km:
                continue
            ranked.append({
                "stationId":sid,"stationName":cfg["name"],"latitude":cfg["latitude"],
                "longitude":cfg["longitude"],"elevationM":cfg["elevationM"],
                "distanceKm":round(distance,2),"metadataCoverageDays":days,
                "metadataCoverageRatio":round(days/PERIOD_DAYS,4),
                "catalogDayYears":catalog_info["dayYears"],
                "catalogDayYearCount":catalog_info["dayYearCount"],
                "catalogDayYearCoverageRatio":round(catalog_info["dayYearCount"]/30,4),
                "catalogDayFileCount":catalog_info["dayFileCount"],
                "historyConfigurations":len(configs),
                "coordinateChanges":max(0,len({(x["latitude"],x["longitude"]) for x in configs})-1),
                "network":cfg["network"],"dailyRecordCompleteness":"not-yet-verified",
                "stationApproved":False,"weatherIngestionEnabled":False
            })
        ranked.sort(key=lambda x:(-x["metadataCoverageDays"], x["distanceKm"], x["stationId"]))
        output.append({
            "countryCode":"KR","subregionId":region["subregionId"],
            "subregionLabel":region["subregionLabel"],
            "representativeCourseId":region.get("representativeCourseId"),
            "candidates":ranked[:top_n],
            "candidateCountWithinRadius":len(ranked),
            "status":"metadata-candidates-only" if ranked else "no-candidate-within-radius"
        })
    return {
        "schemaVersion":1,"countryCode":"KR","source":"KMA official 관측지점정보 CSV",
        "period":{"start":"1991-01-01","end":"2020-12-31"},
        "ranking":"official ASOS DAY catalog membership required; then metadata coverage and distance. Catalog year presence does not imply element completeness.",
        "summary":{"regions":len(output),"regionsWithCandidates":sum(bool(x["candidates"]) for x in output),
                   "catalogStationsWithDayFiles":len(catalog),
                   "candidateRows":sum(len(x["candidates"]) for x in output),
                   "approvedStations":0,"dailyRecordsDownloaded":0},
        "regions":output
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--inventory",required=True,help="Official KMA station metadata CSV export")
    ap.add_argument("--asos-file-catalog",required=True,help="Official KMA ASOS file-set catalog export")
    ap.add_argument("--queue",default="data/observation-stations/jp-kr-official-acquisition-queue.json")
    ap.add_argument("--output",default="data/observation-stations/kma-asos-candidates-1991-2020.json")
    ap.add_argument("--top-n",type=int,default=10)
    ap.add_argument("--radius-km",type=float,default=100)
    a=ap.parse_args()
    q=json.loads(Path(a.queue).read_text(encoding="utf-8"))
    regions=[{"subregionId":x["subregionId"],"subregionLabel":x["subregionLabel"],
              "representativeCourseId":x.get("representativeCourseId"),
              "latitude":x["latitude"],"longitude":x["longitude"]}
             for x in q["queue"] if x["countryCode"]=="KR"]
    stations=parse_inventory(Path(a.inventory).read_text(encoding="utf-8-sig"))
    catalog=parse_asos_day_catalog(Path(a.asos_file_catalog).read_text(encoding='utf-8-sig'))
    result=rank_candidates(regions,stations,catalog,a.top_n,a.radius_km)
    p=Path(a.output);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result["summary"],ensure_ascii=False))

if __name__=="__main__":
    main()
