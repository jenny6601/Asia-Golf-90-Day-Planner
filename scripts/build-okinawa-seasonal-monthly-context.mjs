import fs from "node:fs/promises";
import {buildSeasonalMonthlyContext} from "./okinawa-seasonal-monthly-context.js";
const forecastDir="data/okinawa/seasonal-forecast-archive",baselineDir="data/okinawa/era5-climate-baseline",outDir="data/okinawa/seasonal-monthly-context";
const list=async dir=>(await fs.readdir(dir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();
const read=async(dir,file)=>JSON.parse(await fs.readFile(dir+"/"+file,"utf8"));
const [forecastFiles,baselineFiles]=await Promise.all([list(forecastDir),list(baselineDir)]);
if(!forecastFiles.length)throw new Error("No archived seasonal forecast snapshots available");
if(!baselineFiles.length)throw new Error("No ERA5 climate baseline archive available");
const baseline=await read(baselineDir,baselineFiles.at(-1));
const results=[];
for(const file of forecastFiles){
 const archive=await read(forecastDir,file);
 if(archive.archiveType!=="okinawa-ecmwf-seasonal-snapshot")continue;
 for(const point of archive.points||[]){
  const region=point.point?.id;
  const era5=baseline.regions?.find(x=>x.point?.id===region)?.baseline;
  if(!era5)continue;
  results.push(...buildSeasonalMonthlyContext({region,forecastMonthly:point.monthly,era5Baseline:era5}).map(x=>({...x,forecastVintage:archive.archiveDate,forecastModel:archive.model,era5Vintage:baseline.retrievedAt,forecastUnit:point.monthlyUnits?.precipitation_anomaly??null})));
 }
}
const report={schemaVersion:1,archiveType:"okinawa-seasonal-monthly-context",generatedAt:new Date().toISOString(),forecastSnapshotsRead:forecastFiles.length,era5BaselineArchive:baselineFiles.at(-1),records:results,interpretation:["Model anomaly direction is relative to the ECMWF model's own hindcast climatology.","ERA5 P10/median/P90 are an independent recent historical climate distribution, not the model climatology.","Do not subtract, merge, or calibrate the two baselines as if they were the same reference system.","No daily rain probability, daily rainfall amount, forecast accuracy, or 0–3 score is produced."]};
await fs.mkdir(outDir,{recursive:true});const date=report.generatedAt.slice(0,10);
await fs.writeFile(outDir+"/"+date+".json",JSON.stringify(report,null,2));
const lines=["# Okinawa Seasonal Forecast + ERA5 Monthly Context","", "Generated: "+report.generatedAt,"Forecast snapshots: "+forecastFiles.length,"ERA5 baseline: "+baselineFiles.at(-1),"","| Vintage | Region | Month | ECMWF precip anomaly | Signal | ERA5 sample years | ERA5 P10 / median / P90 mm |","|---|---|---|---:|---|---:|---|",...results.map(x=>"| "+x.forecastVintage+" | "+x.region+" | "+x.targetMonth+" | "+(x.modelAnomalyMm??"—")+" "+(x.forecastUnit??"")+" | "+x.modelSignal.label+" | "+x.era5Context.sampleYears+" | "+[x.era5Context.p10Mm,x.era5Context.medianMm,x.era5Context.p90Mm].map(v=>Number.isFinite(v)?v:"—").join(" / ")+" |"),"","## Interpretation boundaries","",...report.interpretation.map(x=>"- "+x)];
await fs.writeFile(outDir+"/"+date+".md",lines.join("\n"));
console.log("Seasonal monthly context built: "+results.length+" records");
