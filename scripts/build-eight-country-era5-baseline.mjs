import fs from "node:fs/promises";

const ROOT=new URL("../",import.meta.url);
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
        return Array.isArray(payload)?payload:[payload];
      }
      if(response.status!==429&&response.status<500)throw new Error("ERA5 batch HTTP "+response.status+": "+(await response.text()).slice(0,300));
      const retryAfter=Number(response.headers.get("retry-after"));
      lastError=new Error("ERA5 batch HTTP "+response.status);
      await sleep(Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:Math.min(120000,10000*Math.pow(2,attempt)));
    }catch(error){
      lastError=error;
      if(error.message?.startsWith("ERA5 batch HTTP ")&&!/429|5\\d\\d/.test(error.message))throw error;
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
const output={schemaVersion:1,provider:"Open-Meteo Historical Weather API",model:"ERA5 reanalysis",referencePeriod:"1991-2020",generatedAt:new Date().toISOString(),rainDayThresholdMm:1,regionCount:80,regions:{}};
for(let offset=0;offset<regions.length;offset+=10){
  const batch=regions.slice(offset,offset+10);
  const payloads=await fetchBatch(batch);
  if(payloads.length!==batch.length)throw new Error("ERA5 batch response count mismatch at "+offset);
  for(let j=0;j<batch.length;j++){
    const region=batch[j],daily=payloads[j]?.daily;
    if(!daily?.time?.length)throw new Error("Missing ERA5 daily data for "+region.id);
    const normals=[];
    for(let target=1;target<=365;target++){
      const values=[];
      for(let i=0;i<daily.time.length;i++){
        if(circular(dayNumber(daily.time[i]),target)>15)continue;
        const rain=daily.precipitation_sum?.[i],high=daily.temperature_2m_max?.[i],low=daily.temperature_2m_min?.[i];
        values.push({rain,high,low});
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
    output.regions[region.id]={...region,status:"complete",daily:normals};
  }
  console.log("ERA5 baseline regions:",Math.min(offset+batch.length,80),"/ 80");
  await sleep(10000);
}
await fs.mkdir(new URL("../public/data/long-range/",import.meta.url),{recursive:true});
await fs.writeFile(new URL("../public/data/long-range/era5-1991-2020-normals.json",import.meta.url),JSON.stringify(output));
console.log("Saved ERA5 30-year baseline for",Object.keys(output.regions).length,"regions");
