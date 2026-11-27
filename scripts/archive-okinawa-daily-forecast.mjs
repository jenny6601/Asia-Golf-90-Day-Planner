import fs from "node:fs/promises";
import {HOURLY_FIELDS as fields,DAILY_FIELDS as dailyFields,buildFieldCoverage,missingCoverageFields,validateArchiveRecords} from "./okinawa-forecast-archive-schema.mjs";

const courses=JSON.parse(await fs.readFile(new URL("../config/okinawa/course-coordinate-candidates.json",import.meta.url),"utf8"));

const retrievedAt=new Date().toISOString();
const records=[];
for(const course of courses){
 const params=new URLSearchParams({latitude:String(course.latitude),longitude:String(course.longitude),hourly:fields.join(","),daily:dailyFields.join(","),forecast_days:"16",timezone:"Asia/Tokyo",wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius"});
 const url="https://api.open-meteo.com/v1/forecast?"+params;
 const response=await fetch(url,{headers:{"User-Agent":"Asia-Golf-90-Day-Planner-Forecast-Archive/1.0"},signal:AbortSignal.timeout(45000)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(course.id+" forecast HTTP "+response.status+" "+(body.reason||body.error||""));
 const hourly=body.hourly||{},daily=body.daily||{};
 if(!hourly.time?.length||!daily.time?.length)throw new Error(course.id+" missing forecast time arrays");
 const hourlyCoverage=buildFieldCoverage(hourly,fields,hourly.time.length);
 const dailyCoverage=buildFieldCoverage(daily,dailyFields,daily.time.length);
 records.push({
  course:{id:course.id,name:course.name,latitude:course.latitude,longitude:course.longitude,coordinateStatus:course.coordinateStatus,coordinateSource:course.coordinateSource},
  provider:"Open-Meteo Forecast API",retrievedAt,timezone:body.timezone||"Asia/Tokyo",
  requestedForecastDays:16,model:body.model??null,generationTimeMs:body.generationtime_ms??null,
  grid:{latitude:body.latitude,longitude:body.longitude,elevation:body.elevation??null},
  units:{hourly:body.hourly_units??null,daily:body.daily_units??null},
  hourly,daily,hourlyCoverage,dailyCoverage,
  missingRequiredFields:missingCoverageFields(hourlyCoverage,dailyCoverage)
 });
 await new Promise(r=>setTimeout(r,300));
}
const date=retrievedAt.slice(0,10);
const quality=validateArchiveRecords(records,courses.map(course=>course.id));
const archive={schemaVersion:1,archiveType:"forecast-retrieval-snapshot",retrievedAt,validTimeZone:"Asia/Tokyo",courseCount:records.length,courseIds:records.map(x=>x.course.id),quality,issueTimeStatus:"Provider forecast initialisation/issue time is not exposed by this endpoint; retrievedAt is recorded and must not be relabelled as issueTime.",records};
const path="data/okinawa/forecast-archive/"+date+".json";
await fs.mkdir("data/okinawa/forecast-archive",{recursive:true});
await fs.writeFile(path,JSON.stringify(archive,null,2));
const summary=[
"# Okinawa daily forecast retrieval archive",
"",
"- Retrieval timestamp: "+retrievedAt,
"- Snapshot date: "+date,
"- Courses: "+records.length+"/6",
"- Hourly horizon: 16 days requested",
"- Provider issue time: unavailable; retrieval timestamp is retained separately.",
"",
"| Course | Grid coordinate | Hourly values | Daily values | Missing fields |",
"|---|---|---:|---:|---|",
...records.map(x=>"| "+x.course.name+" | "+x.grid.latitude+", "+x.grid.longitude+" | "+Object.values(x.hourlyCoverage).reduce((s,v)=>s+v.valid,0)+"/"+Object.values(x.hourlyCoverage).reduce((s,v)=>s+v.expected,0)+" | "+Object.values(x.dailyCoverage).reduce((s,v)=>s+v.valid,0)+"/"+Object.values(x.dailyCoverage).reduce((s,v)=>s+v.expected,0)+" | "+(x.missingRequiredFields.join(", ")||"none")+" |"),
"",
"## Verification restrictions",
"",
"- This is a retrieval-time snapshot, not a reconstructed model issue/run archive.",
"- Do not calculate true forecast lead time from retrievedAt; use only when provider issue time is available.",
"- This snapshot is useful for forecast evolution and retrieval consistency, but not a substitute for Previous Runs or Single Runs hindcast data.",
"- Grid coordinates and user-provided course points are both retained; grid points are not on-course sensors."
].join("\n");
await fs.writeFile("data/okinawa/forecast-archive/"+date+".md",summary);
console.log(summary);
if(!quality.recordsPass)process.exitCode=1;
