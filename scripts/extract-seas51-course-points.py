#!/usr/bin/env python3
"""Extract member-level SEAS5.1 values at configured course-nearest grid points.

This is a spatial extraction pilot only. It does not turn instantaneous tp into
an accumulation and does not establish forecast skill.
"""
import csv, json, math
from datetime import datetime, timezone
from pathlib import Path
from eccodes import codes_get, codes_grib_find_nearest, codes_grib_new_from_file, codes_release

GRIB=Path("artifacts/seas51-2016-01-01-lead408-426-okinawa.grib")
COURSES=Path("config/global/courses.json")
OUT=Path("artifacts/seas51-course-point-extract.csv")
MANIFEST=Path("artifacts/seas51-course-point-extract-manifest.json")
MAX_DISTANCE_KM=35.0

def get(g,key):
    try: return codes_get(g,key)
    except Exception: return None

def haversine(lat1,lon1,lat2,lon2):
    p1,p2=math.radians(lat1),math.radians(lat2)
    dp=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 6371.0088*2*math.asin(math.sqrt(a))

def nearest_grid(g,lat,lon):
    # ecCodes native nearest-point API returns (lat, lon, value, distance_km, index).
    nearest=codes_grib_find_nearest(g,lat,lon,is_lsm=False,npoints=1)
    if not nearest:
        raise RuntimeError("ecCodes returned no nearest grid point")
    # ecCodes Python versions expose one nearest point in three forms:
    # a flat 5-tuple, a tuple/list of point tuples, or a tuple containing
    # a dict with lat/lon/value/distance/index keys.
    first=nearest[0] if isinstance(nearest,(tuple,list)) and len(nearest)>0 else None
    if isinstance(first,dict):
        point=first
        grid_lat=point["lat"]; grid_lon=point["lon"]
        value=point["value"]; distance_km=point["distance"]
    elif len(nearest)>=5 and not isinstance(first,(tuple,list,dict)):
        grid_lat,grid_lon,value,distance_km,_index=nearest[:5]
    elif isinstance(first,(tuple,list)) and len(first)>=5:
        grid_lat,grid_lon,value,distance_km,_index=first[:5]
    else:
        raise RuntimeError("Unexpected nearest-point result shape: " + repr(nearest)[:300])
    return float(distance_km),float(grid_lat),float(grid_lon),float(value)

def main():
    if not GRIB.exists(): raise SystemExit(f"Missing GRIB: {GRIB}")
    courses=json.loads(COURSES.read_text(encoding="utf-8"))
    targets=[c for c in courses if c.get("countryCode")=="JP" and
      isinstance(c.get("latitude"),(int,float)) and isinstance(c.get("longitude"),(int,float))]
    rows=[]; counts={}; spatial_failures={}; distance_flags={"within_35km":0,"over_35km":0}
    with GRIB.open("rb") as stream:
        while (gid:=codes_grib_new_from_file(stream)) is not None:
            try:
                variable=get(gid,"shortName")
                lead=get(gid,"endStep")
                if lead is None: lead=get(gid,"stepRange")
                if isinstance(lead,str) and "-" in lead: lead=lead.split("-")[-1]
                try: lead=int(lead)
                except (TypeError,ValueError): continue
                member=get(gid,"number")
                init_date=get(gid,"dataDate"); init_time=get(gid,"dataTime")
                valid_date=get(gid,"validityDate"); valid_time=get(gid,"validityTime")
                unit=get(gid,"units"); step_type=get(gid,"stepType")
                step_range=get(gid,"stepRange")
                for course in targets:
                    try:
                        nearest=nearest_grid(gid,course["latitude"],course["longitude"])
                    except Exception as exc:
                        key=course["id"]
                        failure=spatial_failures.setdefault(key,{"count":0,"errorTypes":{}})
                        failure["count"]+=1
                        error_type=type(exc).__name__
                        failure["errorTypes"][error_type]=failure["errorTypes"].get(error_type,0)+1
                        continue
                    distance,grid_lat,grid_lon,raw=nearest
                    distance_flags["within_35km" if distance<=MAX_DISTANCE_KM else "over_35km"]+=1
                    value=raw; output_unit=unit
                    if variable=="2t" and unit=="K":
                        value=raw-273.15; output_unit="degC"
                    rows.append({
                      "countryCode":course["countryCode"],"courseId":course["id"],
                      "courseName":course["name"],"coordinateStatus":course.get("coordinateStatus"),
                      "coordinateSource":course.get("coordinateSource"),
                      "courseLatitude":course["latitude"],"courseLongitude":course["longitude"],
                      "gridLatitude":grid_lat,"gridLongitude":grid_lon,
                      "nearestGridDistanceKm":round(distance,3),
                      "spatialDistanceFlag":"within-35km" if distance<=MAX_DISTANCE_KM else "over-35km-review",
                      "initializationDate":init_date,"initializationTime":init_time,
                      "validDate":valid_date,"validTime":valid_time,"leadHour":lead,
                      "ensembleMember":member,"variable":variable,
                      "rawValue":raw,"value":value,"unit":output_unit,
                      "originalUnit":unit,"stepType":step_type,"stepRange":step_range,
                      "interpretation":"instantaneous_precipitation_field_not_accumulation" if variable=="tp" else "instantaneous_model_field"
                    })
                    counts[(variable,lead)]=counts.get((variable,lead),0)+1
            finally: codes_release(gid)
    fields=list(rows[0]) if rows else []
    OUT.parent.mkdir(parents=True,exist_ok=True)
    with OUT.open("w",newline="",encoding="utf-8") as f:
        writer=csv.DictWriter(f,fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    report={
      "createdUtc":datetime.now(timezone.utc).isoformat(),
      "input":str(GRIB),"courseCatalogue":str(COURSES),
      "courseCountWithCoordinates":len(targets),
      "coursesUsed":[{"id":c["id"],"coordinateStatus":c.get("coordinateStatus")} for c in targets],
      "coursesSkippedMissingCoordinates":[c["id"] for c in courses if c.get("countryCode")=="JP" and (c.get("latitude") is None or c.get("longitude") is None)],
      "distanceReviewThresholdKm":MAX_DISTANCE_KM,
      "distanceFlags":distance_flags,
      "spatialFailuresByCourse":spatial_failures,
      "outputRows":len(rows),
      "rowCountsByVariableAndLead":{f"{k[0]}_{k[1]}":v for k,v in sorted(counts.items())},
      "limitations":[
        "Five course coordinates are provisional; extracted values inherit that location uncertainty.",
        "PGM Okinawa is omitted because its course coordinates are not verified.",
        "Nearest grid point is a grid-cell proxy, not a course-wide spatial average.",
        "All returned nearest points are retained regardless of distance; distances over 35 km are flagged for review, not silently discarded.",
        "Courses outside the GRIB grid are reported as spatial failures and are not assigned fabricated values.",
        "tp is retained only as the GRIB instantaneous field; it is not converted to rainfall accumulation.",
        "One initialization cannot support forecast-skill verification or bias calibration."
      ]
    }
    MANIFEST.write_text(json.dumps(report,indent=2,default=str)+"\n",encoding="utf-8")
    print(json.dumps(report,indent=2,default=str))
if __name__=="__main__": main()
