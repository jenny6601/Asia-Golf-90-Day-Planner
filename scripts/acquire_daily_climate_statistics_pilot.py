#!/usr/bin/env python3
"""Build and optionally acquire daily-only ERA5 single-level statistics.

ERA5 is the sole reanalysis source in this pilot. No ERA5-Land requests and no
hourly time-series files are downloaded. CDS computes daily aggregates before
returning NetCDF files.
"""
from __future__ import annotations
import argparse, importlib.util, json, math, os, sys, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATASET="derived-era5-single-levels-daily-statistics"
TEMPERATURE=["2m_temperature"]
DAILY_MEAN=["2m_dewpoint_temperature","10m_u_component_of_wind","10m_v_component_of_wind","total_cloud_cover","mean_sea_level_pressure"]
PRECIPITATION=["total_precipitation"]

def compile_registry():
    spec=importlib.util.spec_from_file_location("climate_registry",ROOT/"scripts/build_eight_country_climate_registry.py")
    mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    def read(p): return json.loads((ROOT/p).read_text(encoding="utf-8"))
    return mod.compile_registry(read("config/global/countries.json"),read("config/global/weather-subregions.json"),read("config/global/courses.json"))

def utc_offset(timezone):
    offsets={"Asia/Tokyo":"utc+09:00","Asia/Seoul":"utc+09:00","Asia/Shanghai":"utc+08:00","Asia/Ho_Chi_Minh":"utc+07:00","Asia/Bangkok":"utc+07:00","Asia/Kuala_Lumpur":"utc+08:00","Asia/Singapore":"utc+08:00","Asia/Jakarta":"utc+07:00","Asia/Makassar":"utc+08:00","Asia/Jayapura":"utc+09:00"}
    if timezone not in offsets: raise ValueError(f"Unsupported or unreviewed fixed UTC offset for {timezone}")
    return offsets[timezone]

def _saturation_vapor_pressure_hpa(temp_c):
    return 6.105 * math.exp(17.27 * temp_c / (237.7 + temp_c))

def _apparent_temperature_c(air_temp_c, dewpoint_c, wind_speed_ms):
    """Shade apparent temperature; daily aggregate inputs are not time-paired."""
    if air_temp_c <= 10.0 and wind_speed_ms * 3.6 >= 4.8:
        wind_kmh=wind_speed_ms * 3.6
        v16=wind_kmh ** 0.16
        return 13.12 + 0.6215*air_temp_c - 11.37*v16 + 0.3965*air_temp_c*v16, "wind-chill"
    vapor_pressure=min(_saturation_vapor_pressure_hpa(dewpoint_c),
                       _saturation_vapor_pressure_hpa(air_temp_c))
    return air_temp_c + 0.33*vapor_pressure - 0.70*wind_speed_ms - 4.0, "apparent-temperature"

def calculate_feels_like_range(tmin_c, tmax_c, dewpoint_c, wind_u_ms, wind_v_ms):
    """Return a daily feels-like low/high estimate, never a mean temperature.

    Daily dewpoint and wind aggregates are not coincident with Tmin/Tmax.
    The output is therefore a broad daily estimate, not an hourly or observed
    apparent temperature. Solar radiation is not represented by this shade
    formula and must remain an explicit limitation.
    """
    values=(tmin_c,tmax_c,dewpoint_c,wind_u_ms,wind_v_ms)
    if any(v is None or isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):
        return {"feelsLikeMinEstimateC":None,"feelsLikeMaxEstimateC":None,
                "method":"unavailable-missing-input","qualityFlags":["missing-required-input"]}
    if tmin_c>tmax_c or wind_u_ms < -100 or wind_u_ms > 100 or wind_v_ms < -100 or wind_v_ms > 100:
        raise ValueError("invalid temperature bounds or wind components")
    wind_speed=math.hypot(wind_u_ms,wind_v_ms)
    low,low_method=_apparent_temperature_c(float(tmin_c),float(dewpoint_c),wind_speed)
    high,high_method=_apparent_temperature_c(float(tmax_c),float(dewpoint_c),wind_speed)
    flags=["daily-aggregate-inputs-not-time-paired","shade-apparent-temperature-no-direct-solar-load"]
    if dewpoint_c>tmin_c:
        flags.append("dewpoint-exceeds-daily-min-temperature-after-aggregation")
    return {"feelsLikeMinEstimateC":round(low,1),"feelsLikeMaxEstimateC":round(high,1),
            "method":"daily-apparent-temperature-range","lowMethod":low_method,
            "highMethod":high_method,"windSpeedUsedMs":round(wind_speed,2),
            "qualityFlags":flags}

def build_requests(point,year,frequency="1_hourly"):
    if not 1940<=year<=2025: raise ValueError("pilot year must be between 1940 and 2025")
    tz=utc_offset(point["timezone"])
    grid=point["gridMapping"]; lat=float(grid["candidateLatitude"]); lon=float(grid["candidateLongitude"])
    area=[round(min(90,lat+0.06),4),round(lon-0.06,4),round(max(-90,lat-0.06),4),round(lon+0.06,4)]
    common={"year":[str(year)],"month":[f"{m:02d}" for m in range(1,13)],"day":[f"{d:02d}" for d in range(1,32)],"time_zone":tz,"frequency":frequency,"area":area,"product_type":"reanalysis"}
    definitions=[
      ("daily_min",TEMPERATURE),
      ("daily_mean",DAILY_MEAN),
      ("daily_max",TEMPERATURE),
      ("daily_sum",PRECIPITATION),
    ]
    return [{"sourceId":"ERA5_DAILY_STATS","dataset":DATASET,"dailyStatistic":stat,
      "request":{**common,"variable":variables,"daily_statistic":stat}} for stat,variables in definitions]

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--subregion",required=True); p.add_argument("--year",type=int,default=1991)
    p.add_argument("--output-dir",default="data/daily-statistics-pilot"); p.add_argument("--dry-run",action="store_true")
    a=p.parse_args()
    reg=compile_registry(); point=next((x for x in reg["points"] if x["subregionId"]==a.subregion),None)
    if point is None: p.error(f"unknown or blocked subregion: {a.subregion}")
    try: requests=build_requests(point,a.year)
    except ValueError as e: p.error(str(e))
    manifest={"schemaVersion":2,"status":"daily-statistics-pilot-plan","subregionId":a.subregion,"timezone":point["timezone"],
      "representativePoint":point["representativePoint"],"year":a.year,"sourceId":"ERA5_DAILY_STATS","dataset":DATASET,
      "gridResolutionDegrees":0.25,"requests":requests,"downloadedHourlyData":False,"dailyOutputOnly":True,
      "era5LandUsed":False,"productionEligible":False,
      "notes":["ERA5 is the only reanalysis source in this plan.","CDS computes daily aggregates from its underlying hourly ERA5 fields; the returned files contain daily records, not hourly time series.","Daily Tmin/Tmax, daily mean dewpoint/wind/cloud inputs and daily accumulated precipitation are requested separately; daily mean air temperature is not requested.","ERA5 daily-statistics sampling frequency is configurable; 1_hourly is used to retain daily extrema, but no hourly output is downloaded."]}
    if a.dry_run:
        print(json.dumps({"status":"dry-run-no-network","requestCount":len(requests),"dailyOutputOnly":True,"era5LandUsed":False,"manifest":manifest},ensure_ascii=False)); return 0
    if not os.environ.get("CDSAPI_KEY") and not Path.home().joinpath(".cdsapirc").exists():
        print("CDS credentials missing; no request submitted.",file=sys.stderr); return 2
    try: import cdsapi
    except ImportError: print("Install requirements-data.txt.",file=sys.stderr); return 2
    out=ROOT/a.output_dir; out.mkdir(parents=True,exist_ok=True); results=[]
    try:
        client=cdsapi.Client()
        for item in requests:
            archive=out/f"{a.subregion}-{a.year}-ERA5-{item['dailyStatistic']}.zip"
            client.retrieve(item["dataset"],item["request"],str(archive))
            if not archive.exists() or archive.stat().st_size==0: raise RuntimeError(f"empty retrieval: {archive.name}")
            with zipfile.ZipFile(archive) as z:
                bad=z.testzip()
                if bad: raise RuntimeError(f"corrupt ZIP member {bad}")
                nc=[n for n in z.namelist() if n.lower().endswith(".nc")]
                if not nc: raise RuntimeError(f"no NetCDF files in {archive.name}")
            results.append({"sourceId":item["sourceId"],"dailyStatistic":item["dailyStatistic"],"archive":archive.name,"bytes":archive.stat().st_size,"netcdfFiles":nc})
        manifest["status"]="era5-daily-statistics-archives-retrieved-structural-check-only"
        manifest["results"]=results
        (out/f"{a.subregion}-{a.year}-ERA5-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"status":manifest["status"],"archives":len(results),"dailyOutputOnly":True,"era5LandUsed":False,"productionEligible":False},ensure_ascii=False)); return 0
    except Exception as e:
        print(f"ERA5 daily-statistics pilot failed: {e}",file=sys.stderr); return 3

if __name__=="__main__": raise SystemExit(main())
