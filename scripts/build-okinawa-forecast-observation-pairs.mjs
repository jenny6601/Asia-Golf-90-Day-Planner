import fs from "node:fs/promises";

const forecastDir="data/okinawa/forecast-archive",observationDir="data/okinawa/jma-observation-archive",outputDir="data/okinawa/forecast-observation-pairs";
const list=async dir=>(await fs.readdir(dir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();
const read=async(dir,file)=>JSON.parse(await fs.readFile(dir+"/"+file,"utf8"));
const [forecastFiles,observationFiles]=await Promise.all([list(forecastDir),list(observationDir)]);
const observations=new Map();
for(const file of observationFiles){
 const archive=await read(observationDir,file);
 for(const station of archive.stations||[])for(const row of station.rows||[]){
  const key=station.station.id+"|"+row.time;
  const old=observations.get(key);
  if(!old||archive.retrievedAt>old.archiveRetrievedAt)observations.set(key,{station:station.station,row,archiveRetrievedAt:archive.retrievedAt});
 }
}
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const variables=[
 {id:"temperature",forecast:"temperature_2m",observed:"temperature",unit:"°C"},
 {id:"precipitation",forecast:"precipitation",observed:"precipitation1h",unit:"mm"},
 {id:"windSpeed",forecast:"wind_speed_10m",observed:"windSpeed",unit:"m/s"},
 {id:"gust",forecast:"wind_gusts_10m",observed:"gust",unit:"m/s",exploratory:true}
];
function metric(rows){
 const n=rows.length;if(!n)return {n:0,mae:null,bias:null,rmse:null};
 const e=rows.map(x=>x.forecast-x.observed);
 return {n,mae:e.reduce((s,x)=>s+Math.abs(x),0)/n,bias:e.reduce((s,x)=>s+x,0)/n,rmse:Math.sqrt(e.reduce((s,x)=>s+x*x,0)/n)};
}
function probabilityMetric(rows){
 const usable=rows.filter(x=>finite(x.probability)&&finite(x.event));
 return {n:usable.length,brierScore:usable.length?usable.reduce((s,x)=>s+(x.probability/100-x.event)**2,0)/usable.length:null};
}
const pairs=[];
for(const file of forecastFiles){
 const archive=await read(forecastDir,file);
 if(!archive.retrievedAt||!Array.isArray(archive.stationRecords))continue;
 const retrievalMs=Date.parse(archive.retrievedAt);
 for(const record of archive.stationRecords){
  const station=record.station;
  const times=record.hourly?.time||[];
  for(let i=0;i<times.length;i++){
   const validTime=times[i],validMs=Date.parse(validTime+"+09:00");
   if(!Number.isFinite(validMs)||validMs<=retrievalMs)continue;
   const obs=observations.get(station.id+"|"+validTime);
   if(!obs)continue;
   const leadHours=(validMs-retrievalMs)/3600000;
   for(const variable of variables){
    const f=record.hourly?.[variable.forecast]?.[i],o=obs.row?.[variable.observed];
    if(finite(f)&&o?.usable&&finite(o.value)){
     pairs.push({retrievedAt:archive.retrievedAt,validTime,stationId:station.id,stationName:station.name,area:station.area,latitude:station.latitude,longitude:station.longitude,forecastGrid:record.grid,model:record.model??null,leadHours:Number(leadHours.toFixed(2)),leadBucketHours:Math.ceil(leadHours/24)*24,variable:variable.id,unit:variable.unit,forecast:f,observed:o.value,observationQuality:o.quality,observationArchiveRetrievedAt:obs.archiveRetrievedAt,exploratory:!!variable.exploratory});
    }
   }
   const probability=record.hourly?.precipitation_probability?.[i],rain=obs.row?.precipitation1h;
   if(finite(probability)&&rain?.usable&&finite(rain.value)){
    pairs.push({retrievedAt:archive.retrievedAt,validTime,stationId:station.id,stationName:station.name,area:station.area,latitude:station.latitude,longitude:station.longitude,forecastGrid:record.grid,model:record.model??null,leadHours:Number(leadHours.toFixed(2)),leadBucketHours:Math.ceil(leadHours/24)*24,variable:"rainProbability",unit:"%",probability,event:rain.value>=0.1?1:0,observedRainMm:rain.value,observationQuality:rain.quality,observationArchiveRetrievedAt:obs.archiveRetrievedAt});
   }
  }
 }
}
const groups=new Map();
for(const pair of pairs){const key=[pair.stationId,pair.model||"model-unspecified",pair.leadBucketHours,pair.variable].join("|");if(!groups.has(key))groups.set(key,[]);groups.get(key).push(pair);}
const metrics=[...groups.entries()].map(([key,rows])=>{
 const first=rows[0];return {stationId:first.stationId,stationName:first.stationName,area:first.area,model:first.model,leadBucketHours:first.leadBucketHours,variable:first.variable,exploratory:!!first.exploratory,...(first.variable==="rainProbability"?probabilityMetric(rows):metric(rows))};
});
const uniqueValidTimes=new Set(pairs.map(x=>x.stationId+"|"+x.validTime));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),archiveType:"station-coordinate-forecast-observation-pairs",forecastSnapshotsRead:forecastFiles.length,observationSnapshotsRead:observationFiles.length,forecastSnapshotsWithStationRecords:forecastFiles.filter(async f=>(await read(forecastDir,f)).stationRecords?.length).length,pairedRows:pairs.length,uniqueStationValidTimes:uniqueValidTimes.size,variables:[...new Set(pairs.map(x=>x.variable))],pairingRules:{station:"Exact JMA station ID and station coordinates are used for forecast requests; no course-to-station nearest-neighbour substitution.",validTime:"Exact Asia/Tokyo hourly valid timestamp match.",forecastTime:"Forecast snapshot retrieval time is retained. leadHours is retrieval-to-valid-time age, NOT provider model issue-time lead.",observations:"Only usable JMA quality 0/1 numeric readings are paired.",rainProbabilityEvent:"Observed hourly precipitation >=0.1 mm is labelled a wet hour.",gust:"Retained as exploratory only; JMA gust is a maximum instantaneous measure and is not fully equivalent to model hourly maximum gust."},metrics,pairs,limitations:["Only snapshots containing stationRecords (archive schema v2+) can be paired; older course-only snapshots are excluded.","A pair is a station-grid comparison, not an on-course validation.","Open-Meteo provider model/run initialisation time is not exposed by the Forecast API snapshot; do not describe retrieval age as true model lead.","Hourly precipitation interval boundary equivalence between Open-Meteo and JMA must be confirmed before interpreting rain error as strict like-for-like.","The rolling seven-day observation archives overlap; observations are deduplicated by station ID and valid time, preferring the latest retrieval. Forecast snapshots remain distinct by retrieval time.","Rain probability Brier score uses a 0.1 mm/h observed wet-hour threshold; it is a diagnostic and is not calibration of course suitability."]};
await fs.mkdir(outputDir,{recursive:true});
const date=new Date().toISOString().slice(0,10);
await fs.writeFile(outputDir+"/"+date+".json",JSON.stringify(report,null,2));
const fmt=x=>finite(x)?x.toFixed(3):"—";
const md=["# Okinawa Forecast–JMA Observation Paired Dataset","", "- Generated: "+report.generatedAt,"- Forecast snapshots read: "+forecastFiles.length,"- Observation snapshots read: "+observationFiles.length,"- Matched pairs: "+pairs.length,"- Unique station-valid timestamps: "+uniqueValidTimes.size,"","## Pairing rules","- Exact station ID and exact hourly Asia/Tokyo valid-time match.","- Only JMA quality 0/1 observations are accepted.","- Retrieval-to-valid-time age is not provider model lead time.","","## Metrics by station, model, lead-age bucket and variable","","| Station | Model | Retrieval age bucket | Variable | N | MAE | Bias | RMSE / Brier |","|---|---|---:|---|---:|---:|---:|---:|",...metrics.map(x=>"| "+x.stationName+" | "+(x.model||"unspecified")+" | "+x.leadBucketHours+"h | "+x.variable+" | "+x.n+" | "+fmt(x.mae)+" | "+fmt(x.bias)+" | "+fmt(x.rmse??x.brierScore)+" |"),"","## Limitations",...report.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile(outputDir+"/"+date+".md",md);
console.log(md);
if(pairs.length===0)process.exitCode=1;
