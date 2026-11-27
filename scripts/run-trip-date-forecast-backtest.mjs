import fs from "node:fs/promises";
import {scoreForecastSamples} from "../assets/js/trip-date-forecast-backtest.js";
import {scoreRiskRankingSamples,scoreTripWindowRankingSamples} from "../assets/js/trip-date-ranking-verification.js";
import {TRIP_DATE_CANDIDATE_MODELS} from "../assets/js/trip-date-candidate-models.js";
import {recommendGolfTripDates} from "../assets/js/trip-date-recommendation-engine.js";
import {buildDailyClimatology,compareForecastToClimatology} from "../assets/js/trip-date-climatology-baseline.js";
import {summarizeSeasonalArchive} from "../assets/js/trip-date-seasonal-backtest.js";
import {buildSeasonalVerificationTargets,scoreSeasonalVerification} from "../assets/js/trip-date-seasonal-verification.js";

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
try{names=(await fs.readdir(snapshotDir)).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort()}catch{}
const snapshots=[];
for(const name of names){
  try{snapshots.push(JSON.parse(await fs.readFile(new URL(name,snapshotDir),"utf8")))}
  catch(error){console.warn("Skipping invalid snapshot",name,error.message)}
}

// Short-range verification: daily probability and amount versus ERA5.
const rowsByRegion={north:[],central:[],south:[]};
const regionErrors={};
for(const [region,point] of Object.entries(regions)){
  const targets=[];
  for(const snapshot of snapshots){
    const issueDate=snapshot.localDate;
    if(typeof issueDate!=="string")continue;
    for(const item of snapshot.regions?.[region]||[]){
      const leadDays=dayNumber(item.date)-dayNumber(issueDate);
      if(item.date<today&&leadDays>=1&&leadDays<=16)
        targets.push({issueDate,targetDate:item.date,leadDays,probability:item.probability,forecastRainMm:item.rainMm});
    }
  }
  if(!targets.length)continue;
  const dates=targets.map(x=>x.targetDate).sort();
  const params=new URLSearchParams({
    latitude:String(point.latitude),longitude:String(point.longitude),
    start_date:dates[0],end_date:dates[dates.length-1],
    daily:"precipitation_sum",timezone:"Asia/Tokyo",precipitation_unit:"mm",models:"era5"
  });
  try{
    const response=await fetch("https://archive-api.open-meteo.com/v1/archive?"+params);
    if(!response.ok)throw new Error("ERA5 archive HTTP "+response.status);
    const payload=await response.json();
    const observed=new Map((payload.daily?.time||[]).map((date,i)=>[date,payload.daily?.precipitation_sum?.[i]]));
    for(const target of targets){
      const actual=observed.get(target.targetDate);
      if(typeof actual==="number"&&Number.isFinite(actual)&&actual>=0)
        rowsByRegion[region].push({...target,region,observedRainMm:actual});
    }
  }catch(error){regionErrors[region]=error.message}
}
const byRegion=Object.fromEntries(Object.entries(rowsByRegion).map(([region,rows])=>[region,scoreForecastSamples(rows)]));
const overall=scoreForecastSamples(Object.values(rowsByRegion).flat());
const sampleCount=overall.overall.probabilitySampleCount;

// Independent benchmark: same-calendar-day ERA5 climatology from 1991-2020.
// This baseline period ends before the archived forecast verification period.
const climatologyByRegion={north:{},central:{},south:{}};
const climatologyErrors={};
for(const [region,point] of Object.entries(regions)){
  const params=new URLSearchParams({
    latitude:String(point.latitude),longitude:String(point.longitude),
    start_date:"1991-01-01",end_date:"2020-12-31",
    daily:"precipitation_sum",timezone:"Asia/Tokyo",
    precipitation_unit:"mm",models:"era5"
  });
  try{
    const response=await fetch("https://archive-api.open-meteo.com/v1/archive?"+params);
    if(!response.ok)throw new Error("ERA5 climatology HTTP "+response.status);
    const payload=await response.json();
    const daily=(payload.daily?.time||[]).map((date,i)=>({date,rainMm:payload.daily?.precipitation_sum?.[i]}));
    climatologyByRegion[region]=buildDailyClimatology(daily);
  }catch(error){climatologyErrors[region]=error.message}
}
// Long-horizon out-of-sample ranking verification. Candidate models run in shadow
// mode on identical archived snapshots; production V1 weights are never mutated.
const rankingTargets=[],windowPredictions=[];
for(const snapshot of snapshots){
  const issueDate=snapshot.localDate;
  if(typeof issueDate!=="string"||!Array.isArray(snapshot.normalizedDailySignals))continue;
  for(const [modelId,model] of Object.entries(TRIP_DATE_CANDIDATE_MODELS)){
    try{
      const assessed=recommendGolfTripDates(
        {asOf:issueDate,horizonDays:90,days:snapshot.normalizedDailySignals},
        {horizonDays:90,alternateCount:0,sourceWeights:model.sourceWeights,includeAllWindows:true}
      );
      const compositeByDate=new Map(assessed.dailyAssessment.map(x=>[x.date,x]));
      for(const day of snapshot.normalizedDailySignals){
        const leadDays=dayNumber(day.date)-dayNumber(issueDate);
        if(day.date>=today||leadDays<1||leadDays>90)continue;
        for(const region of Object.keys(regions)){
          const composite=compositeByDate.get(day.date)?.regions?.find(x=>x.region===region);
          if(typeof composite?.riskScore==="number"&&Number.isFinite(composite.riskScore))
            rankingTargets.push({issueDate,targetDate:day.date,leadDays,region,source:"composite-"+modelId,riskScore:composite.riskScore});
        }
      }
      for(const window of assessed.allWindows||[]){
        windowPredictions.push({issueDate,model:modelId,startDate:window.startDate,endDate:window.endDate,predictedScore:window.score,
          golfDates:window.recommendedGolfDates.map(x=>x.date)});
      }
    }catch(error){console.warn("Skipping candidate model snapshot",issueDate,modelId,error.message);}
  }
}
const rankingObservations={north:{},central:{},south:{}};
const rankingObservationErrors={};
for(const [region,point] of Object.entries(regions)){
  const targets=rankingTargets.filter(x=>x.region===region);
  if(!targets.length)continue;
  const dates=targets.map(x=>x.targetDate).sort();
  const params=new URLSearchParams({
    latitude:String(point.latitude),longitude:String(point.longitude),
    start_date:dates[0],end_date:dates.at(-1),daily:"precipitation_sum",
    timezone:"Asia/Tokyo",precipitation_unit:"mm",models:"era5"
  });
  try{
    const response=await fetch("https://archive-api.open-meteo.com/v1/archive?"+params);
    if(!response.ok)throw new Error("ERA5 ranking archive HTTP "+response.status);
    const payload=await response.json();
    rankingObservations[region]=Object.fromEntries((payload.daily?.time||[]).map((date,i)=>[date,payload.daily?.precipitation_sum?.[i]]));
  }catch(error){rankingObservationErrors[region]=error.message;}
}
const rankingSamples=rankingTargets.flatMap(target=>{
  const observed=rankingObservations[target.region]?.[target.targetDate];
  return typeof observed==="number"&&Number.isFinite(observed)&&observed>=0
    ?[{...target,observedRainMm:observed}]:[];
});
const rankingVerification=scoreRiskRankingSamples(rankingSamples);
const tripWindowSamples=[];
for(const prediction of windowPredictions){
  const values=prediction.golfDates.flatMap(date=>Object.keys(regions).map(region=>rankingObservations[region]?.[date]));
  if(values.length===9&&values.every(value=>typeof value==="number"&&Number.isFinite(value)&&value>=0)){
    tripWindowSamples.push({model:prediction.model,predictedScore:prediction.predictedScore,
      observedGolfRainMm:values.reduce((sum,value)=>sum+value,0)/values.length,
      issueDate:prediction.issueDate,startDate:prediction.startDate});
  }
}
const tripWindowRanking=scoreTripWindowRankingSamples(tripWindowSamples);
const tripWindowSummary={candidateWindows:windowPredictions.length,completeObservedWindows:tripWindowSamples.length,
  excludedIncompleteWindows:windowPredictions.length-tripWindowSamples.length};

const rankingArchiveSummary={
  normalizedSnapshots:snapshots.filter(x=>Array.isArray(x.normalizedDailySignals)).length,
  maturedSignalPairs:rankingSamples.length,
  excludedUnmaturedOrMissingObservations:rankingTargets.length-rankingSamples.length,
  observationErrors:rankingObservationErrors
};
const allShortRows=Object.values(rowsByRegion).flat();
const climatologyComparison=compareForecastToClimatology(allShortRows,climatologyByRegion);
const shortForecastGate={
  requiredPairsPerRegionAndLeadBucket:30,requiredWetAndDryCases:5,byRegion:{}
};
for(const [region,rows] of Object.entries(rowsByRegion)){
  const scored=scoreForecastSamples(rows);
  shortForecastGate.byRegion[region]={};
  for(const bucket of scored.byLeadBucket){
    const ready=bucket.probabilitySampleCount>=30&&bucket.wetDayCount>=5&&bucket.dryDayCount>=5;
    shortForecastGate.byRegion[region][bucket.id]={
      samples:bucket.probabilitySampleCount,wetDays:bucket.wetDayCount,dryDays:bucket.dryDayCount,ready
    };
  }
}
shortForecastGate.ready=Object.values(shortForecastGate.byRegion)
  .every(region=>Object.values(region).every(bucket=>bucket.ready));

// Seasonal verification: aggregate ERA5 daily rain over each forecast's exact
// valid week/month. Only complete periods with explicit mm units are eligible.
const seasonalTargets=buildSeasonalVerificationTargets(snapshots,today);
const seasonalObservations={north:{},central:{},south:{}};
const seasonalErrors={};
for(const [region,point] of Object.entries(regions)){
  const targets=seasonalTargets.filter(x=>x.region===region);
  if(!targets.length)continue;
  const start=targets.map(x=>x.periodStart).sort()[0];
  const end=targets.map(x=>x.periodEnd).sort().at(-1);
  const params=new URLSearchParams({
    latitude:String(point.latitude),longitude:String(point.longitude),
    start_date:start,end_date:end,daily:"precipitation_sum",
    timezone:"Asia/Tokyo",precipitation_unit:"mm",models:"era5"
  });
  try{
    const response=await fetch("https://archive-api.open-meteo.com/v1/archive?"+params);
    if(!response.ok)throw new Error("ERA5 seasonal archive HTTP "+response.status);
    const payload=await response.json();
    for(let i=0;i<(payload.daily?.time||[]).length;i++){
      const value=payload.daily.precipitation_sum?.[i];
      if(typeof value==="number"&&Number.isFinite(value)&&value>=0)
        seasonalObservations[region][payload.daily.time[i]]=value;
    }
  }catch(error){seasonalErrors[region]=error.message}
}
const seasonalVerification=scoreSeasonalVerification(seasonalTargets,seasonalObservations);
const seasonalArchive=summarizeSeasonalArchive(snapshots,today);
const sourceGate=(source)=>{
  const regionsStatus={};
  for(const region of Object.keys(regions)){
    const result=seasonalVerification.bySourceRegion[region]?.[source];
    const count=result?.sampleCount||0;
    const wet=result?.wetDry?.hits+result?.wetDry?.misses||0;
    const dry=result?.wetDry?.falseAlarms+result?.wetDry?.correctNegatives||0;
    regionsStatus[region]={verifiedPeriods:count,wetOutcomes:wet,dryOutcomes:dry,
      ready:count>=30&&wet>=5&&dry>=5};
  }
  return {requiredPerRegion:30,wetAndDryOutcomeMinimum:5,byRegion:regionsStatus,
    ready:Object.values(regionsStatus).every(x=>x.ready)};
};
const ec46Gate=sourceGate("EC46"),seas5Gate=sourceGate("SEAS5");
const calibrationGate={
  status:"locked-awaiting-observations",weightsUpdated:false,
  currentModelWeights:"Provisional v1 weights remain unchanged; no empirical fitting is allowed yet.",
  shortForecast:{...shortForecastGate,observedPairs:sampleCount},
  ec46:ec46Gate,seas5:seas5Gate,
  rule:"Do not change source weights until every region/source has at least 30 completed, unit-verified outcomes and at least five wet plus five dry outcomes. Keep uncertainty/stability separate from rain-risk predictors."
};
const report={
  generatedAt:new Date().toISOString(),asOf:today,
  archive:{snapshotCount:snapshots.length,firstSnapshot:snapshots[0]?.localDate??null,lastSnapshot:snapshots.at(-1)?.localDate??null},
  method:"Short forecasts: daily probability/amount versus ERA5. EC46/SEAS5: archived weekly/monthly precipitation means versus the sum of ERA5 daily precipitation over the exact same valid period.",
  overall,byRegion,regionErrors,climatologyComparison,climatologyErrors,rankingArchiveSummary,rankingVerification,tripWindowSummary,tripWindowRanking,seasonalArchive,seasonalVerification,seasonalErrors,calibrationGate,
  validationStatus:sampleCount>=90?"descriptive-sample-available":"collecting-insufficient-samples",
  caveats:[
    "ERA5 reanalysis is a model-reference dataset, not an independent rain-gauge observation.",
    "Climatology benchmark uses ERA5 1991-2020 same-calendar-day wet frequency and mean rainfall; forecast and baseline scores use identical matched verification rows.",
    "Brier and amount MAE skill scores compare the forecast against the 1991-2020 ERA5 climatology baseline; positive is better, negative is worse.",
    "Short-range Brier score uses wet day >=1.0 mm; rainfall amount MAE is reported separately.",
    "Seasonal precipitation means are compared with accumulated ERA5 precipitation over the exact forecast week/month; only explicit mm units and fully complete periods are eligible.",
    "Seasonal wet/dry classification uses period-average precipitation >=1.0 mm/day. It is categorical verification, not a probability score.",
    "Snapshots are one per Okinawa-local issue date; reruns on the same date replace the prior snapshot.",
    "Unavailable observed dates and incomplete seasonal periods are excluded, never imputed."
  ]
};
await fs.writeFile(new URL("backtest.json",outDir),JSON.stringify(report,null,2));
const lines=[
  "# Okinawa archived forecast verification",
  "",
  "As of: "+today,
  "Archived daily snapshots: "+snapshots.length,
  "Short forecast matched daily rows: "+sampleCount,
  "Status: "+report.validationStatus,
  "",
  "## Seasonal archive and verification",
  "- EC46 archived periods: "+seasonalArchive.totals.ec46.archivedPeriods,
  "- EC46 completed, unit-verified periods: "+seasonalArchive.totals.ec46.unitVerifiedPeriods,
  "- SEAS5 archived periods: "+seasonalArchive.totals.seas5.archivedPeriods,
  "- SEAS5 completed, unit-verified periods: "+seasonalArchive.totals.seas5.unitVerifiedPeriods,
  "- Eligible seasonal targets: "+seasonalTargets.length,
  "- Excluded incomplete observed periods: "+seasonalVerification.excluded.incompleteObservedPeriods,
  "- Excluded periods with no observed daily data: "+seasonalVerification.excluded.missingObservedDays,
  "",
  "### Seasonal source skill (ERA5 reference)",
  ...["EC46","SEAS5"].flatMap(source=>{
    const x=seasonalVerification.bySource[source];
    return ["#### "+source,"- Samples: "+x.sampleCount,
      "- Rainfall total MAE: "+(x.maeMm??"資料不足")+" mm/period",
      "- Mean bias: "+(x.meanBiasMm??"資料不足")+" mm/period",
      "- RMSE: "+(x.rmseMm??"資料不足")+" mm/period",
      "- Wet/dry accuracy: "+(x.wetDry.accuracy??"資料不足")].concat(
        Object.entries(seasonalVerification.bySourceRegion).map(([region,bySource])=>
          bySource[source]?"- "+region+": n="+bySource[source].sampleCount+", MAE="+bySource[source].maeMm+" mm, bias="+bySource[source].meanBiasMm+" mm":"- "+region+": 尚無完整驗證樣本"));
  }),
  "",
  "## Short forecast vs 1991-2020 climatology baseline",
  "- Matched forecast/climatology samples: "+climatologyComparison.overall.sampleCount,
  "- Forecast Brier: "+(climatologyComparison.overall.forecastBrier??"資料不足"),
  "- Climatology Brier: "+(climatologyComparison.overall.climatologyBrier??"資料不足"),
  "- Brier skill score: "+(climatologyComparison.overall.brierSkillScore??"資料不足"),
  "- Forecast rainfall MAE: "+(climatologyComparison.overall.forecastAmountMaeMm??"資料不足")+" mm/day",
  "- Climatology rainfall MAE: "+(climatologyComparison.overall.climatologyAmountMaeMm??"資料不足")+" mm/day",
  "- Rainfall amount MAE skill score: "+(climatologyComparison.overall.amountMaeSkillScore??"資料不足"),
  ...Object.entries(climatologyComparison.byLeadBucket).map(([bucket,x])=>"- "+bucket+" days: n="+x.sampleCount+", Brier skill="+(x.brierSkillScore??"資料不足")+", amount MAE skill="+(x.amountMaeSkillScore??"資料不足")),
  "",
  "## 1-90 day rain-risk ranking verification (ERA5 reference)",
  "- Normalized snapshots: "+rankingArchiveSummary.normalizedSnapshots,
  "- Matured signal/outcome pairs: "+rankingArchiveSummary.maturedSignalPairs,
  "- Excluded immature or unavailable observations: "+rankingArchiveSummary.excludedUnmaturedOrMissingObservations,
  "- Metric: AUC; higher is better. Risk scores are not probabilities.",
  ...Object.entries(rankingVerification.groups).filter(([key])=>key.split(".").length===3).map(([key,x])=>"- "+key+": n="+x.sampleCount+", wet="+x.wetDays+", dry="+x.dryDays+", AUC="+(x.auc??"資料不足")+", gate="+(x.ready?"ready":"locked")),
  "",
  "## Candidate model 5D4N window ranking (shadow comparison)",
  "- Candidate windows generated: "+tripWindowSummary.candidateWindows,
  "- Complete ERA5-observed windows (9 region-days): "+tripWindowSummary.completeObservedWindows,
  "- Excluded incomplete windows: "+tripWindowSummary.excludedIncompleteWindows,
  "- Metric: Spearman correlation; higher positive values mean predicted high-risk windows also had more observed golf-day rain.",
  ...Object.entries(tripWindowRanking.groups).map(([model,x])=>"- "+model+": n="+x.sampleCount+", Spearman="+(x.spearman??"資料不足")+", gate="+(x.ready?"ready":"locked")),
  "- Candidate weights are provisional and shadow-only; no production weights were changed.",
  "",
  "## Calibration gate",
  "- Status: "+calibrationGate.status,
  "- Weights updated: "+calibrationGate.weightsUpdated,
  "- Short forecast daily pairs: "+sampleCount,
  ...["EC46","SEAS5"].flatMap(source=>{
    const gate=source==="EC46"?ec46Gate:seas5Gate;
    return ["- "+source+" gate: "+(gate.ready?"ready":"not ready"),
      ...Object.entries(gate.byRegion).map(([region,x])=>"-   "+region+": n="+x.verifiedPeriods+", wet="+x.wetOutcomes+", dry="+x.dryOutcomes+", ready="+x.ready)];
  }),
  "- "+calibrationGate.rule,
  "",
  "## Short forecast overall",
  "- Brier score: "+(overall.overall.brierScore??"資料不足"),
  "- Daily rainfall amount MAE: "+(overall.overall.rainfallAmountMaeMm==null?"資料不足":overall.overall.rainfallAmountMaeMm+" mm/day"),
  "",
  "## Short forecast by region",
  ...Object.entries(byRegion).flatMap(([region,result])=>[
    "### "+region,
    "- Probability samples: "+result.overall.probabilitySampleCount,
    "- Brier score: "+(result.overall.brierScore??"資料不足"),
    "- Rainfall amount MAE: "+(result.overall.rainfallAmountMaeMm==null?"資料不足":result.overall.rainfallAmountMaeMm+" mm/day")
  ]),
  "",
  "## Limitations",
  ...report.caveats.map(x=>"- "+x),
  "- "+seasonalArchive.guidance,
  ...Object.entries(regionErrors).map(([region,error])=>"- "+region+" short ERA5 reference unavailable: "+error),
  ...Object.entries(seasonalErrors).map(([region,error])=>"- "+region+" seasonal ERA5 reference unavailable: "+error),
  ...Object.entries(climatologyErrors).map(([region,error])=>"- "+region+" ERA5 climatology baseline unavailable: "+error)
];
await fs.writeFile(new URL("backtest.md",outDir),lines.join("\n"));
console.log(lines.join("\n"));
