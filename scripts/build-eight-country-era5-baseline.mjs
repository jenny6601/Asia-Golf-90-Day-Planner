import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";

const ROOT=new URL("../",import.meta.url);
const DATA_DIR=new URL("../public/data/long-range/",import.meta.url);
const CHECKPOINT_DIR=new URL("../public/data/long-range/era5-checkpoints/",import.meta.url);
const FINAL_URL=new URL("../public/data/long-range/era5-1991-2020-normals.json",import.meta.url);
const FINAL_PATH="public/data/long-range/era5-1991-2020-normals.json";
const CHECKPOINT_PATH="public/data/long-range/era5-checkpoints";
const BRANCH="asia-eight-country-shared-engine";
const BATCH_SIZE=10;
const [courses,registry]=await Promise.all([
  fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8").then(JSON.parse),
  fs.readFile(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8").then(JSON.parse)
]);
const byCourse=new Map(courses.map(course=>[course.id,course]));
const regions=registry.countries.flatMap(country=>(country.subregions||[]).map(region=>{
  const course=byCourse.get(region.representativeCourseId);
  if(!course||!Number.isFinite(region.candidateCoordinates?.latitude)||!Number.isFinite(region.candidateCoordinates?.longitude)||!region.candidateCoordinates?.timezone)throw new Error("Invalid representative point: "+region.id);
  return {id:region.id,countryCode:country.countryCode,label:region.label||region.subregion,latitude:region.candidateCoordinates.latitude,longitude:region.candidateCoordinates.longitude,timezone:region.candidateCoordinates.timezone};
}));
if(regions.length!==80||new Set(regions.map(x=>x.id)).size!==80)throw new Error("Expected exactly 80 unique regional points");

const START="1991-01-01",END="2020-12-31";
const DAILY="temperature_2m_max,temperature_2m_min,dew_point_2m_mean,relative_humidity_2m_mean,wind_speed_10m_mean,precipitation_sum";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const batchName=index=>"batch-"+String(index+1).padStart(2,"0")+".json";
const batchPath=index=>CHECKPOINT_PATH+"/"+batchName(index);
const batchUrl=index=>new URL(batchName(index),CHECKPOINT_DIR);
const finiteOrNull=value=>value===null||Number.isFinite(value);

function validateRegion(region,expected){
  if(!region||region.id!==expected.id||region.status!=="complete"||!Array.isArray(region.daily)||region.daily.length!==365)throw new Error("Invalid checkpoint region structure: "+expected.id);
  for(let i=0;i<365;i++){
    const day=region.daily[i];
    if(day?.dayOfYear!==i+1)throw new Error("Invalid day-of-year sequence: "+expected.id+" day "+(i+1));
    for(const key of ["rainFrequency","rainMean","rainP10","rainP50","rainP90","highMean","lowMean","highP90","lowP10"])
      if(!finiteOrNull(day[key]))throw new Error("Invalid numeric field "+key+": "+expected.id+" day "+(i+1));
    for(const key of ["rain","high","low"]){
      const n=day.sampleDays?.[key];
      if(!Number.isInteger(n)||n<1||n>930)throw new Error("Invalid sample count "+key+": "+expected.id+" day "+(i+1));
    }
    if(!Number.isFinite(day.rainSampleYears)||day.rainSampleYears<1||day.rainSampleYears>30||
       !Number.isFinite(day.temperatureSampleYears)||day.temperatureSampleYears<1||day.temperatureSampleYears>30)
      throw new Error("Invalid sample-year count: "+expected.id+" day "+(i+1));
  }
  return true;
}
function validateCheckpoint(checkpoint,index,batch){
  if(checkpoint?.schemaVersion!==1||checkpoint?.referencePeriod!=="1991-2020"||checkpoint?.batchIndex!==index||
     !Array.isArray(checkpoint.regionIds)||checkpoint.regionIds.length!==batch.length||
     !checkpoint.regions||Object.keys(checkpoint.regions).length!==batch.length)
    throw new Error("Checkpoint metadata mismatch: "+batchName(index));
  for(let i=0;i<batch.length;i++){
    if(checkpoint.regionIds[i]!==batch[i].id)throw new Error("Checkpoint region order mismatch: "+batchName(index));
    validateRegion(checkpoint.regions[batch[i].id],batch[i]);
  }
  return checkpoint;
}
async function loadCheckpoint(index,batch){
  try{
    const checkpoint=JSON.parse(await fs.readFile(batchUrl(index),"utf8"));
    validateCheckpoint(checkpoint,index,batch);
    console.log("Validated saved checkpoint:",batchName(index),batch.map(x=>x.id).join(", "));
    return checkpoint;
  }catch(error){
    if(error.code!=="ENOENT")console.warn("Checkpoint invalid; this batch will be downloaded again:",batchName(index),error.message);
    return null;
  }
}
async function saveCheckpoint(index,batch,batchRegions){
  const checkpoint={schemaVersion:1,provider:"Open-Meteo Historical Weather API",model:"ERA5 reanalysis",referencePeriod:"1991-2020",batchIndex:index,regionIds:batch.map(x=>x.id),savedAt:new Date().toISOString(),regions:batchRegions};
  validateCheckpoint(checkpoint,index,batch);
  await fs.mkdir(CHECKPOINT_DIR,{recursive:true});
  const temp=new URL(batchName(index)+".tmp",CHECKPOINT_DIR);
  await fs.writeFile(temp,JSON.stringify(checkpoint));
  await fs.rename(temp,batchUrl(index));
  console.log("Checkpoint saved and validated:",batchName(index));
  if(process.env.GITHUB_ACTIONS==="true"){
    execFileSync("git",["add",batchPath(index)],{stdio:"inherit"});
    try{execFileSync("git",["commit","-m","Save ERA5 checkpoint "+(index+1)+"/8"],{stdio:"inherit"});}
    catch(error){
      if(!String(error.message).includes("exit code 1"))throw error;
      console.log("No checkpoint file changes to commit.");
    }
    execFileSync("git",["push","origin",BRANCH],{stdio:"inherit"});
    console.log("Checkpoint committed to",BRANCH);
  }
}
async function fetchBatch(batch){
  const q=new URLSearchParams({
    latitude:batch.map(x=>x.latitude).join(","),
    longitude:batch.map(x=>x.longitude).join(","),
    start_date:START,end_date:END,daily:DAILY,
    timezone:batch.map(x=>x.timezone).join(","),
    temperature_unit:"celsius",wind_speed_unit:"ms",precipitation_unit:"mm",models:"era5"
  });
  const url="https://archive-api.open-meteo.com/v1/archive?"+q;
  let lastError=null;
  for(let attempt=0;attempt<9;attempt++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(180000)});
      if(response.ok){
        const payload=await response.json();
        const items=Array.isArray(payload)?payload:[payload];
        if(items.length!==batch.length)throw new Error("ERA5 batch response count mismatch");
        return items;
      }
      if(response.status!==429&&response.status<500)throw new Error("ERA5 batch HTTP "+response.status+": "+(await response.text()).slice(0,300));
      const retryAfter=Number(response.headers.get("retry-after"));
      lastError=new Error("ERA5 batch HTTP "+response.status);
      await sleep(Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:Math.min(120000,10000*Math.pow(2,attempt)));
    }catch(error){
      lastError=error;
      if(error.message?.startsWith("ERA5 batch HTTP ")&&!/429|5\d\d/.test(error.message))throw error;
      const delay=Math.min(120000,10000*Math.pow(2,attempt));
      console.warn("ERA5 batch attempt",attempt+1,"failed:",error.cause?.code||error.message,"retry in",delay,"ms");
      if(attempt<8)await sleep(delay);
    }
  }
  throw new Error("ERA5 batch retry limit exceeded: "+(lastError?.cause?.code||lastError?.message||"unknown"));
}
const dayNumber=date=>{
  const m=Number(date.slice(5,7)),d=Number(date.slice(8,10));
  return Math.floor((Date.UTC(2001,m-1,d)-Date.UTC(2001,0,1))/86400000)+1;
};
const circular=(a,b)=>{const d=Math.abs(a-b);return Math.min(d,365-d);};
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const quantile=(xs,q)=>{if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y),p=(a.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return a[l]+(a[h]-a[l])*(p-l);};

function buildRegion(region,daily){
  if(!daily?.time?.length)throw new Error("Missing ERA5 daily data for "+region.id);
  const normals=[];
  for(let target=1;target<=365;target++){
    const values=[];
    for(let i=0;i<daily.time.length;i++){
      if(circular(dayNumber(daily.time[i]),target)>15)continue;
      values.push({rain:daily.precipitation_sum?.[i],high:daily.temperature_2m_max?.[i],low:daily.temperature_2m_min?.[i]});
    }
    const validRain=values.map(x=>x.rain).filter(Number.isFinite);
    const validHigh=values.map(x=>x.high).filter(Number.isFinite);
    const validLow=values.map(x=>x.low).filter(Number.isFinite);
    const wet=validRain.filter(x=>x>=1);
    normals.push({
      dayOfYear:target,sampleDays:{rain:validRain.length,high:validHigh.length,low:validLow.length},
      rainSampleYears:Math.min(30,Math.floor(validRain.length/30)),
      temperatureSampleYears:Math.min(30,Math.floor(Math.min(validHigh.length,validLow.length)/30)),
      rainFrequency:validRain.length?wet.length/validRain.length*100:null,
      rainMean:avg(validRain),rainP10:quantile(validRain,.1),rainP50:quantile(validRain,.5),rainP90:quantile(validRain,.9),
      highMean:avg(validHigh),lowMean:avg(validLow),highP90:quantile(validHigh,.9),lowP10:quantile(validLow,.1)
    });
  }
  const result={...region,status:"complete",daily:normals};
  validateRegion(result,region);
  return result;
}

const completed={};
for(let offset=0;offset<regions.length;offset+=BATCH_SIZE){
  const index=offset/BATCH_SIZE,batch=regions.slice(offset,offset+BATCH_SIZE);
  const saved=await loadCheckpoint(index,batch);
  if(saved){
    Object.assign(completed,saved.regions);
    console.log("Skipping previously completed batch",index+1,"of 8");
    continue;
  }
  console.log("Downloading ERA5 batch",index+1,"of 8:",batch.map(x=>x.id).join(", "));
  const payloads=await fetchBatch(batch);
  const batchRegions={};
  for(let j=0;j<batch.length;j++)batchRegions[batch[j].id]=buildRegion(batch[j],payloads[j]?.daily);
  await saveCheckpoint(index,batch,batchRegions);
  Object.assign(completed,batchRegions);
  console.log("ERA5 baseline regions validated:",Object.keys(completed).length,"/ 80");
  if(offset+BATCH_SIZE<regions.length)await sleep(10000);
}

if(Object.keys(completed).length!==80||new Set(Object.keys(completed)).size!==80)throw new Error("Final region count validation failed");
for(const region of regions)validateRegion(completed[region.id],region);
const output={schemaVersion:1,provider:"Open-Meteo Historical Weather API",model:"ERA5 reanalysis",referencePeriod:"1991-2020",generatedAt:new Date().toISOString(),rainDayThresholdMm:1,regionCount:80,regions:completed};
await fs.mkdir(DATA_DIR,{recursive:true});
const temp=new URL("era5-1991-2020-normals.json.tmp",DATA_DIR);
await fs.writeFile(temp,JSON.stringify(output));
await fs.rename(temp,FINAL_URL);
const verified=JSON.parse(await fs.readFile(FINAL_URL,"utf8"));
if(verified.regionCount!==80||Object.keys(verified.regions).length!==80)throw new Error("Final JSON region count verification failed");
for(const region of regions)validateRegion(verified.regions[region.id],region);
console.log("SUCCESS: final ERA5 dataset validated: 80 unique regions × 365 day normals.");
