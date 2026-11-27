import fs from "node:fs/promises";
import {parseAmedasPointBlock} from "./jma-amedas-validation.js";

const stations=JSON.parse(await fs.readFile(new URL("../config/okinawa/jma-amedas-stations.json",import.meta.url),"utf8"));
const base="https://www.jma.go.jp/bosai/amedas";
const retrievedAt=new Date().toISOString();
const fetchJson=async(url,text=false)=>{
 const response=await fetch(url,{headers:{"User-Agent":"Asia-Golf-90-Day-Planner-JMA-Observation-Archive/1.0"},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error("JMA HTTP "+response.status+" for "+url);
 return text?(await response.text()).trim():response.json();
};
const add=(date,n)=>new Date(Date.parse(date+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
const latestTime=await fetchJson(base+"/data/latest_time.txt",true);
const latestDate=latestTime.slice(0,10),endDate=add(latestDate,-1),startDate=add(endDate,-6);
const dates=Array.from({length:7},(_,i)=>add(startDate,i));
const jobs=stations.flatMap(station=>dates.flatMap(date=>Array.from({length:8},(_,i)=>({station,date,hour:i*3}))));
const results=new Array(jobs.length);let cursor=0,success=0;
await Promise.all(Array.from({length:12},async()=>{
 while(true){
  const index=cursor++;if(index>=jobs.length)return;
  const job=jobs[index],block=String(job.hour).padStart(2,"0"),ymd=job.date.replaceAll("-","");
  try{
   const payload=await fetchJson(base+"/data/point/"+job.station.id+"/"+ymd+"_"+block+".json");
   results[index]={stationId:job.station.id,date:job.date,block,rows:parseAmedasPointBlock(payload),ok:true};success++;
  }catch(error){results[index]={stationId:job.station.id,date:job.date,block,rows:[],ok:false,error:String(error)};}
 }
}));
const observations=stations.map(station=>{
 const blocks=results.filter(x=>x.stationId===station.id&&x.ok);
 const rows=blocks.flatMap(x=>x.rows).filter(row=>row.time.endsWith(":00")).filter((row,index,array)=>array.findIndex(y=>y.time===row.time)===index).sort((a,b)=>a.time.localeCompare(b.time));
 const valid=key=>rows.filter(row=>row[key]?.usable).length;
 return {station:{id:station.id,name:station.name,latitude:station.latitude,longitude:station.longitude,elevationM:station.elevationM,area:station.area,observedElements:station.observedElements,jmaType:station.jmaType,jmaElementsCode:station.jmaElementsCode},expectedBlockFiles:56,successfulBlockFiles:blocks.length,failedBlocks:results.filter(x=>x.stationId===station.id&&!x.ok).map(x=>({date:x.date,block:x.block,error:x.error})),expectedHours:168,returnedRows:rows.length,validCounts:{temperature:valid("temperature"),precipitation1h:valid("precipitation1h"),windSpeed:valid("windSpeed"),gust:valid("gust")},rows};
});
const archive={schemaVersion:1,archiveType:"jma-amedas-observation-snapshot",source:"Japan Meteorological Agency AMeDAS point JSON feed",sourceUrl:"https://www.jma.go.jp/bosai/amedas/",retrievedAt,latestJmaTime:latestTime,period:{startDate,endDate,days:7,expectedHours:168},stationCount:stations.length,successfulBlockFiles:success,expectedBlockFiles:jobs.length,stations:observations,limitations:["JMA point JSON endpoint is an undocumented internal website feed and may change.","Station observations are regional proxies, not golf-course measurements.","Only JMA quality flags 0 and 1 are treated as usable by the shared parser.","A missing station observation remains missing; it is never imputed as zero."]};
const dir="data/okinawa/jma-observation-archive";await fs.mkdir(dir,{recursive:true});
const date=retrievedAt.slice(0,10);
await fs.writeFile(dir+"/"+date+".json",JSON.stringify(archive,null,2));
const md=["# Okinawa JMA AMeDAS Daily Observation Archive","", "- Retrieved: "+retrievedAt,"- JMA latest time: "+latestTime,"- Observation period: "+startDate+" to "+endDate,"- Station block files: "+success+"/"+jobs.length,"","| Station | Area | Rows | Temp valid | Rain valid | Wind valid | Blocks |","|---|---|---:|---:|---:|---:|---:|",...observations.map(x=>"| "+x.station.name+" ("+x.station.id+") | "+x.station.area+" | "+x.returnedRows+" | "+x.validCounts.temperature+" | "+x.validCounts.precipitation1h+" | "+x.validCounts.windSpeed+" | "+x.successfulBlockFiles+"/56 |"),"","## Limitations",...archive.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile(dir+"/"+date+".md",md);
console.log(md);
if(success!==jobs.length||observations.some(x=>x.returnedRows===0))process.exitCode=1;
