import fs from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {regressionMetrics,categoricalRainMetrics} from "../assets/js/hindcast-metrics.js";

export const TEE_HOURS=Array.from({length:8},(_,i)=>i+6);
export const RAIN_THRESHOLDS=[0.1,1,5];

const finite=x=>typeof x==="number"&&Number.isFinite(x);
const key=(s)=>[s.modelId,s.pointId,s.leadHours,s.validTime.slice(0,10)].join("|");

export function buildSixHourWindows(samples, teeHours=TEE_HOURS) {
 const bySeriesDay=new Map();
 for(const s of samples??[]){
  if(!s?.validTime||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s.validTime))continue;
  const k=key(s); if(!bySeriesDay.has(k))bySeriesDay.set(k,[]);
  bySeriesDay.get(k).push(s);
 }
 const out=[], rejected=[];
 for(const [seriesKey,rows] of bySeriesDay){
  const byTime=new Map(rows.map(r=>[r.validTime,r]));
  const [modelId,pointId,leadHours,date]=seriesKey.split("|");
  for(const teeHour of teeHours){
   const selected=[];
   for(let h=0;h<6;h++){
    const stamp=date+"T"+String(teeHour+h).padStart(2,"0")+":00";
    const row=byTime.get(stamp);
    if(!row){selected.length=0;break;}
    selected.push(row);
   }
   if(selected.length!==6){rejected.push({modelId,pointId,leadHours,date,teeHour,reason:"missing-hour"});continue;}
   const required=["precipitation","wind_speed_10m"];
   const missing=required.filter(v=>selected.some(r=>!finite(r.forecast?.[v])||!finite(r.verification?.[v])));
   if(missing.length){rejected.push({modelId,pointId,leadHours,date,teeHour,reason:"missing-values",fields:missing});continue;}
   const sum=(arr,side,field)=>arr.reduce((a,r)=>a+r[side][field],0);
   const peak=(arr,side,field)=>Math.max(...arr.map(r=>r[side][field]));
   const fRain=sum(selected,"forecast","precipitation"),oRain=sum(selected,"verification","precipitation");
   const fWind=peak(selected,"forecast","wind_speed_10m"),oWind=peak(selected,"verification","wind_speed_10m");
   out.push({modelId,pointId,leadHours:Number(leadHours),date,month:date.slice(0,7),season:selected[0].season,teeHour,
    startLocal:date+"T"+String(teeHour).padStart(2,"0")+":00",endLocal:date+"T"+String(teeHour+5).padStart(2,"0")+":00",
    forecastRain6hMm:fRain,verificationRain6hMm:oRain,forecastMaxWindMs:fWind,verificationMaxWindMs:oWind,
    gridAligned:selected.every(r=>r.gridAligned),forecastGrid:selected[0].forecastGrid,verificationGrid:selected[0].verificationGrid,
    sourceHours:6});
  }
 }
 return {windows:out,rejected};
}

function eventScores(windows,threshold){
 const paired=windows.map(w=>({f:w.forecastRain6hMm>=threshold,o:w.verificationRain6hMm>=threshold}));
 const m=categoricalRainMetrics(paired,"f","o");
 const precision=m.hit+m.falseAlarm?m.hit/(m.hit+m.falseAlarm):null;
 const recall=m.pod;
 const f1=precision!==null&&recall!==null&&precision+recall?2*precision*recall/(precision+recall):null;
 return {...m,precision,recall,f1,thresholdMmPer6h:threshold};
}
export function summarizeSixHourWindows(windows){
 const rain=regressionMetrics(windows.map(w=>({f:w.forecastRain6hMm,o:w.verificationRain6hMm})),"f","o");
 const wind=regressionMetrics(windows.map(w=>({f:w.forecastMaxWindMs,o:w.verificationMaxWindMs})),"f","o");
 return {nWindows:windows.length,gridAlignedWindows:windows.filter(w=>w.gridAligned).length,
  sixHourRainMm:rain,maxHourlyWindMs:wind,
  rainEvents:Object.fromEntries(RAIN_THRESHOLDS.map(t=>[String(t),eventScores(windows,t)]))};
}

export function clusterBootstrapIntervals(windows,iterations=500,seed=20261123){
 const dates=[...new Set(windows.map(w=>w.date))].sort();
 if(!dates.length)return {clusterCount:0,iterations,rainMae:null,rainBias:null,windMae:null,windBias:null,rainCsi:{}};
 let state=seed>>>0;
 const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};
 const values={rainMae:[],rainBias:[],windMae:[],windBias:[],rainCsi:Object.fromEntries(RAIN_THRESHOLDS.map(t=>[String(t),[]]))};
 for(let b=0;b<iterations;b++){
  const picked=[];
  for(let i=0;i<dates.length;i++){const d=dates[Math.floor(random()*dates.length)];picked.push(...windows.filter(w=>w.date===d));}
  const s=summarizeSixHourWindows(picked);
  for(const k of ["rainMae","rainBias","windMae","windBias"]){
   const metric=k.startsWith("rain")?s.sixHourRainMm:s.maxHourlyWindMs;
   const field=k.endsWith("Mae")?"mae":"bias";if(finite(metric[field]))values[k].push(metric[field]);
  }
  for(const t of RAIN_THRESHOLDS){const v=s.rainEvents[String(t)].csi;if(finite(v))values.rainCsi[String(t)].push(v);}
 }
 const ci=a=>{if(!a.length)return null;a.sort((x,y)=>x-y);return {lower:a[Math.floor(.025*(a.length-1))],upper:a[Math.ceil(.975*(a.length-1))],validReplicates:a.length};};
 return {clusterUnit:"local-date; all tee-time windows from a sampled date stay together",clusterCount:dates.length,iterations,
  rainMae:ci(values.rainMae),rainBias:ci(values.rainBias),windMae:ci(values.windMae),windBias:ci(values.windBias),
  rainCsi:Object.fromEntries(RAIN_THRESHOLDS.map(t=>[String(t),ci(values.rainCsi[String(t)])]))};
}

export function buildReport(samples){
 const {windows,rejected}=buildSixHourWindows(samples);
 const groups={};
 for(const w of windows){
  const k=[w.modelId,w.pointId,w.leadHours].join("|");
  (groups[k]??=[]).push(w);
 }
 const summaries=Object.entries(groups).map(([k,ws])=>{
  const [modelId,pointId,leadHours]=k.split("|");
  const monthly={};
  for(const month of [...new Set(ws.map(w=>w.month))].sort())monthly[month]=summarizeSixHourWindows(ws.filter(w=>w.month===month));
  const teeTime={};
  for(const hour of TEE_HOURS)teeTime[String(hour).padStart(2,"0")+":00"]=summarizeSixHourWindows(ws.filter(w=>w.teeHour===hour));
  return {modelId,pointId,leadHours:Number(leadHours),overall:summarizeSixHourWindows(ws),confidenceIntervals:clusterBootstrapIntervals(ws),monthly,teeTime};
 });
 return {generatedAt:new Date().toISOString(),timezone:"Asia/Tokyo",windowDefinition:"Six hourly samples: tee-off hour through tee-off +5h, inclusive; each sample is the hourly value labelled by validTime.",
  teeHours:TEE_HOURS,rainThresholdsMmPer6h:RAIN_THRESHOLDS,sampleCount:samples.length,validSixHourWindows:windows.length,rejectedWindows:rejected.length,
  uniqueDates:[...new Set(windows.map(w=>w.date))].length,summaries,rejected,windows,
  limitations:["ERA5 is a reanalysis reference proxy, not station, rain-gauge, or on-course truth.",
   "Only six-hour accumulated precipitation and six-hour maximum hourly 10 m wind are evaluated; archived gust, apparent temperature and weather-code thunderstorm fields are not validated here.",
   "This is a partial validation of the playability overlay, not validation of the complete grade or cancellation decision.",
   "Rain event thresholds 0.1, 1 and 5 mm/6h are exploratory sensitivity thresholds, not calibrated operational cut-offs.",
   "Only north and central-south-shared proxy points are represented; central and south are not independent locations.",
   "Only the sampled 15th–21st windows of each month in 2025 are included; this is not a complete annual hindcast.",
   "Windows with any missing hour or required precipitation/wind value are rejected, never interpolated.",
   "Different forecast model grids and ERA5 native grid snapping remain a spatial representativeness limitation.",
   "No production model, rain-risk threshold, wind threshold or golf suitability grade is changed."]};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const input=JSON.parse(await fs.readFile("artifacts/okinawa-multimodel-hindcast.json","utf8"));
 const report=buildReport(input.samples??[]);
 await fs.writeFile("artifacts/okinawa-6h-playability-report.json",JSON.stringify(report,null,2));
 const fmt=x=>x===null||x===undefined?"—":x.toFixed(3);
 const ci=x=>x?fmt(x.lower)+"–"+fmt(x.upper):"—";
 const lines=["# Okinawa 6-hour tee-time multi-model validation","",
 "Generated: "+report.generatedAt,"",
 "Valid six-hour windows: "+report.validSixHourWindows+"; rejected: "+report.rejectedWindows+"; source hourly rows: "+report.sampleCount,"",
 "Window: Japan local tee time 06:00–13:00; six hourly samples from tee-off hour through +5h. Rain thresholds are exploratory.",
 "",
 "| Model | Proxy | Lead | N windows | Grid aligned | Rain MAE mm/6h (95% CI) | Wind max MAE (95% CI) | CSI ≥0.1 | CSI ≥1 | CSI ≥5 |",
 "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
 ...report.summaries.map(s=>{const o=s.overall,ci95=s.confidenceIntervals;return "| "+s.modelId+" | "+s.pointId+" | "+s.leadHours/24+"d | "+o.nWindows+" | "+o.gridAlignedWindows+" | "+fmt(o.sixHourRainMm.mae)+" ("+ci(ci95.rainMae)+") | "+fmt(o.maxHourlyWindMs.mae)+" ("+ci(ci95.windMae)+") | "+fmt(o.rainEvents["0.1"].csi)+" | "+fmt(o.rainEvents["1"].csi)+" | "+fmt(o.rainEvents["5"].csi)+" |";}),
 "","## Monthly sample counts and rain MAE","","| Model | Proxy | Lead | Month | N windows | Rain MAE mm/6h | CSI ≥1mm |","|---|---|---:|---|---:|---:|---:|",
 ...report.summaries.flatMap(s=>Object.entries(s.monthly).map(([m,v])=>"| "+s.modelId+" | "+s.pointId+" | "+s.leadHours/24+"d | "+m+" | "+v.nWindows+" | "+fmt(v.sixHourRainMm.mae)+" | "+fmt(v.rainEvents["1"].csi)+" |")),
 "","## Limitations",...report.limitations.map(x=>"- "+x)];
 await fs.writeFile("artifacts/okinawa-6h-playability-report.md",lines.join("\n"));
 console.log(lines.join("\n"));
 if(!report.validSixHourWindows)process.exitCode=1;
}
