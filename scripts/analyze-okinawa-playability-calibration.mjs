import fs from "node:fs/promises";

const dir="artifacts/okinawa-acceptance";
const jma=JSON.parse(await fs.readFile(dir+"/okinawa-jma-amedas-validation.json","utf8"));
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const thresholds=[1,5,10];
const grouped=new Map();
for(const row of jma.metrics||[]){
 if(row.error||!row.matchedPairs?.precipitation)continue;
 const key=[row.stationId,row.modelId,row.leadDays].join("|");
 const pairs=row.matchedPairs.precipitation.filter(x=>finite(x.forecast)&&finite(x.observed)&&x.quality<=1)
  .sort((a,b)=>a.validTime.localeCompare(b.validTime));
 const windows=[];
 for(let i=0;i+5<pairs.length;i++){
  const slice=pairs.slice(i,i+6);
  if(slice.some((x,j)=>j>0&&Date.parse(x.validTime+":00+09:00")-Date.parse(slice[j-1].validTime+":00+09:00")!==3600000))continue;
  const forecastTotal=slice.reduce((s,x)=>s+x.forecast,0);
  const observedTotal=slice.reduce((s,x)=>s+x.observed,0);
  windows.push({start:slice[0].validTime,end:slice[5].validTime,issueTime:slice[0].issueTime,leadDays:row.leadDays,forecastTotal,observedTotal,error:forecastTotal-observedTotal});
 }
 grouped.set(key,{stationId:row.stationId,stationName:row.stationName,modelId:row.modelId,leadDays:row.leadDays,windows});
}
function eventMetrics(rows,threshold){
 let hit=0,miss=0,falseAlarm=0,correctNegative=0;
 for(const x of rows){const f=x.forecastTotal>=threshold,o=x.observedTotal>=threshold;if(f&&o)hit++;else if(!f&&o)miss++;else if(f&&!o)falseAlarm++;else correctNegative++;}
 const n=rows.length;
 return {thresholdMmPer6h:threshold,n,hit,miss,falseAlarm,correctNegative,pod:hit+miss?hit/(hit+miss):null,far:hit+falseAlarm?falseAlarm/(hit+falseAlarm):null,csi:hit+miss+falseAlarm?hit/(hit+miss+falseAlarm):null};
}
const rows=[...grouped.values()];
const allWindows=rows.flatMap(x=>x.windows);
const dateKeys=new Set(allWindows.map(x=>x.start.slice(0,10)));
const byThreshold=thresholds.map(t=>eventMetrics(allWindows,t));
const mae=allWindows.length?allWindows.reduce((s,x)=>s+Math.abs(x.error),0)/allWindows.length:null;
const bias=allWindows.length?allWindows.reduce((s,x)=>s+x.error,0)/allWindows.length:null;
const rmse=allWindows.length?Math.sqrt(allWindows.reduce((s,x)=>s+x.error*x.error,0)/allWindows.length):null;
const uniqueStationDates=new Set(allWindows.map(x=>x.start.slice(0,10)+"|"+rows.find(r=>r.windows.includes(x))?.stationId));
const report={
 generatedAt:new Date().toISOString(),
 stage:"3 - six-hour playability calibration readiness and rainfall-window diagnostic",
 source:"Timestamp-paired JMA AMeDAS observations and Open-Meteo Previous Runs forecast series",
 observationPeriod:jma.period,
 sample:{stationModelLeadGroups:rows.length,matchedSixHourWindows:allWindows.length,uniqueObservationDates:dateKeys.size,stationDateCombinations:uniqueStationDates.size,stations:[...new Set(rows.map(x=>x.stationId))],models:[...new Set(rows.map(x=>x.modelId))],leads:[...new Set(rows.map(x=>x.leadDays))].sort((a,b)=>a-b)},
 sixHourRainfall:{maeMm:mae,biasMm:bias,rmseMm:rmse,eventMetrics:byThreshold},
 perStationModelLead:rows.map(x=>({stationId:x.stationId,stationName:x.stationName,modelId:x.modelId,leadDays:x.leadDays,windowCount:x.windows.length,maeMm:x.windows.length?x.windows.reduce((s,w)=>s+Math.abs(w.error),0)/x.windows.length:null,biasMm:x.windows.length?x.windows.reduce((s,w)=>s+w.error,0)/x.windows.length:null,events:thresholds.map(t=>eventMetrics(x.windows,t))})),
 calibrationDecision:"HOLD_CURRENT_THRESHOLDS",
 reasons:[
  "The observed sample covers only seven complete days; it cannot represent seasonal, typhoon, monsoon, or inter-annual conditions.",
  "The paired data are station proxies, not measurements on the six golf courses.",
  "This archive currently contains rainfall, temperature and wind previous-run pairs, but does not contain a fully matched six-hour input set for precipitation probability, apparent temperature, gust and weather code.",
  "The current A-E playability score is a composite prototype; a defensible recalibration requires a substantially longer hindcast and complete paired six-hour inputs, plus verified outcome labels or explicitly defined operational thresholds.",
  "Overlapping six-hour windows and repeated model lead groups are not independent samples; raw window count overstates effective sample size."
 ],
 actionsRequired:[
  "Accumulate at least one full seasonal cycle of timestamped archived forecasts and station observations; preferably multiple years and typhoon/rainy-season coverage.",
  "Persist forecast issue time, valid time, model, lead, grid coordinate and all six-hour scoring inputs for every archived run.",
  "Collect course-adjacent observations or document station representativeness and elevation/exposure differences.",
  "Only then fit and out-of-sample validate rain, wind/gust and thermal component weights and grade boundaries."
 ],
 noProductionThresholdsChanged:true
};
await fs.writeFile(dir+"/okinawa-playability-calibration-readiness.json",JSON.stringify(report,null,2));
const fmt=x=>finite(x)?x.toFixed(2):"—";
const md=[
"# Okinawa Six-Hour Playability Calibration Readiness",
"",
"Generated: "+report.generatedAt,
"Observation period: "+(jma.period?.startDate||"—")+" to "+(jma.period?.endDate||"—"),
"",
"**Decision: HOLD CURRENT THRESHOLDS**",
"",
"| Diagnostic | Result |",
"|---|---:|",
"| Station × model × lead groups | "+report.sample.stationModelLeadGroups,
"| Matched consecutive six-hour windows | "+report.sample.matchedSixHourWindows,
"| Unique observation dates | "+report.sample.uniqueObservationDates,
"| Station-date combinations | "+report.sample.stationDateCombinations,
"| Six-hour rainfall MAE | "+fmt(mae)+" mm",
"| Six-hour rainfall bias | "+fmt(bias)+" mm",
"| Six-hour rainfall RMSE | "+fmt(rmse)+" mm",
"",
"## Six-hour rain-event diagnostic",
"",
"| Observed / forecast threshold | N | POD | FAR | CSI |",
"|---|---:|---:|---:|---:|",
...byThreshold.map(x=>"| ≥"+x.thresholdMmPer6h+" mm / 6h | "+x.n+" | "+fmt(x.pod)+" | "+fmt(x.far)+" | "+fmt(x.csi)+" |"),
"",
"## Why no score recalibration is applied",
...report.reasons.map(x=>"- "+x),
"",
"## Required next data",
...report.actionsRequired.map(x=>"- "+x),
"",
"Production threshold changes: **none**. The current score remains explicitly labelled as a prototype and must not be presented as a calibrated probability of cancellation or golfer safety."
].join("\n");
await fs.writeFile(dir+"/okinawa-playability-calibration-readiness.md",md);
console.log(md);
if(allWindows.length===0)process.exitCode=1;
