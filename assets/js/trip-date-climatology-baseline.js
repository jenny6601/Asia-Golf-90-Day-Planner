/**
 * Same-calendar-day ERA5 climatology baseline for fair forecast skill comparison.
 * Baseline years are fixed and end before the current verification period.
 */
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const keyOf=date=>date.slice(5,10);
export function buildDailyClimatology(dailyRows=[]){
 if(!Array.isArray(dailyRows))throw new TypeError("dailyRows must be an array");
 const groups=new Map();
 for(const row of dailyRows){
  if(typeof row.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!finite(row.rainMm)||row.rainMm<0)continue;
  const key=keyOf(row.date);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row.rainMm);
 }
 return Object.fromEntries([...groups.entries()].map(([key,values])=>[key,{
  sampleCount:values.length,
  wetDayFrequency:values.filter(x=>x>=1).length/values.length,
  meanRainMm:values.reduce((s,x)=>s+x,0)/values.length,
  wetDayMeanRainMm:values.filter(x=>x>=1).length?values.filter(x=>x>=1).reduce((s,x)=>s+x,0)/values.filter(x=>x>=1).length:0
 }]));
}
function metrics(rows){
 if(!rows.length)return {sampleCount:0,forecastBrier:null,climatologyBrier:null,brierSkillScore:null,forecastAmountMaeMm:null,climatologyAmountMaeMm:null,amountMaeSkillScore:null};
 const fB=rows.reduce((s,x)=>s+(x.probability/100-(x.observedRainMm>=1?1:0))**2,0)/rows.length;
 const cB=rows.reduce((s,x)=>(s+(x.climatologyProbability-(x.observedRainMm>=1?1:0))**2),0)/rows.length;
 const fM=rows.reduce((s,x)=>s+Math.abs(x.forecastRainMm-x.observedRainMm),0)/rows.length;
 const cM=rows.reduce((s,x)=>s+Math.abs(x.climatologyRainMm-x.observedRainMm),0)/rows.length;
 return {sampleCount:rows.length,forecastBrier:Number(fB.toFixed(4)),climatologyBrier:Number(cB.toFixed(4)),
  brierSkillScore:cB>0?Number((1-fB/cB).toFixed(4)):null,
  forecastAmountMaeMm:Number(fM.toFixed(2)),climatologyAmountMaeMm:Number(cM.toFixed(2)),
  amountMaeSkillScore:cM>0?Number((1-fM/cM).toFixed(4)):null};
}
export function compareForecastToClimatology(forecastRows=[],climatologyByRegion={}){
 if(!Array.isArray(forecastRows))throw new TypeError("forecastRows must be an array");
 const eligible=[];
 const excluded={missingClimatology:0,missingForecastProbabilityOrAmount:0};
 for(const row of forecastRows){
  if(!finite(row.probability)||row.probability<0||row.probability>100||!finite(row.forecastRainMm)||row.forecastRainMm<0||!finite(row.observedRainMm)||row.observedRainMm<0){excluded.missingForecastProbabilityOrAmount++;continue}
  const climate=climatologyByRegion[row.region]?.[keyOf(row.targetDate)];
  if(!climate||!finite(climate.wetDayFrequency)||!finite(climate.meanRainMm)){excluded.missingClimatology++;continue}
  eligible.push({...row,climatologyProbability:climate.wetDayFrequency,climatologyRainMm:climate.meanRainMm});
 }
 const byRegion={};
 for(const region of ["north","central","south"])byRegion[region]=metrics(eligible.filter(x=>x.region===region));
 const byLeadBucket={};
 for(const [id,min,max] of [["1-3",1,3],["4-7",4,7],["8-16",8,16]]){
  byLeadBucket[id]=metrics(eligible.filter(x=>x.leadDays>=min&&x.leadDays<=max));
 }
 return {reference:"ERA5 same-calendar-day climatology 1991-2020; wet day >=1 mm",
  overall:metrics(eligible),byRegion,byLeadBucket,excluded,
  interpretation:"Positive skill score means the forecast error is lower than the climatology baseline; negative means worse. Skill scores are descriptive until samples are adequate."};
}
