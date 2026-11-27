import fs from "node:fs/promises";
import {buildOkinawaTripWindowDecision} from "../assets/js/okinawa-trip-window-decision.js";
import {OKINAWA_LONG_RANGE_POINTS} from "../assets/js/long-range-api.js";
import {OKINAWA_COURSES} from "../assets/js/okinawa-courses.js";
const readLatest=async dir=>{const files=(await fs.readdir(dir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();return files.length?JSON.parse(await fs.readFile(dir+"/"+files.at(-1),"utf8")):null;};
const snapshotDir="data/okinawa/seasonal-forecast-archive";
const files=(await fs.readdir(snapshotDir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();
const snapshots=[];for(const file of files){const x=JSON.parse(await fs.readFile(snapshotDir+"/"+file,"utf8"));if(x.archiveType==="okinawa-ecmwf-seasonal-snapshot")snapshots.push(x);}
if(!snapshots.length)throw new Error("No seasonal forecast snapshots found for Okinawa trip decision");
const latest=snapshots.at(-1);
const monthlyContext=await readLatest("data/okinawa/seasonal-monthly-context");
const referenceDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const seasonalPoints=OKINAWA_LONG_RANGE_POINTS.map(point=>{
 const archived=latest.points?.find(x=>x.point?.id===point.id);
 if(!archived)throw new Error("Latest seasonal archive missing region "+point.id);
 return {point,weekly:archived.weekly,monthly:archived.monthly};
});
const report=buildOkinawaTripWindowDecision({referenceDate,seasonalPoints,snapshots,monthlyContext:monthlyContext?.records??[],courses:OKINAWA_COURSES});
const out="data/okinawa/trip-window-decision";await fs.mkdir(out,{recursive:true});const date=report.generatedAt.slice(0,10);
await fs.writeFile(out+"/"+date+".json",JSON.stringify(report,null,2));
const fmt=x=>x===null||x===undefined?"—":String(x);
const rows=report.recommendations.map(x=>"| "+x.recommendationRank+" | "+x.tripStart+" – "+x.tripEnd+" | "+x.golfDates.join(", ")+" | "+x.tendencyRank+"/3 "+x.tendency+" | "+x.rounds.map(r=>r.rounds.map(z=>z.label+":"+z.signal.label).join(" / ")).join("<br>")+" | "+x.rounds.map(r=>r.courseChoices.map(c=>c.name).join(", ")).join("<br>")+" |");
const lines=["# Okinawa 5-day / 4-night, 3-round trip date recommendations","", "Generated: "+report.generatedAt,"Reference date (Asia/Taipei): "+referenceDate,"","Trip: arrival Day 1; golf Days 2–4; departure Day 5.","Seasonal snapshots: "+snapshots.length,"Scored windows: "+report.coverage.scoredWindows+" / "+report.horizon.candidateStartDates,"","## Top recommendations","","| Rank | Trip dates | Golf dates | Ordinal tendency | Regional round signals | Regional course options |","|---:|---|---|---|---|---|",...(rows.length?rows:["| — | — | — | 資料不足 | — | — |"]),"","## Ranking and interpretation","","- Lower 0–3 ordinal tendency tier ranks first; ties use earlier trip start date.","- Wettest region retained for each golf day; no regional averaging hides a wet signal.","- ERA5 historical monthly distribution and revision stability are separate context only.","- Six course options share their north/central/south regional proxy signal; not course-level long-range forecasts.","- Short-range 0–100 playability scores are not mixed into this long-range ranking.","","## Coverage","", "Candidate windows: "+report.horizon.candidateStartDates,"Scored: "+report.coverage.scoredWindows,"Insufficient seasonal evidence: "+report.coverage.insufficientWindows,"","## Guardrails","",...report.guardrails.map(x=>"- "+x)].join("\n");
await fs.writeFile(out+"/"+date+".md",lines.join("\n"));console.log(lines.join("\n"));
