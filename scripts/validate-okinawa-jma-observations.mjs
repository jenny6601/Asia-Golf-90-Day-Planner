import fs from "node:fs/promises";
import {parseAmedasPointBlock,regressionMetrics,rainEventMetrics} from "./jma-amedas-validation.js";

const root=new URL("../",import.meta.url);
const stations=JSON.parse(await fs.readFile(new URL("../config/okinawa/jma-amedas-stations.json",import.meta.url),"utf8")).filter(x=>["91107","91241","91121","91166"].includes(x.id));
const courses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8")).filter(x=>x.countryCode==="JP"&&x.region==="Okinawa"&&x.enabled);
const base="https://www.jma.go.jp/bosai/amedas";
const models=[{id:"ecmwf_ifs025",label:"ECMWF IFS 0.25°",maxLead:7},{id:"jma_gsm",label:"JMA GSM",maxLead:7},{id:"jma_msm",label:"JMA MSM",maxLead:4}];
const assignments={
 "southern-links":{precipitation:["91241"],temperature:["91241"],wind:["91241"]},
 "palm-hills":{precipitation:["91241"],temperature:["91241"],wind:["91241"]},
 "pgm-okinawa":{precipitation:["91121"],temperature:["91166"],wind:["91166"]},
 "atta-terrace":{precipitation:["91107"],temperature:["91107"],wind:["91107"]},
 "chura-orchard":{precipitation:["91107"],temperature:["91107"],wind:["91107"]},
 "kise":{precipitation:["91107"],temperature:["91107"],wind:["91107"]}
};
const fetchWithTimeout=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(25000)});
async function request(url,kind="json"){
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{const res=await fetchWithTimeout(url,{headers:{"User-Agent":"Asia-Golf-90-Day-Planner-JMA-Validation/1.0"}});if(!res.ok)throw new Error("HTTP "+res.status);return kind==="text"?(await res.text()).trim():await res.json();}
  catch(e){lastError=e;if(attempt<2)await new Promise(r=>setTimeout(r,400*(attempt+1)));}
 }
 throw lastError;
}
const add=(date,n)=>new Date(Date.parse(date+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
const toDecimal=pair=>pair[0]+pair[1]/60;
const rad=x=>x*Math.PI/180;
function distanceKm(a,b){const dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude),lat1=rad(a.latitude),lat2=rad(b.latitude);const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i);}}));return out;}

const [stationTable,latestTime]=await Promise.all([request(base+"/const/amedastable.json"),request(base+"/data/latest_time.txt","text")]);
const latestDate=latestTime.slice(0,10);
const endDate=add(latestDate,-1),startDate=add(endDate,-6);
const dates=Array.from({length:7},(_,i)=>add(startDate,i));
const stationAudit=stations.map(s=>{const official=stationTable[s.id];if(!official)return {id:s.id,ok:false,reason:"station id not in official JMA table"};const latitude=toDecimal(official.lat),longitude=toDecimal(official.lon);return {id:s.id,name:s.name,jmaType:official.type,jmaElementsCode:official.elems,officialCoordinate:{latitude,longitude},configuredCoordinate:{latitude:s.latitude,longitude:s.longitude},coordinateDeltaMeters:distanceKm({latitude,longitude},{latitude:s.latitude,longitude:s.longitude})*1000,elevationDeltaM:s.elevationM-official.alt,metadataMatch:official.type===s.jmaType&&official.elems===s.jmaElementsCode&&Math.abs(latitude-s.latitude)<0.0001&&Math.abs(longitude-s.longitude)<0.0001&&official.alt===s.elevationM};});

const jobs=[];for(const station of stations)for(const date of dates)for(let hour=0;hour<24;hour+=3)jobs.push({station,date,hour});
const pointResults=await mapLimit(jobs,12,async job=>{const block=String(job.hour).padStart(2,"0"),ymd=job.date.replaceAll("-",""),url=base+"/data/point/"+job.station.id+"/"+ymd+"_"+block+".json";try{return {stationId:job.station.id,date:job.date,block,rows:parseAmedasPointBlock(await request(url)),ok:true};}catch(error){return {stationId:job.station.id,date:job.date,block,rows:[],ok:false,error:String(error)};}});
const observations=new Map(stations.map(s=>[s.id,new Map()]));
for(const result of pointResults)for(const row of result.rows){if(!row.time.endsWith(":00"))continue;observations.get(result.stationId).set(row.time,row);}

const modelResults=[];
for(const station of stations){
 const hourlyFields=[];for(let lead=1;lead<=7;lead++)for(const variable of ["temperature_2m","precipitation","wind_speed_10m"])hourlyFields.push(variable+"_previous_day"+lead);
 for(const model of models){
  const params=new URLSearchParams({latitude:String(station.latitude),longitude:String(station.longitude),start_date:startDate,end_date:endDate,timezone:"Asia/Tokyo",hourly:hourlyFields.join(","),models:model.id,wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius"});
  try{
   const forecast=await request("https://previous-runs-api.open-meteo.com/v1/forecast?"+params);
   const timeIndex=new Map((forecast.hourly?.time||[]).map((t,i)=>[t,i]));
   const obs=[...(observations.get(station.id)?.entries()||[])].map(([time,row])=>({time,row})).filter(x=>x.time.slice(0,10)>=startDate&&x.time.slice(0,10)<=endDate);
   for(let lead=1;lead<=7;lead++){
    const pairs={temperature:[],precipitation:[],wind:[]};
    for(const item of obs){const i=timeIndex.get(item.time);if(i===undefined)continue;const row=item.row;
     const fTemp=forecast.hourly?.["temperature_2m_previous_day"+lead]?.[i],fRain=forecast.hourly?.["precipitation_previous_day"+lead]?.[i],fWind=forecast.hourly?.["wind_speed_10m_previous_day"+lead]?.[i];
     if(Number.isFinite(fTemp)&&Number.isFinite(row.temperature.value))pairs.temperature.push({forecast:fTemp,observed:row.temperature.value,quality:row.temperature.quality,time:item.time});
     if(Number.isFinite(fRain)&&Number.isFinite(row.precipitation1h.value))pairs.precipitation.push({forecast:fRain,observed:row.precipitation1h.value,quality:row.precipitation1h.quality,time:item.time});
     if(Number.isFinite(fWind)&&Number.isFinite(row.windSpeed.value))pairs.wind.push({forecast:fWind,observed:row.windSpeed.value,quality:row.windSpeed.quality,time:item.time});
    }
    const metric={stationId:station.id,stationName:station.name,modelId:model.id,modelLabel:model.label,leadDays:lead,forecastGrid:{latitude:forecast.latitude,longitude:forecast.longitude},requestedStationCoordinate:{latitude:station.latitude,longitude:station.longitude},gridOffsetKm:distanceKm({latitude:station.latitude,longitude:station.longitude},{latitude:forecast.latitude,longitude:forecast.longitude}),temperature:regressionMetrics(pairs.temperature),precipitation:regressionMetrics(pairs.precipitation),wind:regressionMetrics(pairs.wind),rainEvents:[0.1,1,5].map(threshold=>rainEventMetrics(pairs.precipitation,threshold)),quality1Counts:{temperature:pairs.temperature.filter(x=>x.quality===1).length,precipitation:pairs.precipitation.filter(x=>x.quality===1).length,wind:pairs.wind.filter(x=>x.quality===1).length}};
    modelResults.push(metric);
   }
  }catch(error){modelResults.push({stationId:station.id,stationName:station.name,modelId:model.id,modelLabel:model.label,error:String(error)});}
 }
}

const stationSummaries=stations.map(s=>{const rows=[...(observations.get(s.id)?.values()||[])];const count=key=>rows.filter(x=>Number.isFinite(x[key]?.value)).length;return {id:s.id,name:s.name,metadata:stationAudit.find(x=>x.id===s.id),expectedHourly:168,observedHourlyRows:rows.length,validTemperature:count("temperature"),validPrecipitation1h:count("precipitation1h"),validWind:count("windSpeed"),quality1Counts:{temperature:rows.filter(x=>x.temperature.quality===1).length,precipitation:rows.filter(x=>x.precipitation1h.quality===1).length,wind:rows.filter(x=>x.windSpeed.quality===1).length},blockFiles:pointResults.filter(x=>x.stationId===s.id&&x.ok).length,blockFilesExpected:56};});
const courseStationMap=courses.map(course=>{const assign=assignments[course.id];return {courseId:course.id,courseName:course.name,coordinate:{latitude:course.latitude,longitude:course.longitude},stations:Object.fromEntries(Object.entries(assign).map(([element,ids])=>[element,ids.map(id=>{const st=stations.find(x=>x.id===id);return {stationId:id,name:st.name,distanceKm:Number(distanceKm(course,st).toFixed(2)),elevationDifferenceM:st.elevationM-(course.elevationM??0)};})]))};});
const enoughStationData=stationSummaries.every(s=>s.metadata?.metadataMatch&&s.validPrecipitation1h>=48&&(!stations.find(x=>x.id===s.id).observedElements.includes("temperature")||s.validTemperature>=48)&&(!stations.find(x=>x.id===s.id).observedElements.includes("wind")||s.validWind>=48));
const report={generatedAt:new Date().toISOString(),source:"Japan Meteorological Agency AMeDAS observation JSON (official JMA website feed; undocumented internal JSON endpoint)",sourceUrl:"https://www.jma.go.jp/bosai/amedas/",latestObservationTime:latestTime,period:{startDate,endDate,days:7,expectedHours:168},stationAudit,stationSummaries,courseStationMap,models,metrics:modelResults,pointFiles:{expected:jobs.length,success:pointResults.filter(x=>x.ok).length,failed:pointResults.filter(x=>!x.ok).length},pairingGatePass:stationAudit.every(x=>x.metadataMatch)&&enoughStationData,interpretation:"Hourly forecast-versus-observation pairs are matched by identical Asia/Tokyo valid timestamp and fixed previous-run lead (1-7 days). JMA quality 0 and 1 values are accepted; other quality flags are treated as missing. Precipitation compares preceding-hour accumulation; temperature and wind compare hourly station samples with model 10 m/2 m fields.",limitations:["JMA AMeDAS point JSON is an undocumented internal JMA website feed, not a formally documented public API; endpoint schema may change.","This initial run covers seven complete recent days, not a multi-season skill climatology.","Station observations are spatial proxies for golf courses; station-course distances and elevation differences are reported and must be considered.","JMA AMeDAS wind is a short-period station observation and is not identical to a model hourly instantaneous wind.","Gust is not included in hourly metrics because AMeDAS gust is a separate maximum instantaneous field, not a directly aligned hourly mean; it requires a separate daily-extreme comparison.","Apparent temperature is not directly observed by AMeDAS; do not treat it as an observed ground-truth variable.","Previous Runs API fields are fixed lead offsets; JMA MSM has a shorter forecast horizon than JMA GSM and ECMWF IFS.","Scores are descriptive skill metrics; no bias correction or production scoring thresholds are changed in this acceptance step."]};
await fs.mkdir("artifacts/okinawa-acceptance",{recursive:true});
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-jma-amedas-validation.json",JSON.stringify(report,null,2));
const fmt=x=>Number.isFinite(x)?x.toFixed(2):"—";
const md=["# Okinawa JMA AMeDAS Observation-Based Forecast Validation","",`Generated: ${report.generatedAt}`,`JMA latest observation time: ${latestTime}`,`Matched observation period: ${startDate} to ${endDate} (7 complete days)`,"",`**Station metadata + observation pairing gate:** ${report.pairingGatePass?"PASS":"FAIL"}`,"","## JMA station metadata and observed coverage","","| Station | Type | Official metadata | Hourly rows | Temp valid | Rain valid | Wind valid | Files |","|---|---|---|---:|---:|---:|---:|---:|",...stationSummaries.map(s=>`| ${s.name} (${s.id}) | ${s.metadata?.jmaType||"—"} | ${s.metadata?.metadataMatch?"match":"mismatch"} | ${s.observedHourlyRows}/168 | ${s.validTemperature} | ${s.validPrecipitation1h} | ${s.validWind} | ${s.blockFiles}/56 |`),"","## Course-to-station representativeness","","| Course | Variable | Station | Distance | Elevation difference |","|---|---|---|---:|---:|",...courseStationMap.flatMap(c=>Object.entries(c.stations).flatMap(([variable,items])=>items.map(s=>`| ${c.courseName} | ${variable} | ${s.name} (${s.stationId}) | ${s.distanceKm} km | ${s.elevationDifferenceM} m |`))),"","## Forecast skill metrics","","| Model | Station | Lead | Temp N / MAE / Bias | Rain N / MAE / Bias | Wind N / MAE / Bias | Rain CSI ≥1 mm/h |","|---|---|---:|---|---|---|---:|",...modelResults.filter(x=>!x.error).map(x=>`| ${x.modelLabel} | ${x.stationName} | ${x.leadDays}d | ${x.temperature.n} / ${fmt(x.temperature.mae)} / ${fmt(x.temperature.bias)} | ${x.precipitation.n} / ${fmt(x.precipitation.mae)} / ${fmt(x.precipitation.bias)} | ${x.wind.n} / ${fmt(x.wind.mae)} / ${fmt(x.wind.bias)} | ${fmt(x.rainEvents.find(e=>e.thresholdMmPerHour===1)?.csi)} |`),"","## Limitations",...report.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-jma-amedas-validation.md",md);
console.log(md);
if(!report.pairingGatePass)process.exitCode=1;