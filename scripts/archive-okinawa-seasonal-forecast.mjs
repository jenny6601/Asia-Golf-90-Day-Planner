import fs from "node:fs/promises";
import {validateSeasonalSnapshot} from "./okinawa-seasonal-forecast-schema.js";
const points=[
 {id:"north",label:"北部",place:"名護市",latitude:26.5916,longitude:127.9774},
 {id:"central",label:"中部",place:"沖繩市",latitude:26.3344,longitude:127.8056},
 {id:"south",label:"南部",place:"那霸市",latitude:26.2123,longitude:127.6792}
];
const endpoint="https://seasonal-api.open-meteo.com/v1/seasonal";
const weekly=["precipitation_mean","precipitation_anomaly","precipitation_efi","precipitation_anomaly_gt0","precipitation_anomaly_gt10","precipitation_anomaly_gt20","wind_speed_10m_mean","wind_speed_10m_anomaly","temperature_2m_mean","temperature_2m_anomaly"].join(",");
const monthly=["precipitation_mean","precipitation_anomaly","wind_speed_10m_mean","wind_speed_10m_anomaly","temperature_2m_mean","temperature_2m_anomaly","temperature_min24h_2m_mean","temperature_max24h_2m_mean","cloud_cover_mean","cloud_cover_anomaly","sunshine_duration_mean","sunshine_duration_anomaly"].join(",");
const fetchTimeout=(url)=>fetch(url,{headers:{"User-Agent":"Asia-Golf-90-Day-Planner-Seasonal-Archive/1.0"},signal:AbortSignal.timeout(30000)});
async function collect(point){
 const params=new URLSearchParams({latitude:String(point.latitude),longitude:String(point.longitude),weekly,monthly,forecast_days:"90",timezone:"Asia/Tokyo",wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius",models:"ecmwf_seasonal_seamless"});
 const response=await fetchTimeout(endpoint+"?"+params);
 if(!response.ok)throw new Error(point.id+" HTTP "+response.status);
 const payload=await response.json();
 const w=payload.weekly,m=payload.monthly;
 if(!w?.time?.length||!m?.time?.length)throw new Error(point.id+" missing weekly/monthly seasonal arrays");
 if(!Array.isArray(w.precipitation_efi)||!Array.isArray(w.precipitation_mean)||!Array.isArray(m.precipitation_mean)||!Array.isArray(m.precipitation_anomaly))throw new Error(point.id+" missing required precipitation fields");
 return {point,provider:"Open-Meteo Seasonal Forecast API",model:payload.model??"ecmwf_seasonal_seamless",grid:{latitude:payload.latitude,longitude:payload.longitude,elevation:payload.elevation},timezone:payload.timezone,weekly:w,monthly:m,coverage:{weeklyPeriods:w.time.length,monthlyPeriods:m.time.length,weeklyStart:w.time[0],weeklyEnd:w.time.at(-1),monthlyStart:m.time[0],monthlyEnd:m.time.at(-1)}};
}
const results=await Promise.allSettled(points.map(collect));
const failed=results.map((r,i)=>r.status==="rejected"?{pointId:points[i].id,error:String(r.reason)}:null).filter(Boolean);
if(failed.length)throw new Error("Seasonal archive quality gate failed: "+JSON.stringify(failed));
const retrievedAt=new Date().toISOString(),archiveDate=retrievedAt.slice(0,10);
const report={schemaVersion:1,archiveType:"okinawa-ecmwf-seasonal-snapshot",archiveDate,retrievedAt,provider:"Open-Meteo Seasonal Forecast API",model:"ecmwf_seasonal_seamless",timezone:"Asia/Tokyo",horizonInterpretation:{days17to46:"EC46 weekly precipitation EFI and weekly anomaly fields; ordinal tendency only",days47to90:"SEAS5 monthly precipitation mean/anomaly; monthly tendency only"},points:results.map(r=>r.value),qualityGate:{expectedPoints:3,successfulPoints:results.length,failedPoints:0,passed:true},limitations:["This is a daily snapshot archive, not a reforecast hindcast archive. A snapshot must be retained before its target periods pass to support later verification.","The seasonal API provides weekly/monthly scale products; no daily rainfall amount or daily rain probability is inferred.","Three regional city grid points are regional proxies, not golf-course observations or course-scale forecast grids.","API retrieval timestamp is not the model initialization/issue time. Do not calculate forecast lead from retrievedAt.","EC46/SEAS5 seasonal fields and short-range hourly forecasts remain separate scales; do not combine their raw values into a single score.","EFI and anomaly thresholds remain provisional and uncalibrated for Okinawa."]};
const validation=validateSeasonalSnapshot(report);
if(!validation.valid)throw new Error("Seasonal snapshot schema validation failed: "+validation.errors.join("; "));
const dir="data/okinawa/seasonal-forecast-archive";await fs.mkdir(dir,{recursive:true});
await fs.writeFile(dir+"/"+archiveDate+".json",JSON.stringify(report,null,2));
const md=["# Okinawa ECMWF Seasonal Forecast Snapshot","", "Retrieved: "+retrievedAt,"Model: "+report.model,"","| Region | Weekly periods | Monthly periods | Weekly coverage | Monthly coverage | Grid |","|---|---:|---:|---|---|---|",...report.points.map(x=>"| "+x.point.label+" ("+x.point.place+") | "+x.coverage.weeklyPeriods+" | "+x.coverage.monthlyPeriods+" | "+x.coverage.weeklyStart+" – "+x.coverage.weeklyEnd+" | "+x.coverage.monthlyStart+" – "+x.coverage.monthlyEnd+" | "+x.grid.latitude+", "+x.grid.longitude+" |"),"","## Quality gate","", "PASS — all three regional points returned required weekly and monthly precipitation fields.","","## Limitations","",...report.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile(dir+"/"+archiveDate+".md",md);
console.log(md);
