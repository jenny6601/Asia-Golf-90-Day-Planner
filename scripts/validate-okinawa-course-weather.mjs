import fs from "node:fs/promises";
import {fieldCoverage,assessForecastPayload} from "./forecast-completeness.js";

const ROOT = new URL("../", import.meta.url);
const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const SEASONAL_ENDPOINT = "https://seasonal-api.open-meteo.com/v1/seasonal";
const FORECAST_HOURLY = [
  "temperature_2m","apparent_temperature","relative_humidity_2m",
  "precipitation_probability","precipitation","weather_code",
  "wind_speed_10m","wind_direction_10m","wind_gusts_10m","cloud_cover","uv_index"
].join(",");
const FORECAST_DAILY = [
  "weather_code","precipitation_sum","precipitation_probability_max",
  "temperature_2m_min","temperature_2m_max","apparent_temperature_min",
  "apparent_temperature_max","wind_speed_10m_max","wind_gusts_10m_max"
].join(",");
const SEASONAL_HOURLY = [
  "precipitation","rain","showers","temperature_2m","apparent_temperature",
  "weather_code","wind_speed_10m","wind_gusts_10m","cloud_cover","relative_humidity_2m"
].join(",");
const SEASONAL_DAILY = [
  "weather_code","temperature_2m_max","temperature_2m_min","temperature_2m_mean",
  "wind_speed_10m_mean","cloud_cover_mean","sunshine_duration"
].join(",");
const finite = x => typeof x === "number" && Number.isFinite(x);
const countFinite = a => Array.isArray(a) ? a.filter(finite).length : 0;
const toRad = x => x * Math.PI / 180;

export function haversineKm(aLat,aLon,bLat,bLon) {
  if (![aLat,aLon,bLat,bLon].every(finite)) return null;
  const dLat=toRad(bLat-aLat), dLon=toRad(bLon-aLon);
  const h=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function auditRuntimeCourse(runtime,candidate) {
  const hasRuntime=finite(runtime?.latitude)&&finite(runtime?.longitude);
  return {
    id:candidate.id,
    runtimeEnabled:runtime?.enabled??null,
    runtimeCoordinateStatus:runtime?.coordinateStatus??"missing",
    runtimeCoordinate:hasRuntime?{latitude:runtime.latitude,longitude:runtime.longitude}:null,
    candidateCoordinate:{latitude:candidate.latitude,longitude:candidate.longitude},
    runtimeToCandidateDistanceKm:hasRuntime?haversineKm(runtime.latitude,runtime.longitude,candidate.latitude,candidate.longitude):null,
    coordinateSource:candidate.coordinateSource,
    coordinateStatus:candidate.coordinateStatus,
    promotionAllowed:candidate.coordinateStatus==="verified"||candidate.coordinateStatus==="user_provided_google_maps"
  };
}
export function assessSeasonalPayload(payload) {
  const dates=payload?.daily?.time||[];
  const start=dates[0]||null, d17=dates[16]||null, d46=dates[45]||null, d47=dates[46]||null, end=dates[89]||null;
  const daily=fieldCoverage(payload,"daily",["weather_code","temperature_2m_max","temperature_2m_min","temperature_2m_mean","wind_speed_10m_mean","cloud_cover_mean","sunshine_duration"]);
  const hourly=fieldCoverage(payload,"hourly",["precipitation","rain","showers","temperature_2m","apparent_temperature","weather_code","wind_speed_10m","wind_gusts_10m","cloud_cover","relative_humidity_2m"]);
  const d17_46=fieldCoverage(payload,"hourly",["precipitation","temperature_2m","apparent_temperature","weather_code","wind_speed_10m","cloud_cover"],d17,d46);
  const d47_90=fieldCoverage(payload,"hourly",["precipitation","temperature_2m","apparent_temperature","weather_code","wind_speed_10m","cloud_cover"],d47,end);
  const requiredDaily=["weather_code","temperature_2m_max","temperature_2m_min","wind_speed_10m_mean"];
  const requiredHourly=["precipitation","temperature_2m","weather_code","wind_speed_10m"];
  const requiredCoverage=[...requiredDaily.map(k=>daily[k].coverage),...requiredHourly.map(k=>hourly[k].coverage)];
  return {
    timezone:payload?.timezone??null,
    returnedCoordinate:{latitude:payload?.latitude??null,longitude:payload?.longitude??null},
    model:payload?.model??"not-returned",
    dailyCount:dates.length,hourlyCount:payload?.hourly?.time?.length??0,
    dateRange:{start,end},leadBands:{d17_46:{start:d17,end:d46},d47_90:{start:d47,end}},
    daily,hourly,d17_46,d47_90,
    seasonalRainProbabilityAvailable:Object.hasOwn(payload?.daily||{},"precipitation_probability_max")||Object.hasOwn(payload?.hourly||{},"precipitation_probability"),
    coreFieldsComplete:dates.length>=90&&(payload?.hourly?.time?.length??0)>=350&&requiredCoverage.every(x=>x>=0.90)
  };
}
async function getJson(url,label) {
  let last;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch(url,{headers:{"User-Agent":"Asia-Golf-90-Day-Planner-Okinawa-Acceptance/1.0"},signal:AbortSignal.timeout(45000)});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(label+" HTTP "+response.status+" "+(body.reason??body.error??""));
      return body;
    }catch(error){
      last=error;
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1200*attempt));
    }
  }
  throw last;
}
function paramsFor(course,extra) {
  return new URLSearchParams({
    latitude:String(course.latitude),longitude:String(course.longitude),
    timezone:"Asia/Tokyo",wind_speed_unit:"ms",precipitation_unit:"mm",
    temperature_unit:"celsius",...extra
  });
}
const candidates=JSON.parse(await fs.readFile(new URL("../config/okinawa/course-coordinate-candidates.json",import.meta.url),"utf8"));
const runtimeCourses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8"));
const runtimeById=new Map(runtimeCourses.map(x=>[x.id,x]));
const jmaStations=JSON.parse(await fs.readFile(new URL("../config/okinawa/jma-amedas-stations.json",import.meta.url),"utf8"));
const candidateIds=candidates.map(x=>x.id);
const runtimeOkinawa=runtimeCourses.filter(x=>x.countryCode==="JP"&&x.region==="Okinawa");
const uniqueIds=new Set(candidateIds);
const catalogChecks={
  candidateCount:candidates.length,
  runtimeOkinawaCount:runtimeOkinawa.length,
  uniqueIds:uniqueIds.size===candidateIds.length,
  allTimezoneAsiaTokyo:candidates.every(x=>x.timezone==="Asia/Tokyo"),
  allAddressesPresent:candidates.every(x=>runtimeById.get(x.id)?.address),
  allOfficialSourcesPresent:candidates.every(x=>x.officialSourceUrl),
  coordinatesInRange:candidates.every(x=>finite(x.latitude)&&finite(x.longitude)&&x.latitude>=24&&x.latitude<=28&&x.longitude>=122&&x.longitude<=130),
  exactSixIds:["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"].every(id=>uniqueIds.has(id))&&candidates.length===6
};
const coordinateAudit=candidates.map(c=>auditRuntimeCourse(runtimeById.get(c.id),c));
const courseResults=[];
for(const course of candidates){
  const result={id:course.id,courseCode:course.courseCode,name:course.name,area:course.area,coordinateStatus:course.coordinateStatus,candidateCoordinate:{latitude:course.latitude,longitude:course.longitude},coordinateSource:course.coordinateSource};
  try{
    const fp=paramsFor(course,{hourly:FORECAST_HOURLY,daily:FORECAST_DAILY,forecast_days:"16"});
    const forecast=await getJson(FORECAST_ENDPOINT+"?"+fp,"Forecast "+course.id);
    result.forecast=assessForecastPayload(forecast);
  }catch(error){result.forecast={error:String(error),coreFieldsComplete:false};}
  try{
    const sp=paramsFor(course,{hourly:SEASONAL_HOURLY,daily:SEASONAL_DAILY,forecast_days:"90",models:"ecmwf_seasonal_seamless"});
    const seasonal=await getJson(SEASONAL_ENDPOINT+"?"+sp,"Seasonal "+course.id);
    result.seasonal=assessSeasonalPayload(seasonal);
  }catch(error){result.seasonal={error:String(error),coreFieldsComplete:false};}
  result.courseWeatherDataPass=Boolean(result.forecast.coreFieldsComplete&&result.seasonal.coreFieldsComplete&&result.forecast.timezone==="Asia/Tokyo"&&result.seasonal.timezone==="Asia/Tokyo");
  courseResults.push(result);
  await new Promise(resolve=>setTimeout(resolve,350));
}
const stationAudit=candidates.map(course=>{
  const ranked=jmaStations.map(station=>({
    stationId:station.id,name:station.name,type:station.type,
    distanceKm:haversineKm(course.latitude,course.longitude,station.latitude,station.longitude),
    elevationM:station.elevationM,observedElements:station.observedElements
  })).sort((a,b)=>a.distanceKm-b.distanceKm);
  return {
    courseId:course.id,
    nearestAll:ranked.slice(0,3),
    nearestRain:ranked.filter(x=>x.observedElements.includes("precipitation")).slice(0,3),
    nearestTemperatureWind:ranked.filter(x=>x.observedElements.includes("temperature")&&x.observedElements.includes("wind")).slice(0,3)
  };
});
const gridGroups=section=>{
  const map=new Map();
  for(const r of courseResults){
    const p=r[section]?.returnedCoordinate;
    if(!p||!finite(p.latitude)||!finite(p.longitude))continue;
    const key=p.latitude.toFixed(5)+","+p.longitude.toFixed(5);
    (map.get(key)||map.set(key,[]).get(key)).push(r.id);
  }
  return [...map.entries()].map(([grid,courseIds])=>({grid,courseIds,count:courseIds.length}));
};
const report={
  generatedAt:new Date().toISOString(),
  scope:"Okinawa Main Island six-course candidate-coordinate acceptance probe",
  providerForecast:"Open-Meteo Forecast API (16-day course-point request)",
  providerSeasonal:"Open-Meteo Seasonal Forecast API; requested model ecmwf_seasonal_seamless (90-day course-point request)",
  timezone:"Asia/Tokyo",
  purpose:"Read-only data completeness, returned-grid and timezone verification. This is not a forecast-accuracy validation or production calibration.",
  catalogChecks,coordinateAudit,stationSource:"JMA AMeDAS station list (2026-02-05) and Okinawa AMeDAS station information",stationAudit,courseResults,
  forecastGridGroups:gridGroups("forecast"),
  seasonalGridGroups:gridGroups("seasonal"),
  allSixForecastsPass:courseResults.length===6&&courseResults.every(x=>x.forecast?.coreFieldsComplete&&x.forecast?.timezone==="Asia/Tokyo"),
  allSixSeasonalPass:courseResults.length===6&&courseResults.every(x=>x.seasonal?.coreFieldsComplete&&x.seasonal?.timezone==="Asia/Tokyo"),
  allSixCourseWeatherDataPass:courseResults.length===6&&courseResults.every(x=>x.courseWeatherDataPass),
  limitations:[
    "The six current course points are user-provided Google Maps coordinates (2026-11-27), synchronized to candidate, global runtime and pilot catalogs. This source attribution is not an independent survey or polygon verification.",
    "Open-Meteo returned grid coordinates are model grid cells, not proof of course-boundary GPS accuracy.",
    "Seasonal API daily and six-hourly field completeness does not establish forecast skill or daily rain probability.",
    "Seasonal rainfall is a model-derived amount signal; no seasonal precipitation probability is inferred.",
    "ERA5 is a reanalysis reference proxy, not direct on-course observation. Accuracy calibration requires matched JMA AMeDAS/station observations and archived forecast runs.",
    "Forecast model version, grid resolution and shared grid cells must remain visible in downstream analysis."
  ]
};
await fs.mkdir("artifacts/okinawa-acceptance",{recursive:true});
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-course-weather-acceptance.json",JSON.stringify(report,null,2));
const fmtCoverage=obj=>Object.entries(obj||{}).map(([k,v])=>k+":"+v.valid+"/"+v.expected).join("; ");
const lines=[
"# Okinawa Six-Course Weather Data Acceptance Probe","",
"Generated: "+report.generatedAt,"",
"Scope: six Okinawa Main Island course candidate points; timezone Asia/Tokyo.","",
"**Catalog checks:** "+JSON.stringify(catalogChecks),"",
"**Six-course 16-day forecast completeness:** "+(report.allSixForecastsPass?"PASS":"FAIL"),
"**Six-course 90-day seasonal field completeness:** "+(report.allSixSeasonalPass?"PASS":"FAIL"),
"**Combined course weather data gate:** "+(report.allSixCourseWeatherDataPass?"PASS":"FAIL"),"",
"| Course | Coordinate status | Runtime point vs candidate | Forecast days / hours | Forecast timezone | Seasonal days / 6h samples | Seasonal timezone | Result |",
"|---|---|---:|---:|---|---:|---|---|",
...courseResults.map(r=>{
 const a=coordinateAudit.find(x=>x.id===r.id);
 return "| "+r.name+" | "+r.coordinateStatus+" | "+(a.runtimeToCandidateDistanceKm===null?"runtime GPS pending":a.runtimeToCandidateDistanceKm.toFixed(2)+" km")+
 " | "+(r.forecast.dailyCount??0)+" / "+(r.forecast.hourlyCount??0)+" | "+(r.forecast.timezone??"—")+
 " | "+(r.seasonal.dailyCount??0)+" / "+(r.seasonal.hourlyCount??0)+" | "+(r.seasonal.timezone??"—")+
 " | "+(r.courseWeatherDataPass?"PASS":"FAIL")+" |";
}),
"","## Forecast returned grid cells","",
...report.forecastGridGroups.map(x=>"- "+x.grid+": "+x.courseIds.join(", ")),
"","## Seasonal returned grid cells","",
...report.seasonalGridGroups.map(x=>"- "+x.grid+": "+x.courseIds.join(", ")),
"","## Coordinate/runtime catalog discrepancies","",
...coordinateAudit.map(x=>"- "+x.id+": runtime "+(x.runtimeCoordinate?x.runtimeCoordinate.latitude+","+x.runtimeCoordinate.longitude:"missing")+
 "; candidate "+x.candidateCoordinate.latitude+","+x.candidateCoordinate.longitude+
 "; distance "+(x.runtimeToCandidateDistanceKm===null?"n/a":x.runtimeToCandidateDistanceKm.toFixed(3)+" km")+
 "; runtime enabled="+x.runtimeEnabled+"; candidate status="+x.coordinateStatus),
"","## Nearest JMA AMeDAS station candidates","",
"| Course | Nearest precipitation station | Nearest temperature/wind station |",
"|---|---|---|",
...stationAudit.map(x=>{const r=x.nearestRain[0],w=x.nearestTemperatureWind[0];return "| "+x.courseId+" | "+(r?r.name+" ("+r.stationId+", "+r.distanceKm.toFixed(1)+" km; "+r.type+")":"—")+" | "+(w?w.name+" ("+w.stationId+", "+w.distanceKm.toFixed(1)+" km; "+w.type+")":"—")+" |";}),
"","Station metadata source: https://xml.kishou.go.jp/20260205_jmaxml_info.pdf. Historical station observations can be obtained through https://www.data.jma.go.jp/risk/obsdl/index.php. Nearest station is a candidate reference, not automatically representative of course microclimate.","","## Interpretation guardrails",...report.limitations.map(x=>"- "+x)
];
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-course-weather-acceptance.md",lines.join("\n"));
console.log(lines.join("\n"));
if(!catalogChecks.exactSixIds||!catalogChecks.allTimezoneAsiaTokyo||!catalogChecks.coordinatesInRange||!report.allSixCourseWeatherDataPass)process.exitCode=1;
