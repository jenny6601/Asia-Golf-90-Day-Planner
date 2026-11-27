import fs from "node:fs/promises";
import {haversineKm,stationWeights,sampleEligibility,summarizeStationMetric} from "./okinawa-course-source-reliability.js";
const courses=JSON.parse(await fs.readFile("config/global/courses.json","utf8")).filter(x=>x.countryCode==="JP"&&x.region==="Okinawa"&&x.enabled);
const stations=JSON.parse(await fs.readFile("config/okinawa/jma-amedas-stations.json","utf8"));
const assignments=JSON.parse(await fs.readFile("config/okinawa/course-station-assignments.json","utf8"));
const archiveDir="data/okinawa/model-hindcast-archive",outDir="data/okinawa/course-source-reliability";
const files=(await fs.readdir(archiveDir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();
const reports=[];for(const file of files){try{reports.push(JSON.parse(await fs.readFile(archiveDir+"/"+file,"utf8")));}catch{}}
const latest=new Map();
for(const report of reports)for(const row of report.metrics||[]){
 if(row.error)continue;
 for(const variable of ["temperature","precipitation","wind"]){
  const pairs=row.matchedPairs?.[variable]||[];
  for(const pair of pairs){
   if(!Number.isFinite(pair.forecast)||!Number.isFinite(pair.observed)||pair.quality>1)continue;
   const key=[row.modelId,row.stationId,row.leadDays,variable,pair.validTime].join("|");
   const old=latest.get(key);
   if(!old||report.generatedAt>old.generatedAt)latest.set(key,{modelId:row.modelId,modelLabel:row.modelLabel,stationId:row.stationId,leadDays:row.leadDays,variable,validTime:pair.validTime,forecast:pair.forecast,observed:pair.observed,quality:pair.quality,generatedAt:report.generatedAt});
  }
 }
}
const dedup=[...latest.values()],groups=new Map();
for(const p of dedup){const key=[p.modelId,p.stationId,p.leadDays,p.variable].join("|");if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
const stationMetrics=[];
for(const [key,rows] of groups){
 const [modelId,stationId,lead,variable]=key.split("|");
 const errors=rows.map(x=>x.forecast-x.observed),n=rows.length,mae=errors.reduce((s,x)=>s+Math.abs(x),0)/n,bias=errors.reduce((s,x)=>s+x,0)/n,rmse=Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/n);
 const uniqueValidDays=new Set(rows.map(x=>x.validTime.slice(0,10))).size;
 let wetObserved=0,hit=0,miss=0,falseAlarm=0;
 if(variable==="precipitation")for(const p of rows){const f=p.forecast>=1,o=p.observed>=1;if(o)wetObserved++;if(f&&o)hit++;else if(!f&&o)miss++;else if(f&&!o)falseAlarm++;}
 const metric={modelId,modelLabel:rows[0].modelLabel,stationId,leadDays:Number(lead),variable,n,uniqueValidDays,mae,bias,rmse};
 if(variable==="precipitation")Object.assign(metric,{wetObserved,hit,miss,falseAlarm,pod:hit+miss?hit/(hit+miss):null,far:hit+falseAlarm?falseAlarm/(hit+falseAlarm):null,csi:hit+miss+falseAlarm?hit/(hit+miss+falseAlarm):null,rainThresholdMmPerHour:1});
 stationMetrics.push(metric);
}
const entries=[];
for(const course of courses){
 const configured=assignments[course.id]||{};
 for(const variable of ["precipitation","temperature","wind"]){
  const stationRefs=(configured[variable]||[]).map(id=>{
   const station=stations.find(s=>s.id===id);if(!station)return null;
   return {stationId:id,stationName:station.name,distanceKm:Number(haversineKm(course,station).toFixed(2)),stationElevationM:station.elevationM,stationType:station.type};
  }).filter(Boolean);
  const weighted=stationWeights(stationRefs);
  for(const modelId of ["ecmwf_ifs025","jma_gsm","jma_msm"])for(let leadDays=1;leadDays<=7;leadDays++){
   const proxies=weighted.map(proxy=>{
    const metric=stationMetrics.find(x=>x.modelId===modelId&&x.stationId===proxy.stationId&&x.leadDays===leadDays&&x.variable===variable);
    return {...proxy,skill: summarizeStationMetric(metric,variable),sampleEligible:sampleEligibility(metric,variable),sampleStatus:metric?"PRESENT":"NO_MATCHED_SAMPLES"};
   });
   const eligible=proxies.length>0&&proxies.every(x=>x.sampleEligible);
   const anyData=proxies.some(x=>x.skill);
   entries.push({courseId:course.id,courseName:course.name,variable,modelId,leadDays,proxyStations:proxies,assessmentStatus:eligible?"PROVISIONAL_PROXY_EVIDENCE":anyData?"INSUFFICIENT_SAMPLE":"NO_VALIDATION_DATA",interpretation:"Station-level model skill is transferred as proxy evidence only; it is not measured course-level forecast skill."});
  }
 }
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),archiveType:"okinawa-course-source-reliability",sourceArchivesRead:reports.length,uniqueMatchedSamples:dedup.length,courses: courses.map(c=>({courseId:c.id,name:c.name,coordinate:{latitude:c.latitude,longitude:c.longitude}})),method:{stationAssignment:"Uses the explicit variable-specific station assignments also used by the JMA hindcast validator.",distanceWeight:"Inverse-square distance weights (1/distanceKm²), normalized within each course-variable assignment. Current assignments use one station per variable, so weight is 1.0; weights are ready for a future multi-station assignment.",weakProxyThresholdKm:15,sampleGate:{minimumPairs:200,minimumUniqueValidDays:30,precipitationMinimumObservedWetHours:10},rainThresholdMmPerHour:1,leadDefinition:"Previous Runs API previous_day offset; not issue-time verified."},entries,limitations:["Station-to-course transfer is a spatial proxy, not a course-level validation. No on-course sensors are available in this stage.","Course elevations are not reliably present in the inspected course data; elevation correction is deliberately not applied.","A station more than 15 km from a course is flagged WEAK_OVER_15KM; distance alone does not establish terrain or coastal representativeness.","Rainfall skill uses a 1 mm/hour event threshold and must be interpreted with the hourly accumulation alignment caveat.","No model is declared best and no production forecast blending, bias correction, App UI or playability scoring is changed.","The archive needs sufficient independent history: 200 matched pairs and 30 distinct valid dates per station/model/lead/variable; precipitation also needs 10 observed wet hours."]};
await fs.mkdir(outDir,{recursive:true});
const date=new Date().toISOString().slice(0,10);
await fs.writeFile(outDir+"/"+date+".json",JSON.stringify(report,null,2));
const fmt=x=>Number.isFinite(x)?x.toFixed(2):"—";
const md=["# Okinawa Six-Course Source Reliability Projection","", "Generated: "+report.generatedAt,"", "This is a station-to-course proxy evidence report, not course-level ground-truth validation.","","## Coverage","", "- Hindcast archive reports read: "+reports.length,"- Unique matched forecast/observation samples: "+dedup.length,"- Course-variable-model-lead assessments: "+entries.length,"","## Course proxy distances","", "| Course | Variable | Station | Distance | Weight | Proxy status |","|---|---|---|---:|---:|---|",...entries.filter(x=>x.modelId==="ecmwf_ifs025"&&x.leadDays===1).flatMap(x=>x.proxyStations.map(s=>"| "+x.courseName+" | "+x.variable+" | "+s.stationName+" ("+s.stationId+") | "+s.distanceKm+" km | "+s.weight.toFixed(3)+" | "+s.representativeness+" |")),"","## Model and lead assessment","", "| Course | Variable | Model | Lead | N | Days | RMSE | CSI ≥1 mm/h | Status |","|---|---|---|---:|---:|---:|---:|---:|---|",...entries.map(x=>{const s=x.proxyStations[0],m=s?.skill;return "| "+x.courseName+" | "+x.variable+" | "+x.modelId+" | "+x.leadDays+"d | "+(m?.n??0)+" | "+(m?.uniqueValidDays??0)+" | "+fmt(m?.rmse)+" | "+fmt(m?.csi)+" | "+x.assessmentStatus+" |";}),"","## Limitations","",...report.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile(outDir+"/"+date+".md",md);
console.log(md);
