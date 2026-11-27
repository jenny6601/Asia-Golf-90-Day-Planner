import fs from "node:fs/promises";
import {buildSeasonalDirectionStability} from "./okinawa-seasonal-direction-stability.js";
const input="data/okinawa/seasonal-forecast-archive",out="data/okinawa/seasonal-direction-stability";
const files=(await fs.readdir(input).catch(()=>[])).filter(x=>x.endsWith(".json")).sort(),snapshots=[];
for(const file of files){const x=JSON.parse(await fs.readFile(input+"/"+file,"utf8"));if(x.archiveType==="okinawa-ecmwf-seasonal-snapshot")snapshots.push(x);}
if(!snapshots.length)throw new Error("No seasonal snapshots found for direction stability");
const report={...buildSeasonalDirectionStability(snapshots),generatedAt:new Date().toISOString()};
await fs.mkdir(out,{recursive:true});const date=report.generatedAt.slice(0,10);
await fs.writeFile(out+"/"+date+".json",JSON.stringify(report,null,2));
const fmt=v=>v===null||v===undefined?"—":typeof v==="number"?v.toFixed(2):String(v);
const rows=report.records.filter(x=>x.field==="precipitation_anomaly").map(x=>"| "+x.region+" | "+x.scale+" | "+x.targetTimeLabel+" | "+x.validValueCount+"/"+x.snapshotCount+" | "+x.directionChanges+" | "+x.dominantDirection+" | "+x.stabilityStatus+" | "+fmt(x.directionConsistencyRatio)+" |");
const regions=report.regionalAgreement.map(x=>"| "+x.scale+" | "+x.targetTimeLabel+" | "+x.regionCount+"/3 | "+x.agreementStatus+" |");
const md=["# Okinawa Seasonal Forecast Direction Stability","", "Generated: "+report.generatedAt,"Snapshots: "+report.snapshotCount,"Direction series: "+report.recordCount,"","## Anomaly direction stability","", "| Region | Scale | Exact provider label | Valid snapshots | Direction changes | Current direction | Status | Descriptive ratio |","|---|---|---|---:|---:|---|---|---:|",...(rows.length?rows:["| — | — | — | 0 | — | — | INSUFFICIENT_SNAPSHOTS | — |"]),"","## Three-region direction agreement","", "| Scale | Exact provider label | Regions available | Agreement status |","|---|---|---:|---|",...(regions.length?regions:["| — | — | 0/3 | INSUFFICIENT_DATA |"]),"","## Interpretation restrictions","",...report.notes.map(x=>"- "+x),"","Stable classification requires at least three valid snapshots. The ratio is not a probability or confidence score."].join("\n");
await fs.writeFile(out+"/"+date+".md",md);console.log(md);
