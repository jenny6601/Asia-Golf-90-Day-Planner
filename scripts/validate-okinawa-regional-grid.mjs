import fs from "node:fs/promises";
import {fetchCourseForecast} from "../assets/js/weather-api.js";
import {groupForecastGridCells,compareNumericSeries,summarizeNumeric} from "../assets/js/okinawa-grid-analysis.js";
import {haversineKm} from "../assets/js/coordinate-audit.js";

const root=new URL("../",import.meta.url);
const courses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8")).filter(x=>x.countryCode==="JP"&&x.region==="Okinawa"&&x.enabled);
const stations=JSON.parse(await fs.readFile(new URL("../config/okinawa/jma-amedas-stations.json",import.meta.url),"utf8"));
const stationMap={
 "southern-links":{rain:"91241",temperature:"91241",wind:"91241"},
 "palm-hills":{rain:"91241",temperature:"91241",wind:"91241"},
 "pgm-okinawa":{rain:"91121",temperature:"91166",wind:"91166"},
 "atta-terrace":{rain:"91107",temperature:"91107",wind:"91107"},
 "chura-orchard":{rain:"91107",temperature:"91107",wind:"91107"},
 "kise":{rain:"91107",temperature:"91107",wind:"91107"}
};
const hourlyFields=["temperature_2m","apparent_temperature","precipitation_probability","precipitation","wind_speed_10m","wind_gusts_10m","relative_humidity_2m","wind_direction_10m","weather_code"];
const dailyFields=["precipitation_sum","precipitation_probability_max","temperature_2m_min","temperature_2m_max","wind_speed_10m_max","wind_gusts_10m_max"];
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const fetchWithTimeout=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(45000)});
const courseResults=[];
for(let i=0;i<courses.length;i+=3){
 const batch=await fetchCourseForecast(courses.slice(i,i+3),fetchWithTimeout);
 for(const item of batch.courses){
  const hourly=item.hourly,daily=item.daily;
  const hourlyCoverage=Object.fromEntries(hourlyFields.map(k=>{const a=hourly[k]||[],n=a.filter(finite).length;return [k,{valid:n,expected:hourly.time.length,coverage:hourly.time.length?n/hourly.time.length:0}]}));
  const dailyCoverage=Object.fromEntries(dailyFields.map(k=>{const a=daily[k]||[],n=a.filter(finite).length;return [k,{valid:n,expected:daily.time.length,coverage:daily.time.length?n/daily.time.length:0}]}));
  const fields={};for(const k of hourlyFields)fields[k]=summarizeNumeric(hourly[k]);for(const k of dailyFields)fields[k]=summarizeNumeric(daily[k]);
  const stationRefs=stationMap[item.course.id];
  const stationLinks=Object.fromEntries(Object.entries(stationRefs).map(([variable,id])=>{const st=stations.find(x=>x.id===id);return [variable,{stationId:id,name:st.name,distanceKm:Number(haversineKm(item.course.latitude,item.course.longitude,st.latitude,st.longitude).toFixed(2)),stationElevationM:st.elevationM,observedElements:st.observedElements}]}));
  courseResults.push({courseId:item.course.id,name:item.course.name,area:item.course.area,requestedCoordinate:{latitude:item.course.latitude,longitude:item.course.longitude},forecastGrid:item.coordinateAudit.providerGrid,gridOffsetKm:item.coordinateAudit.gridOffsetKm,gridElevationM:item.coordinateAudit.elevationM,timezone:item.timezone,dailyCount:daily.time?.length||0,hourlyCount:hourly.time?.length||0,hourlyCoverage,dailyCoverage,fields,stationReferences:stationLinks,hourlySnapshot:hourly,pass:daily.time?.length===16&&hourly.time?.length===384&&Object.values(hourlyCoverage).every(x=>x.coverage===1)&&Object.values(dailyCoverage).every(x=>x.coverage===1)});
 }
}
const gridGroups=groupForecastGridCells(courseResults);
const pairComparisons=[];
for(const group of gridGroups)for(let i=0;i<group.courses.length;i++)for(let j=i+1;j<group.courses.length;j++){
 const a=group.courses[i],b=group.courses[j];
 const fa=courseResults.find(x=>x.courseId===a.courseId),fb=courseResults.find(x=>x.courseId===b.courseId);
 const hourlyA=a.hourlySnapshot,hourlyB=b.hourlySnapshot;
 pairComparisons.push({gridKey:group.key,courseA:a.courseId,courseB:b.courseId,areaA:a.area,areaB:b.area,gridElevationA:fa.gridElevationM,gridElevationB:fb.gridElevationM,fields:Object.fromEntries(hourlyFields.map(k=>[k,compareNumericSeries(hourlyA[k],hourlyB[k])]))});
}
const regions=[...new Set(courseResults.map(x=>x.area))];
const regionalSummary=regions.map(area=>{const rows=courseResults.filter(x=>x.area===area);const metrics=["temperature_2m","apparent_temperature","precipitation_probability","precipitation","wind_speed_10m","wind_gusts_10m"];const averages=Object.fromEntries(metrics.map(k=>[k,summarizeNumeric(rows.map(x=>x.fields[k].mean).filter(finite))]));const uniqueGrids=[...new Set(rows.map(x=>x.forecastGrid.latitude.toFixed(5)+","+x.forecastGrid.longitude.toFixed(5)))];return {area,courseCount:rows.length,courseIds:rows.map(x=>x.courseId),uniqueGridCount:uniqueGrids.length,gridKeys:uniqueGrids,averages};});
const regionDeltas=[];for(let i=0;i<regionalSummary.length;i++)for(let j=i+1;j<regionalSummary.length;j++){const a=regionalSummary[i],b=regionalSummary[j];regionDeltas.push({from:a.area,to:b.area,differences:Object.fromEntries(["temperature_2m","apparent_temperature","precipitation_probability","precipitation","wind_speed_10m","wind_gusts_10m"].map(k=>[k,{meanDifference:b.averages[k].mean===null||a.averages[k].mean===null?null:Number((b.averages[k].mean-a.averages[k].mean).toFixed(3))}]))});}
const uniqueGrids=gridGroups.map(g=>({key:g.key,latitude:g.latitude,longitude:g.longitude,courseIds:g.courseIds,courseNames:g.courseNames,areas:g.areas}));
const gridDistances=[];for(let i=0;i<uniqueGrids.length;i++)for(let j=i+1;j<uniqueGrids.length;j++)gridDistances.push({from:uniqueGrids[i].key,to:uniqueGrids[j].key,distanceKm:Number(haversineKm(uniqueGrids[i].latitude,uniqueGrids[i].longitude,uniqueGrids[j].latitude,uniqueGrids[j].longitude).toFixed(2))});
const report={generatedAt:new Date().toISOString(),scope:"Six Okinawa course GPS points",forecastDays:16,hourlyFields,dailyFields,results:courseResults.map(({hourlySnapshot,...x})=>x),gridGroups:uniqueGrids,uniqueGridCount:uniqueGrids.length,sameGridPairComparisons:pairComparisons,gridCellDistances:gridDistances,regionalSummary,regionDeltas,allSixForecastDataPass:courseResults.length===6&&courseResults.every(x=>x.pass),microclimateAssessment:{status:"insufficient-on-course-observation",reason:"Open-Meteo grid points and nearby AMeDAS stations are spatial proxies; none is an on-course sensor. A shared model grid cannot resolve fairway-scale sea breeze, slope, coastal exposure or local rain cells.",stationReferenceDistancesIncluded:true},interpretation:["The six requested course points map to the number of unique Open-Meteo forecast grid cells reported above; same-grid courses do not have independent model-grid weather evidence.","Where the same grid coordinate returns different values, compare provider grid elevation and treat the differences as possible elevation/downscaling effects, not proof of local microclimate.","Regional averages are descriptive and are not independent samples when multiple courses share one grid cell.","The regional forecast contrast is model-grid information only; actual microclimate requires denser station observations or on-course sensors."]};
await fs.mkdir("artifacts/okinawa-acceptance",{recursive:true});
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-regional-grid-analysis.json",JSON.stringify(report,null,2));
const fmt=(x,d=2)=>Number.isFinite(x)?x.toFixed(d):"—";
const md=["# Okinawa Regional Forecast Grid and Microclimate Comparison","",`Generated: ${report.generatedAt}`,"",`**Six-course forecast data gate:** ${report.allSixForecastDataPass?"PASS":"FAIL"}`,`Unique Open-Meteo forecast grid cells: ${report.uniqueGridCount}`,"","## Course point to provider grid","","| Course | Area | Requested point | Returned grid | Grid offset | Grid elevation |","|---|---|---|---|---:|---:|",...courseResults.map(x=>`| ${x.name} | ${x.area} | ${x.requestedCoordinate.latitude}, ${x.requestedCoordinate.longitude} | ${x.forecastGrid.latitude}, ${x.forecastGrid.longitude} | ${x.gridOffsetKm} km | ${x.gridElevationM} m |`),"","## Shared grid groups","","| Grid | Courses | Areas |","|---|---|---|",...uniqueGrids.map(g=>`| ${g.key} | ${g.courseNames.join(", ")} | ${g.areas.join(", ")} |`),"","## Same-grid course differences","","| Course A | Course B | Elevation A/B | Temp max Δ | Feels max Δ | Rain-prob max Δ | Wind max Δ | Gust max Δ |","|---|---|---:|---:|---:|---:|---:|---:|",...pairComparisons.map(p=>`| ${p.courseA} | ${p.courseB} | ${p.gridElevationA}/${p.gridElevationB} m | ${fmt(p.fields.temperature_2m.maxAbsoluteDifference)} | ${fmt(p.fields.apparent_temperature.maxAbsoluteDifference)} | ${fmt(p.fields.precipitation_probability.maxAbsoluteDifference)} | ${fmt(p.fields.wind_speed_10m.maxAbsoluteDifference)} | ${fmt(p.fields.wind_gusts_10m.maxAbsoluteDifference)} |`),"","## Regional 16-day mean contrasts","","| Area | Courses | Unique grids | Temp mean °C | Feels mean °C | Rain probability mean % | Hourly rain mean mm | Wind mean m/s | Gust mean m/s |","|---|---:|---:|---:|---:|---:|---:|---:|---:|",...regionalSummary.map(r=>`| ${r.area} | ${r.courseCount} | ${r.uniqueGridCount} | ${fmt(r.averages.temperature_2m.mean)} | ${fmt(r.averages.apparent_temperature.mean)} | ${fmt(r.averages.precipitation_probability.mean)} | ${fmt(r.averages.precipitation.mean,3)} | ${fmt(r.averages.wind_speed_10m.mean)} | ${fmt(r.averages.wind_gusts_10m.mean)} |`),"","## JMA AMeDAS station proxy distances","","| Course | Rain station | Temp/wind station |","|---|---|---|",...courseResults.map(x=>`| ${x.name} | ${x.stationReferences.rain.name} (${x.stationReferences.rain.distanceKm} km) | ${x.stationReferences.temperature.name} (${x.stationReferences.temperature.distanceKm} km) |`),"","## Microclimate interpretation",...report.interpretation.map(x=>"- "+x)];
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-regional-grid-analysis.md",md.join("\n"));
console.log(md.join("\n"));
if(!report.allSixForecastDataPass)process.exitCode=1;