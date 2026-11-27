import fs from "node:fs/promises";

const dir="data/okinawa/model-hindcast-archive",out="data/okinawa/model-source-ranking";
const files=(await fs.readdir(dir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();
const reports=[];for(const file of files){try{reports.push(JSON.parse(await fs.readFile(dir+"/"+file,"utf8")));}catch{}}
const latest=new Map();
for(const report of reports)for(const row of report.metrics||[]){
 if(row.error)continue;
 for(const variable of ["temperature","precipitation","wind"]){
  for(const pair of row.matchedPairs?.[variable]||[]){
   if(!Number.isFinite(pair.forecast)||!Number.isFinite(pair.observed)||pair.quality>1)continue;
   const key=[row.modelId,row.stationId,row.leadDays,variable,pair.validTime].join("|");
   const candidate={modelId:row.modelId,modelLabel:row.modelLabel,stationId:row.stationId,stationName:row.stationName,leadDays:row.leadDays,variable,validTime:pair.validTime,forecast:pair.forecast,observed:pair.observed,quality:pair.quality};
   const prior=latest.get(key);if(!prior||report.generatedAt>prior.generatedAt)latest.set(key,{...candidate,generatedAt:report.generatedAt});
  }
 }
}
const samples=[...latest.values()];
const regions={south:["91241"],central:["91121","91166"],north:["91107"]};
const groups=new Map();
for(const sample of samples){
 const region=Object.entries(regions).find(([,ids])=>ids.includes(sample.stationId))?.[0]||"other";
 for(const scope of ["all",region]){
  const key=[sample.modelId,sample.modelLabel,sample.leadDays,sample.variable,scope].join("|");
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(sample);
 }
}
const calc=rows=>{
 const errors=rows.map(x=>x.forecast-x.observed),n=rows.length;
 const mae=n?errors.reduce((s,x)=>s+Math.abs(x),0)/n:null,bias=n?errors.reduce((s,x)=>s+x,0)/n:null,rmse=n?Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/n):null;
 if(rows[0]?.variable!=="precipitation")return {n,mae,bias,rmse};
 let hit=0,miss=0,falseAlarm=0,wetObserved=0;
 for(const x of rows){const f=x.forecast>=1,o=x.observed>=1;if(o)wetObserved++;if(f&&o)hit++;else if(!f&&o)miss++;else if(f&&!o)falseAlarm++;}
 return {n,mae,bias,rmse,rainThresholdMmPerHour:1,wetObserved,hit,miss,falseAlarm,pod:hit+miss?hit/(hit+miss):null,far:hit+falseAlarm?falseAlarm/(hit+falseAlarm):null,csi:hit+miss+falseAlarm?hit/(hit+miss+falseAlarm):null};
};
const entries=[...groups.entries()].map(([key,rows])=>{
 const [modelId,modelLabel,leadDays,variable,region]=key.split("|");
 const stats=calc(rows),uniqueDays=new Set(rows.map(x=>x.validTime.slice(0,10))).size;
 const enough=stats.n>=200&&uniqueDays>=30&&(variable!=="precipitation"||stats.wetObserved>=10);
 return {modelId,modelLabel,leadDays:Number(leadDays),variable,region,...stats,uniqueValidDays:uniqueDays,rankingStatus:enough?"ELIGIBLE_FOR_PROVISIONAL_RANKING":"INSUFFICIENT_SAMPLE"};
});
const rankGroups=new Map();
for(const row of entries){if(row.rankingStatus!=="ELIGIBLE_FOR_PROVISIONAL_RANKING")continue;const key=[row.leadDays,row.variable,row.region].join("|");if(!rankGroups.has(key))rankGroups.set(key,[]);rankGroups.get(key).push(row);}
for(const rows of rankGroups.values()){
 rows.sort((a,b)=>a.variable==="precipitation"?(b.csi-a.csi||a.rmse-b.rmse):(a.rmse-b.rmse));
 rows.forEach((row,index)=>row.provisionalRank=index+1);
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),archiveType:"okinawa-model-source-reliability-ranking",hindcastReportsRead:reports.length,uniqueMatchedSamples:samples.length,models:[...new Set(samples.map(x=>x.modelId))],leadDefinition:"Previous Runs API previous_day offset (1-7). This is a fixed API hindcast lead, not retrieval age.",sampleGate:{minimumPairs:200,minimumUniqueValidDays:30,minimumObservedRainEvents:10,rankingBeforeGate:"disabled"},rankingMethod:{temperature:"ascending RMSE",wind:"ascending RMSE",precipitation:"descending CSI at >=1 mm/hour, then ascending RMSE",scope:"All stations and south/central/north station groups are reported separately."},entries,limitations:["Only ECMWF IFS 0.25°, JMA GSM and JMA MSM are included in this hindcast comparison; this is not a ranking of all commercial weather providers.","Stations 91107, 91241, 91121 and 91166 are proxies; their element coverage differs.","The current archive begins with seven-day rolling verification windows. Overlapping windows are deduplicated by model, station, lead, variable and valid time.","A model is not ranked until at least 200 matched pairs and 30 distinct valid dates are available; precipitation also requires at least ten observed wet hours.","Rainfall comparisons require confirmation that model and JMA hourly accumulation intervals align exactly.","A regional or model rank is descriptive evidence, not a guarantee for an individual golf course.","No production forecast blending, bias correction, or playability threshold is changed."]};
await fs.mkdir(out,{recursive:true});
const date=new Date().toISOString().slice(0,10);await fs.writeFile(out+"/"+date+".json",JSON.stringify(report,null,2));
const fmt=x=>Number.isFinite(x)?x.toFixed(3):"—";
const md=["# Okinawa Model Source Reliability Ranking","", "- Generated: "+report.generatedAt,"- Hindcast reports read: "+reports.length,"- Unique matched samples: "+samples.length,"- Eligible ranked groups: "+[...rankGroups.keys()].length,"","Ranking is intentionally withheld until each model/lead/region/variable group reaches the minimum sample gate.","","| Model | Region | Lead | Variable | N | Days | RMSE | CSI ≥1 mm/h | Status | Rank |","|---|---|---:|---|---:|---:|---:|---:|---|---:|",...entries.map(x=>"| "+x.modelLabel+" | "+x.region+" | "+x.leadDays+"d | "+x.variable+" | "+x.n+" | "+x.uniqueValidDays+" | "+fmt(x.rmse)+" | "+fmt(x.csi)+" | "+x.rankingStatus+" | "+(x.provisionalRank??"—")+" |"),"","## Method and limitations",...report.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile(out+"/"+date+".md",md);
console.log(md);
