/**
 * Verification of archived EC46 weekly and SEAS5 monthly precipitation means.
 * Forecast totals are compared with complete ERA5 daily precipitation totals
 * over the same valid period. ERA5 is a reanalysis reference, not a rain gauge.
 */
const finite=value=>typeof value==="number"&&Number.isFinite(value);
const dayNumber=date=>Date.parse(date+"T00:00:00Z")/86400000;
const addDays=(date,n)=>new Date((dayNumber(date)+n)*86400000).toISOString().slice(0,10);
const monthEnd=month=>{
  const [year,mm]=month.split("-").map(Number);
  return new Date(Date.UTC(year,mm,0)).toISOString().slice(0,10);
};
const monthDays=month=>Number(monthEnd(month).slice(8,10));
const validDate=value=>typeof value==="string"&&/^\\d{4}-\\d{2}-\\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+"T00:00:00Z"));
function summarize(rows,periodDays){
  const valid=rows.filter(x=>finite(x.forecastMm)&&x.forecastMm>=0&&finite(x.observedMm)&&x.observedMm>=0);
  if(!valid.length)return {sampleCount:0,maeMm:null,meanBiasMm:null,rmseMm:null,wetDry:{hits:0,falseAlarms:0,misses:0,correctNegatives:0,accuracy:null}};
  const errors=valid.map(x=>x.forecastMm-x.observedMm);
  const mae=errors.reduce((s,x)=>s+Math.abs(x),0)/errors.length;
  const bias=errors.reduce((s,x)=>s+x,0)/errors.length;
  const rmse=Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/errors.length);
  const threshold=periodDays; // wet period = average >=1 mm/day
  let hits=0,falseAlarms=0,misses=0,correctNegatives=0;
  for(const x of valid){
    const forecastWet=x.forecastMm>=threshold,observedWet=x.observedMm>=threshold;
    if(forecastWet&&observedWet)hits++;
    else if(forecastWet)falseAlarms++;
    else if(observedWet)misses++;
    else correctNegatives++;
  }
  return {sampleCount:valid.length,maeMm:Number(mae.toFixed(2)),meanBiasMm:Number(bias.toFixed(2)),rmseMm:Number(rmse.toFixed(2)),
    wetDry:{hits,falseAlarms,misses,correctNegatives,accuracy:Number(((hits+correctNegatives)/valid.length).toFixed(3))}};
}
export function buildSeasonalVerificationTargets(snapshots=[],asOf){
  if(!Array.isArray(snapshots))throw new TypeError("snapshots must be an array");
  if(!validDate(asOf))throw new TypeError("asOf must be YYYY-MM-DD");
  const targets=[];
  for(const snapshot of snapshots){
    const issueDate=snapshot.localDate;
    if(!validDate(issueDate))continue;
    for(const region of ["north","central","south"]){
      const seasonal=snapshot.seasonal?.[region];
      if(!seasonal)continue;
      const weekly=seasonal.weekly||{};
      if(seasonal.weeklyUnits?.precipitation_mean==="mm"){
        for(let i=0;i<(weekly.time||[]).length;i++){
          const start=String(weekly.time[i]).slice(0,10),forecastMm=weekly.precipitation_mean?.[i],end=validDate(start)?addDays(start,6):"";
          if(validDate(start)&&finite(forecastMm)&&forecastMm>=0&&start>issueDate&&end<asOf)
            targets.push({source:"EC46",region,issueDate,periodStart:start,periodEnd:end,periodDays:7,forecastMm});
        }
      }
      const monthly=seasonal.monthly||{};
      if(seasonal.monthlyUnits?.precipitation_mean==="mm"){
        for(let i=0;i<(monthly.time||[]).length;i++){
          const month=String(monthly.time[i]).slice(0,7),forecastMm=monthly.precipitation_mean?.[i];
          if(/^\\d{4}-\\d{2}$/.test(month)&&finite(forecastMm)&&forecastMm>=0){
            const start=month+"-01",end=monthEnd(month),days=monthDays(month);
            if(start>issueDate&&end<asOf)targets.push({source:"SEAS5",region,issueDate,periodStart:start,periodEnd:end,periodDays:days,forecastMm});
          }
        }
      }
    }
  }
  return targets;
}
export function scoreSeasonalVerification(targets=[],dailyObservations={}){
  if(!Array.isArray(targets))throw new TypeError("targets must be an array");
  const rowsBySourceRegion={};
  const excluded={incompleteObservedPeriods:0,missingObservedDays:0};
  for(const target of targets){
    const key=target.region+"|"+target.source;
    const series=dailyObservations[target.region]||{};
    let total=0,count=0;
    for(let offset=0;offset<target.periodDays;offset++){
      const date=addDays(target.periodStart,offset),value=series[date];
      if(finite(value)&&value>=0){total+=value;count++}
    }
    if(count!==target.periodDays){
      if(count===0)excluded.missingObservedDays++;
      else excluded.incompleteObservedPeriods++;
      continue;
    }
    (rowsBySourceRegion[key]??=[]).push({...target,observedMm:Number(total.toFixed(2))});
  }
  const bySourceRegion={};
  for(const [key,rows] of Object.entries(rowsBySourceRegion)){
    const [region,source]=key.split("|");
    bySourceRegion[region]??={};
    bySourceRegion[region][source]={...summarize(rows,rows[0].periodDays),periods:rows.map(({issueDate,periodStart,periodEnd,forecastMm,observedMm})=>({issueDate,periodStart,periodEnd,forecastMm,observedMm,errorMm:Number((forecastMm-observedMm).toFixed(2))}))};
  }
  const bySource={};
  for(const source of ["EC46","SEAS5"]){
    const rows=Object.entries(rowsBySourceRegion).filter(([key])=>key.endsWith("|"+source)).flatMap(([,value])=>value);
    bySource[source]=rows.length?summarize(rows,rows[0].periodDays):{sampleCount:0,maeMm:null,meanBiasMm:null,rmseMm:null,wetDry:{hits:0,falseAlarms:0,misses:0,correctNegatives:0,accuracy:null}};
  }
  return {bySource,bySourceRegion,excluded};
}
