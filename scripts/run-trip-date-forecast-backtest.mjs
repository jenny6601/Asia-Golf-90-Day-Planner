import fs from "node:fs/promises";
import {scoreForecastSamples} from "../assets/js/trip-date-forecast-backtest.js";

const snapshotDir=new URL("../data/okinawa-forecast-snapshots/",import.meta.url);
const outDir=new URL("../artifacts/trip-date-backtest/",import.meta.url);
const regions={
  north:{latitude:26.5916,longitude:127.9774},
  central:{latitude:26.3344,longitude:127.8056},
  south:{latitude:26.2123,longitude:127.6792}
};
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dayNumber=date=>Date.parse(date+"T00:00:00Z")/86400000;
const addDays=(date,n)=>new Date((dayNumber(date)+n)*86400000).toISOString().slice(0,10);
await fs.mkdir(outDir,{recursive:true});
let names=[];
try{names=(await fs.readdir(snapshotDir)).filter(x=>/^\\d{4}-\\d{2}-\\d{2}\\.json$/.test(x)).sort()}catch{}
const snapshots=[];
for(const name of names){
  try{snapshots.push(JSON.parse(await fs.readFile(new URL(name,snapshotDir),"utf8")))}
  catch(error){console.warn("Skipping invalid snapshot",name,error.message)}
}
const rowsByRegion={north:[],central:[],south:[]};
const regionErrors={};
for(const [region,point] of Object.entries(regions)){
  const targets=[];
  for(const snapshot of snapshots){
    const issueDate=snapshot.localDate;
    if(typeof issueDate!=="string")continue;
    for(const item of snapshot.regions?.[region]||[]){
      const leadDays=dayNumber(item.date)-dayNumber(issueDate);
      if(item.date<today&&leadDays>=1&&leadDays<=16){
        targets.push({issueDate,targetDate:item.date,leadDays,probability:item.probability,forecastRainMm:item.rainMm});
      }
    }
  }
  if(!targets.length)continue;
  const dates=targets.map(x=>x.targetDate).sort();
  const params=new URLSearchParams({
    latitude:String(point.latitude),longitude:String(point.longitude),
    start_date:dates[0],end_date:dates[dates.length-1],
    daily:"precipitation_sum",timezone:"Asia/Tokyo",
    precipitation_unit:"mm",models:"era5"
  });
  try{
    const response=await fetch("https://archive-api.open-meteo.com/v1/archive?"+params);
    if(!response.ok)throw new Error("ERA5 archive HTTP "+response.status);
    const payload=await response.json();
    const times=payload.daily?.time||[],values=payload.daily?.precipitation_sum||[];
    const observed=new Map(times.map((date,i)=>[date,values[i]]));
    for(const target of targets){
      const actual=observed.get(target.targetDate);
      if(typeof actual!=="number"||!Number.isFinite(actual)||actual<0)continue;
      rowsByRegion[region].push({...target,observedRainMm:actual});
    }
  }catch(error){regionErrors[region]=error.message}
}
const byRegion=Object.fromEntries(Object.entries(rowsByRegion).map(([region,rows])=>[region,scoreForecastSamples(rows)]));
const allRows=Object.values(rowsByRegion).flat();
const overall=scoreForecastSamples(allRows);
const sampleCount=overall.overall.probabilitySampleCount;
const report={
  generatedAt:new Date().toISOString(),asOf:today,
  archive:{snapshotCount:snapshots.length,firstSnapshot:snapshots[0]?.localDate??null,lastSnapshot:snapshots.at(-1)?.localDate??null},
  method:"Archived Open-Meteo daily precipitation probability and amount compared with ERA5 reanalysis precipitation at the same three regional coordinates.",
  overall,byRegion,regionErrors,
  validationStatus:sampleCount>=90?"descriptive-sample-available":"collecting-insufficient-samples",
  minimumSampleGuidance:"Do not interpret as calibrated skill until at least 30 probability samples per lead bucket and per region are available; 90 total is only a minimum descriptive threshold.",
  caveats:[
    "ERA5 reanalysis is not an independent rain-gauge observation; this is a model-reference comparison.",
    "Probability verification uses wet day >=1.0 mm and Brier score. Forecast rainfall amount is evaluated separately by MAE.",
    "Snapshots are one per Okinawa-local issue date; reruns on the same date replace the prior snapshot.",
    "Unavailable observed dates and missing forecast fields are excluded, never imputed."
  ]
};
await fs.writeFile(new URL("backtest.json",outDir),JSON.stringify(report,null,2));
const lines=[
  "# Okinawa archived rain forecast backtest",
  "",
  "As of: "+today,
  "Archived daily snapshots: "+snapshots.length,
  "Forecast rows with ERA5 reference: "+sampleCount,
  "Status: "+report.validationStatus,
  "",
  "## Overall",
  "- Brier score: "+(overall.overall.brierScore??"資料不足"),
  "- Rainfall amount MAE: "+(overall.overall.rainfallAmountMaeMm==null?"資料不足":overall.overall.rainfallAmountMaeMm+" mm/day"),
  "",
  "## By region",
  ...Object.entries(byRegion).flatMap(([region,result])=>[
    "### "+region,
    "- Probability samples: "+result.overall.probabilitySampleCount,
    "- Brier score: "+(result.overall.brierScore??"資料不足"),
    "- Rainfall amount MAE: "+(result.overall.rainfallAmountMaeMm==null?"資料不足":result.overall.rainfallAmountMaeMm+" mm/day")
  ]),
  "",
  "## By forecast lead",
  ...overall.byLeadBucket.map(x=>"- "+x.label+": n="+x.probabilitySampleCount+", Brier="+(x.brierScore??"資料不足")+", amount MAE="+(x.rainfallAmountMaeMm==null?"資料不足":x.rainfallAmountMaeMm+" mm")),
  "",
  "## Limitations",
  ...report.caveats.map(x=>"- "+x),
  ...Object.entries(regionErrors).map(([region,error])=>"- "+region+" ERA5 reference unavailable: "+error)
];
await fs.writeFile(new URL("backtest.md",outDir),lines.join("\n"));
console.log(lines.join("\n"));
