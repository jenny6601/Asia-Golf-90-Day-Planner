import fs from "node:fs/promises";
import {buildSeasonalRevisionHistory} from "./okinawa-seasonal-revision-history.js";
const dir="data/okinawa/seasonal-forecast-archive",out="data/okinawa/seasonal-revision-history";
const files=(await fs.readdir(dir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();
const snapshots=[];
for(const file of files){const value=JSON.parse(await fs.readFile(dir+"/"+file,"utf8"));if(value.archiveType==="okinawa-ecmwf-seasonal-snapshot")snapshots.push(value);}
if(!snapshots.length)throw new Error("No seasonal forecast snapshots found for revision history");
const report={...buildSeasonalRevisionHistory(snapshots),generatedAt:new Date().toISOString()};
await fs.mkdir(out,{recursive:true});const date=report.generatedAt.slice(0,10);
await fs.writeFile(out+"/"+date+".json",JSON.stringify(report,null,2));
const fmt=v=>v===null||v===undefined?"—":Number(v).toFixed(2);
const rows=report.comparisons.map(x=>"| "+x.region+" | "+x.scale+" | "+x.targetTimeLabel+" | "+x.previousSnapshot.archiveDate+" → "+x.currentSnapshot.archiveDate+" | "+Object.entries(x.changes).map(([k,v])=>k+": "+fmt(v.previous)+" → "+fmt(v.current)+" (Δ "+fmt(v.delta)+")").join("<br> ")+" |");
const md=["# Okinawa Seasonal Forecast Revision History","", "Generated: "+report.generatedAt,"Snapshots retained: "+report.snapshotCount,"Comparable revisions: "+report.comparisonCount,"","## Revision comparisons","", "| Region | Scale | Exact provider label | Snapshot versions | Field changes |","|---|---|---|---|---|",...(rows.length?rows:["| — | — | — | — | 尚無同一目標標籤的兩份快照可供比較 |"]),"","## Interpretation gate","","- Comparisons use identical region, scale, exact time label, model and unit metadata.","- These are snapshot-to-snapshot changes, not confirmed new model runs.","- Weekly/monthly aggregation boundaries and model issue time remain unverified.","- No skill, accuracy, daily rainfall or probability is calculated.","","## Current gate","", "periodBoundaryVerified: false","issueTimeKnown: false","forecastSkillClaimed: false"].join("\n");
await fs.writeFile(out+"/"+date+".md",md);console.log(md);
