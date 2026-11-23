import fs from "node:fs/promises";
import {regressionMetrics,categoricalRainMetrics} from "../assets/js/hindcast-metrics.js";

const points=[
 {id:"north",label:"北部代理點",latitude:26.5916,longitude:127.9774},
 {id:"central-south-shared-proxy",label:"中南部共用代理點",latitude:26.3344,longitude:127.8056}
];
const windows=Array.from({length:12},(_,i)=>{
 const month=String(i+1).padStart(2,"0");
 const season=i<2||i===11?"winter":i<5?"spring":i<8?"summer":"autumn";
 return {start:"2025-"+month+"-15",end:"2025-"+month+"-21",season};
});
const models=[
 {id:"ecmwf_ifs025",label:"ECMWF IFS 0.25°"},
 {id:"ncep_gfs_global",label:"NCEP GFS Global"},
 {id:"jma_seamless",label:"JMA Seamless"},
 {id:"jma_gsm",label:"JMA GSM"},
 {id:"cma_grapes_global",label:"CMA GRAPES Global"},
 {id:"icon_global",label:"DWD ICON Global",maxLead:3}
];
const leads=[1,3,7], variables=["temperature_2m","precipitation","wind_speed_10m"];
const headers={"User-Agent":"Asia-Golf-90-Day-Planner-multimodel-hindcast/1.0"};
await fs.mkdir("artifacts/multimodel-raw",{recursive:true});
async function getJson(url){
 const response=await fetch(url,{headers});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error("HTTP "+response.status+" "+(body.reason??body.error??""));
 return body;
}
function mapHourly(hourly){
 const map=new Map();
 for(let i=0;i<(hourly?.time??[]).length;i++){
  const row={}; for(const v of variables)row[v]=hourly?.[v]?.[i]??null;
  map.set(hourly.time[i],row);
 }
 return map;
}
const samples=[],coverage=[];
for(const point of points)for(const win of windows){
 const base={latitude:String(point.latitude),longitude:String(point.longitude),start_date:win.start,end_date:win.end,timezone:"Asia/Tokyo",wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius"};
 for(const model of models){
  const fields=[];
  for(const lead of leads)for(const v of variables)fields.push(v+"_previous_day"+lead);
  const fp=new URLSearchParams({...base,hourly:fields.join(","),models:model.id});
  try{
   const forecast=await getJson("https://previous-runs-api.open-meteo.com/v1/forecast?"+fp);
   await fs.writeFile("artifacts/multimodel-raw/"+point.id+"-"+win.start+"-"+model.id+".json",JSON.stringify(forecast));
   // Query ERA5 at the model's returned forecast grid coordinate, not the original requested point.
   // This removes the avoidable location mismatch from the forecast-versus-reference pair.
   const verificationParams=new URLSearchParams({
    ...base,latitude:String(forecast.latitude),longitude:String(forecast.longitude),
    hourly:variables.join(","),models:"era5"
   });
   const era5=await getJson("https://archive-api.open-meteo.com/v1/archive?"+verificationParams);
   await fs.writeFile("artifacts/multimodel-raw/"+point.id+"-"+win.start+"-"+model.id+"-era5-at-grid.json",JSON.stringify(era5));
   const obsMap=mapHourly(era5.hourly);
   const times=forecast.hourly?.time??[];
   let matched=0;
   for(let i=0;i<times.length;i++){
    const validTime=times[i],obs=obsMap.get(validTime); if(!obs)continue;
    for(const lead of leads){
     const f={};
     for(const v of variables)f[v]=forecast.hourly?.[v+"_previous_day"+lead]?.[i]??null;
     const paired=variables.some(v=>Number.isFinite(f[v])&&Number.isFinite(obs[v]));
     if(!paired)continue;
     const issue=new Date(new Date(validTime+"+09:00").getTime()-lead*86400000);
     samples.push({
      modelId:model.id,modelLabel:model.label,pointId:point.id,pointLabel:point.label,
      requestedCoordinate:{latitude:point.latitude,longitude:point.longitude},
      forecastGrid:{latitude:forecast.latitude,longitude:forecast.longitude},
      verificationGrid:{latitude:era5.latitude,longitude:era5.longitude},
      gridOffsetFromRequestedKm:null,
      gridAligned:Math.abs(forecast.latitude-era5.latitude)<1e-6&&Math.abs(forecast.longitude-era5.longitude)<1e-6,
      season:win.season,validTime,issuedAt:issue.toISOString(),timezone:"Asia/Tokyo",
      leadHours:lead*24,forecast:f,verification:obs,
      forecastRainEvent:Number.isFinite(f.precipitation)?f.precipitation>=0.1:null,
      observedRainEvent:Number.isFinite(obs.precipitation)?obs.precipitation>=0.1:null,
      rainEventThresholdMmPerHour:0.1
     });matched++;
    }
   }
   const countByLead={};
   for(const lead of leads)countByLead[lead+"d"]=Object.fromEntries(variables.map(v=>{
    const a=forecast.hourly?.[v+"_previous_day"+lead]??[];
    return [v,{n:a.filter(Number.isFinite).length,total:a.length}];
   }));
   coverage.push({
    point:point.id,window:win,model:model.id,ok:true,forecastHours:times.length,
    verificationHours:era5.hourly?.time?.length??0,matchedRows:matched,
    forecastGrid:{latitude:forecast.latitude,longitude:forecast.longitude},
    verificationGrid:{latitude:era5.latitude,longitude:era5.longitude},
    gridAligned:Math.abs(forecast.latitude-era5.latitude)<1e-6&&Math.abs(forecast.longitude-era5.longitude)<1e-6,
    forecastUnits:forecast.hourly_units??null,verificationUnits:era5.hourly_units??null,
    returnedModel:forecast.model??null,countByLead
   });
  }catch(e){coverage.push({point:point.id,window:win,model:model.id,ok:false,error:String(e)});}
 }
}
const metrics=[];
for(const model of models)for(const point of points)for(const lead of leads){
 if(model.maxLead&&lead>model.maxLead)continue;
 const subset=samples.filter(s=>s.modelId===model.id&&s.pointId===point.id&&s.leadHours===lead*24);
 const variablesOut={};
 for(const v of variables){
  const pairs=subset.filter(s=>Number.isFinite(s.forecast[v])&&Number.isFinite(s.verification[v]));
  variablesOut[v]=regressionMetrics(pairs.map(s=>({f:s.forecast[v],o:s.verification[v]})),"f","o");
 }
 const rain=subset.filter(s=>typeof s.forecastRainEvent==="boolean"&&typeof s.observedRainEvent==="boolean");
 metrics.push({modelId:model.id,modelLabel:model.label,pointId:point.id,leadDays:lead,nRows:subset.length,gridAlignedRows:subset.filter(s=>s.gridAligned).length,variables:variablesOut,rainEvent:categoricalRainMetrics(rain.map(s=>({f:s.forecastRainEvent,o:s.observedRainEvent})),"f","o")});
}
const gridKeys=[...new Set(coverage.filter(c=>c.ok).map(c=>c.model+"|"+c.point+"|"+c.forecastGrid.latitude+","+c.forecastGrid.longitude))];
const report={generatedAt:new Date().toISOString(),purpose:"Multi-model forecast-versus-ERA5 reanalysis comparison; ERA5 is a modelled proxy, not direct station truth.",scope:{models,points,windows,leads},sampleCount:samples.length,uniqueModelPointGridCount:gridKeys.length,coverage,metrics,limitations:[
 "Only the tested model/lead combinations with non-null fields are scored; ICON Global day 7 is excluded because the availability probe returned all-null values.",
 "ERA5 reanalysis is a modelled reference proxy, not rain-gauge or on-course observation truth.",
 "ERA5 is queried at each model's returned forecast grid coordinate to reduce spatial pairing mismatch; ERA5 may still snap to a different native grid point, which is reported.",
 "Different models have different native grid resolutions and spatial representativeness; same-coordinate matching does not make their effective resolution identical.",
 "North and central-south are two representative proxy points, not a full three-zone course-level validation.",
 "One seven-day window per month is a seasonal sample, not a complete annual hindcast.",
 "Metrics are model-specific paired samples; sample count and grid alignment must accompany every score.",
 "No production thresholds or bias corrections are changed by this analysis."
],samples};
await fs.writeFile("artifacts/okinawa-multimodel-hindcast.json",JSON.stringify(report,null,2));
const fmt=x=>x===null||x===undefined?"—":x.toFixed(2);
const md=["# Okinawa Multi-model Hindcast Comparison","",
"Generated: "+report.generatedAt,"",
"Samples: "+samples.length,"",
"Reference: ERA5 hourly reanalysis (modelled proxy, not station truth). Rain event threshold >= 0.1 mm/h.","",
"| Model | Proxy | Lead | N | Grid aligned | Temp MAE | Rain MAE | Wind MAE | Wind bias | Rain CSI |",
"|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
...metrics.map(r=>"| "+r.modelLabel+" | "+r.pointId+" | "+r.leadDays+"d | "+r.nRows+" | "+r.gridAlignedRows+" | "+fmt(r.variables.temperature_2m.mae)+" | "+fmt(r.variables.precipitation.mae)+" | "+fmt(r.variables.wind_speed_10m.mae)+" | "+fmt(r.variables.wind_speed_10m.bias)+" | "+fmt(r.rainEvent.csi)+" |"),
"","## Coverage and grid alignment","","| Model | Proxy | Window | Forecast grid | ERA5 grid | Aligned | Matched rows | Status |","|---|---|---|---|---|---|---:|---|",
...coverage.map(c=>c.ok?"| "+c.model+" | "+c.point+" | "+c.window.start+" | "+c.forecastGrid.latitude+", "+c.forecastGrid.longitude+" | "+c.verificationGrid.latitude+", "+c.verificationGrid.longitude+" | "+(c.gridAligned?"yes":"no")+" | "+c.matchedRows+" | ok |":"| "+c.model+" | "+c.point+" | "+c.window.start+" | — | — | — | 0 | "+c.error+" |"),
"","## Limitations",...report.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile("artifacts/okinawa-multimodel-hindcast.md",md);
console.log(md);
if(!samples.length)process.exitCode=1;
