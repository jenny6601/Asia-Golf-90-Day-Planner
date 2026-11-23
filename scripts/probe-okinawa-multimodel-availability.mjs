import fs from "node:fs/promises";

const points=[
 {id:"north",latitude:26.5916,longitude:127.9774},
 {id:"central-south-shared-proxy",latitude:26.3344,longitude:127.8056}
];
const windows=[
 {start:"2025-01-15",end:"2025-01-21",season:"winter"},
 {start:"2025-07-15",end:"2025-07-21",season:"summer"}
];
const models=[
 {id:"ecmwf_ifs025",label:"ECMWF IFS 0.25°"},
 {id:"ncep_gfs_global",label:"NCEP GFS Global"},
 {id:"jma_seamless",label:"JMA Seamless"},
 {id:"jma_gsm",label:"JMA GSM"},
 {id:"cma_grapes_global",label:"CMA GRAPES Global"},
 {id:"icon_global",label:"DWD ICON Global"}
];
const variables=["temperature_2m","precipitation","wind_speed_10m"];
const leads=[1,3,7];
const headers={"User-Agent":"Asia-Golf-90-Day-Planner-model-availability-probe/1.0"};
async function getJson(url){
 const response=await fetch(url,{headers});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error("HTTP "+response.status+" "+(body.reason??body.error??""));
 return body;
}
const results=[];
for(const model of models)for(const point of points)for(const window of windows){
 const hourly=[];
 for(const lead of leads)for(const v of variables)hourly.push(v+"_previous_day"+lead);
 const params=new URLSearchParams({
  latitude:String(point.latitude),longitude:String(point.longitude),
  start_date:window.start,end_date:window.end,hourly:hourly.join(","),
  models:model.id,timezone:"Asia/Tokyo",wind_speed_unit:"ms",
  precipitation_unit:"mm",temperature_unit:"celsius"
 });
 try{
  const data=await getJson("https://previous-runs-api.open-meteo.com/v1/forecast?"+params);
  const counts={};
  for(const lead of leads)for(const v of variables){
   const key=v+"_previous_day"+lead;
   const values=data.hourly?.[key]??[];
   counts[key]={n:values.filter(Number.isFinite).length,total:values.length};
  }
  results.push({
   modelId:model.id,modelLabel:model.label,point:point.id,window,
   ok:true,grid:{latitude:data.latitude,longitude:data.longitude,elevation:data.elevation},
   units:data.hourly_units??null,counts,
   modelReturned:data.model??null,timeCount:data.hourly?.time?.length??0
  });
 }catch(error){results.push({modelId:model.id,modelLabel:model.label,point:point.id,window,ok:false,error:String(error)});}
}
const summary=models.map(m=>{
 const rows=results.filter(r=>r.modelId===m.id);
 const success=rows.filter(r=>r.ok);
 const leadCoverage={};
 for(const lead of leads){
  const keys=variables.map(v=>v+"_previous_day"+lead);
  leadCoverage[lead+"d"]=keys.every(k=>success.length&&success.every(r=>(r.counts[k]?.n??0)>0));
 }
 return {modelId:m.id,label:m.label,successRequests:success.length,totalRequests:rows.length,
  leadCoverage,grids:[...new Set(success.map(r=>r.grid.latitude+","+r.grid.longitude))]};
});
const report={generatedAt:new Date().toISOString(),purpose:"Availability probe only; no forecast skill scores and no threshold calibration.",models,points,windows,summary,results,
 limitations:["HTTP success does not establish useful field coverage; non-null hourly counts are checked per variable and lead.","Returned model grid coordinates can differ by model and requested point; nominal regions are not assumed independent.","Previous Runs fields are fixed lead offsets, not full individual model runs.","ERA5 is not queried in this probe; it will be used only after model and lead coverage is confirmed."]};
await fs.mkdir("artifacts",{recursive:true});
await fs.writeFile("artifacts/okinawa-multimodel-availability.json",JSON.stringify(report,null,2));
const md=["# Okinawa Multi-model Previous Runs Availability Probe","",
"Generated: "+report.generatedAt,"",
"| Model | Successful requests | 1d complete | 3d complete | 7d complete | Unique grids |",
"|---|---:|---|---|---|---:|",
...summary.map(s=>"| "+s.label+" | "+s.successRequests+"/"+s.totalRequests+" | "+(s.leadCoverage["1d"]?"yes":"no")+" | "+(s.leadCoverage["3d"]?"yes":"no")+" | "+(s.leadCoverage["7d"]?"yes":"no")+" | "+s.grids.length+" |"),
"","## Request detail","","| Model | Point | Window | Grid | Non-null fields | Status |","|---|---|---|---|---|---|",
...results.map(r=>r.ok?"| "+r.modelId+" | "+r.point+" | "+r.window.start+" | "+r.grid.latitude+", "+r.grid.longitude+" | "+Object.entries(r.counts).map(([k,v])=>k.replaceAll("_previous_day"," d")+":"+v.n+"/"+v.total).join("; ")+" | ok |":"| "+r.modelId+" | "+r.point+" | "+r.window.start+" | — | — | "+r.error+" |"),
"","## Guardrails",...report.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile("artifacts/okinawa-multimodel-availability.md",md);
console.log(md);
if(!results.some(r=>r.ok))process.exitCode=1;
