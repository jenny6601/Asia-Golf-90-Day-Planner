import fs from "node:fs/promises";
import {auditSeasonalForecastSnapshot,summarizeSeasonalSnapshotAudits} from "./okinawa-seasonal-time-semantics.js";
const inputDir="data/okinawa/seasonal-forecast-archive",outDir="data/okinawa/seasonal-time-semantics";
const files=(await fs.readdir(inputDir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();
const audits=[];
for(const file of files){const snapshot=JSON.parse(await fs.readFile(inputDir+"/"+file,"utf8"));if(snapshot.archiveType==="okinawa-ecmwf-seasonal-snapshot")audits.push(auditSeasonalForecastSnapshot(snapshot));}
if(!audits.length)throw new Error("No seasonal forecast snapshots found for time semantics audit");
const report={...summarizeSeasonalSnapshotAudits(audits),generatedAt:new Date().toISOString(),sourceSnapshots:files.length};
await fs.mkdir(outDir,{recursive:true});const date=report.generatedAt.slice(0,10);
await fs.writeFile(outDir+"/"+date+".json",JSON.stringify(report,null,2));
const lines=["# Okinawa Seasonal Forecast Time-Semantics Audit","", "Generated: "+report.generatedAt,"Snapshots audited: "+report.snapshotsAudited,"Structurally valid snapshots: "+report.structurallyValidSnapshots,"","## Regional timestamp and array checks","", "| Snapshot | Region | Weekly labels | Weekly spacing | Weekly arrays | Monthly labels | Monthly spacing | Monthly arrays |","|---|---|---:|---|---|---:|---|---|",...audits.flatMap(a=>a.regions.map(r=>"| "+a.archiveDate+" | "+r.region+" | "+(r.weekly?.sequence?.labels??0)+" | "+(r.weekly?.sequence?.labelSpacingConsistent?"consistent":"review") +" | "+(r.weekly?.arrays?.aligned?"aligned":"misaligned")+" | "+(r.monthly?.sequence?.labels??0)+" | "+(r.monthly?.sequence?.labelSpacingConsistent?"consistent":"review")+" | "+(r.monthly?.arrays?.aligned?"aligned":"misaligned")+" |")),"","## Gate","",report.globalGate,"","Issue time known: no","Period boundaries verified: no","Skill scoring allowed: no","","## Limitations","",...audits.flatMap(a=>a.notes).filter((x,i,arr)=>arr.indexOf(x)===i).map(x=>"- "+x)];
await fs.writeFile(outDir+"/"+date+".md",lines.join("\n"));console.log(lines.join("\n"));
