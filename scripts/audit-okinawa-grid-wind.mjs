import fs from "node:fs/promises";

const candidates = [
  { id:"south-itanman-current", label:"Current southern proxy", latitude:26.1240, longitude:127.6650 },
  { id:"south-yaese", label:"Yaese south coast proxy", latitude:26.0600, longitude:127.7000 },
  { id:"south-itoman-coast", label:"Southern Itoman proxy", latitude:26.0000, longitude:127.7000 },
  { id:"south-hirayamacho", label:"Southern Itoman inland proxy", latitude:25.9700, longitude:127.6800 },
  { id:"central-reference", label:"Central reference", latitude:26.3344, longitude:127.8056 },
  { id:"north-reference", label:"North reference", latitude:26.5916, longitude:127.9774 }
];
const windows = [
  { start:"2025-01-15", end:"2025-01-21", season:"winter" },
  { start:"2025-07-15", end:"2025-07-21", season:"summer" }
];
const headers={"User-Agent":"Asia-Golf-90-Day-Planner-grid-wind-audit/1.0"};
async function getJson(url){
  const r=await fetch(url,{headers});
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error("HTTP "+r.status+" "+(body.reason??""));
  return body;
}
function stats(a,b){
  const pairs=[];
  for(let i=0;i<Math.min(a?.length??0,b?.length??0);i++)
    if(Number.isFinite(a[i])&&Number.isFinite(b[i])) pairs.push([a[i],b[i]]);
  if(!pairs.length)return {n:0,mae:null,bias:null,forecastMean:null,referenceMean:null};
  const d=pairs.map(([f,o])=>f-o);
  return {n:pairs.length,mae:d.reduce((s,x)=>s+Math.abs(x),0)/d.length,bias:d.reduce((s,x)=>s+x,0)/d.length,forecastMean:pairs.reduce((s,x)=>s+x[0],0)/pairs.length,referenceMean:pairs.reduce((s,x)=>s+x[1],0)/pairs.length};
}
const results=[];
for(const p of candidates){
 for(const w of windows){
  const common={latitude:String(p.latitude),longitude:String(p.longitude),start_date:w.start,end_date:w.end,timezone:"Asia/Tokyo",wind_speed_unit:"ms",temperature_unit:"celsius",precipitation_unit:"mm"};
  const fp=new URLSearchParams({...common,hourly:"wind_speed_10m_previous_day1,temperature_2m_previous_day1,precipitation_previous_day1",models:"ecmwf_ifs025"});
  const ap=new URLSearchParams({...common,hourly:"wind_speed_10m,temperature_2m,precipitation",models:"era5"});
  try{
   const [f,o]=await Promise.all([
    getJson("https://previous-runs-api.open-meteo.com/v1/forecast?"+fp),
    getJson("https://archive-api.open-meteo.com/v1/archive?"+ap)
   ]);
   const fw=f.hourly?.wind_speed_10m_previous_day1??[];
   const ow=o.hourly?.wind_speed_10m??[];
   results.push({
    point:p,window:w,
    forecastGrid:{latitude:f.latitude,longitude:f.longitude,elevation:f.elevation},
    era5Grid:{latitude:o.latitude,longitude:o.longitude,elevation:o.elevation},
    forecastUnits:f.hourly_units??null,era5Units:o.hourly_units??null,
    wind:stats(fw,ow),
    forecastWindNonNull:fw.filter(Number.isFinite).length,
    era5WindNonNull:ow.filter(Number.isFinite).length,
    forecastWindSample:fw.slice(0,8),era5WindSample:ow.slice(0,8),
    forecastModel:f.model??null
   });
  }catch(e){results.push({point:p,window:w,error:String(e)});}
 }
}
const unique=[...new Set(results.filter(x=>x.forecastGrid).map(x=>x.forecastGrid.latitude+","+x.forecastGrid.longitude))];
const report={generatedAt:new Date().toISOString(),purpose:"Grid-cell and wind-unit diagnostic only; ERA5 is a reanalysis reference proxy, not station truth.",candidateCount:candidates.length,windowCount:windows.length,uniqueForecastGridCount:unique.length,uniqueForecastGrids:unique,results,guardrails:["Do not treat API grid coordinates as course GPS validation.","Do not change production wind thresholds from this diagnostic.","ERA5 is a modelled reference, not direct on-course observation."]};
await fs.mkdir("artifacts",{recursive:true});
await fs.writeFile("artifacts/okinawa-grid-wind-audit.json",JSON.stringify(report,null,2));
const md=["# Okinawa Grid and Wind Audit","", "Generated: "+report.generatedAt,"", "Unique forecast grid cells: "+unique.length,"", "| Candidate | Window | Forecast grid | ERA5 grid | Wind n | MAE (m/s) | Bias (m/s) | Forecast mean | ERA5 mean | Units |","|---|---|---|---|---:|---:|---:|---:|---:|---|",...results.map(x=>x.error?"| "+x.point.id+" | "+x.window.start+" | ERROR | — | 0 | — | — | — | — | — |":"| "+x.point.id+" | "+x.window.start+" | "+x.forecastGrid.latitude+", "+x.forecastGrid.longitude+" | "+x.era5Grid.latitude+", "+x.era5Grid.longitude+" | "+x.wind.n+" | "+(x.wind.mae?.toFixed(2)??"—")+" | "+(x.wind.bias?.toFixed(2)??"—")+" | "+(x.wind.forecastMean?.toFixed(2)??"—")+" | "+(x.wind.referenceMean?.toFixed(2)??"—")+" | "+(x.forecastUnits?.wind_speed_10m_previous_day1??"?")+" / "+(x.era5Units?.wind_speed_10m??"?")+" |"),"","## Guardrails",...report.guardrails.map(x=>"- "+x)].join("\n");
await fs.writeFile("artifacts/okinawa-grid-wind-audit.md",md);
console.log(md);
if(!results.some(x=>x.forecastGrid))process.exitCode=1;
