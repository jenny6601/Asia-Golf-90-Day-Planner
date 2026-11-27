#!/usr/bin/env python3
"""Build a JP/KR official station-data acquisition queue from approved regional points."""
import argparse, json
from pathlib import Path

SOURCE_RULES = {
 "JP": {"agency":"Japan Meteorological Agency (JMA)","portal":"https://www.data.jma.go.jp/risk/obsdl/","dailyElements":["daily precipitation total","daily maximum temperature","daily minimum temperature"],"accessMode":"official web CSV download; request size limited; no bulk scraping","period":"1991-2020","notes":["JMA provides daily values and 1991-2020 normals.","JMA flags records affected by >20% missing source data and non-homogeneous periods due to relocation/environment/observation changes; preserve these indicators.","JMA warns against excessive automated access; acquire bounded station/date requests only."]},
 "KR": {"agency":"Korea Meteorological Administration (KMA)","portal":"https://data.kma.go.kr/data/grnd/selectAsosRltmList.do","fileSetPortal":"https://data.kma.go.kr/data/grnd/selectAsosList.do?pgmNo=34","dailyElements":["daily precipitation","daily maximum temperature","daily minimum temperature"],"accessMode":"official portal CSV or annual ASOS file-set downloads; API registration may be required for automated access","period":"1991-2020","notes":["ASOS provides daily data from 1904 onward depending on station and element; current portal lists 105 stations.","A single daily-data query is limited to 10 years; long periods should use file-set downloads.","Check station-specific start/end years and QC/metadata before matching."]}
}

def build_queue(config):
    queue=[]
    for country in config.get("countries",[]):
        code=country.get("countryCode")
        if code not in SOURCE_RULES: continue
        for region in country.get("subregions",[]):
            point=region.get("candidateCoordinates") or region.get("representativeCoordinates") or {}
            lat=point.get("latitude"); lon=point.get("longitude")
            if lat is None or lon is None: continue
            queue.append({
                "countryCode":code,"subregionId":region.get("id"),"subregionLabel":region.get("label") or region.get("subregion"),
                "representativeCourseId":region.get("representativeCourseId") or region.get("candidateCourseId"),
                "latitude":lat,"longitude":lon,"timezone":point.get("timezone"),
                "source":SOURCE_RULES[code],"searchRadiusKm":100,
                "stationMatchStatus":"not-yet-matched","dailyRecordsDownloaded":False,
                "stationApproved":False,"weatherIngestionEnabled":False,
                "requiredReview":["station distance and elevation","1991-2020 PRCP/TMAX/TMIN element availability","daily record completeness by year and season","quality flags and missing-value conventions","station relocation/history and observation-day definition","coastal/mountain/urban representativeness","licence and permitted use"]
            })
    return {"schemaVersion":1,"status":"official-jp-kr-acquisition-queue-not-station-matches","period":{"start":"1991-01-01","end":"2020-12-31"},"selectionRule":"One queue item per golf-course-cluster representative point; other courses in the same cluster share its regional climate assessment.","sources":SOURCE_RULES,"summary":{"queueItems":len(queue),"JP":sum(x["countryCode"]=="JP" for x in queue),"KR":sum(x["countryCode"]=="KR" for x in queue),"matchedStations":0,"approvedStations":0},"queue":queue}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",default="config/global/weather-subregions.json")
    ap.add_argument("--output",default="data/observation-stations/jp-kr-official-acquisition-queue.json")
    args=ap.parse_args()
    result=build_queue(json.loads(Path(args.input).read_text(encoding="utf-8")))
    target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result["summary"],ensure_ascii=False))
if __name__=="__main__": main()
