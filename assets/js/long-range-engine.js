/**
 * Coarse 17-90 day trip-window screening.
 * Uses weekly EFI (17-46d) and monthly precipitation anomaly (47-90d).
 * Outputs ordinal tendency classes only; never daily rain probabilities or precise risk scores.
 */
const DAY=86400000;
const addDays=(s,n)=>new Date(Date.parse(s+"T00:00:00Z")+n*DAY).toISOString().slice(0,10);
const lead=(date,ref)=>(Date.parse(date+"T00:00:00Z")-Date.parse(ref+"T00:00:00Z"))/DAY;
function weeklyAt(series,date){
 const times=series?.time??[];let idx=-1;
 for(let i=0;i<times.length;i++)if(times[i]<=date)idx=i;
 if(idx<0)return null;
 // A weekly signal applies only to its own seven-day bucket; never carry it forward.
 if(date>=addDays(times[idx],7))return null;
 return {index:idx,date:times[idx]};
}
function classifyWeekly(series,date){
 const rec=weeklyAt(series,date);if(!rec)return null;
 const efi=series.precipitation_efi?.[rec.index];
 if(typeof efi!=="number"||!Number.isFinite(efi))return null;
 const rank=efi>=0.8?3:efi>=0.5?2:efi<=-0.5?0:1;
 return {rank,label:rank===3?"顯著偏濕":rank===2?"偏濕":rank===0?"偏乾":"接近基準",period:rec.date,efi};
}
function classifyMonthly(series,date){
 const month=date.slice(0,7),idx=(series?.time??[]).findIndex(x=>x.slice(0,7)===month);
 if(idx<0)return null;
 const mean=series.precipitation_mean?.[idx],anomaly=series.precipitation_anomaly?.[idx];
 if(typeof mean!=="number"||!Number.isFinite(mean)||mean<=0||typeof anomaly!=="number"||!Number.isFinite(anomaly))return null;
 const ratio=anomaly/mean;
 const rank=ratio>=0.2?3:ratio>=0.05?2:ratio<=-0.2?0:1;
 return {rank,label:rank===3?"顯著偏濕":rank===2?"偏濕":rank===0?"偏乾":"接近基準",period:series.time[idx],anomalyMm:anomaly,anomalyRatio:Math.round(ratio*100)};
}
function signalForPoint(point,date,daysFromRef){
 if(daysFromRef<=46)return classifyWeekly(point.weekly,date);
 return classifyMonthly(point.monthly,date);
}
const labelFor=rank=>rank===0?"偏乾趨勢":rank===1?"接近基準":rank===2?"偏濕趨勢":"顯著偏濕趨勢";
export function evaluateLongRangeTripWindow({tripStart,referenceDate,points}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(tripStart)||!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)||!Array.isArray(points)||points.length!==3)
  throw new TypeError("tripStart/referenceDate/three regional points are required");
 const golfDates=[1,2,3].map(n=>addDays(tripStart,n));
 const rounds=golfDates.map(date=>{
  const days=lead(date,referenceDate);
  if(days<17||days>90)return {date,status:"out-of-range"};
  const seenCells=new Set();
  const independentPoints=points.filter(p=>{
   const lat=p.latitude??p.point.latitude,lon=p.longitude??p.point.longitude;
   const key=Number.isFinite(lat)&&Number.isFinite(lon)?lat.toFixed(4)+","+lon.toFixed(4):"zone:"+p.point.id;
   if(seenCells.has(key))return false;
   seenCells.add(key);return true;
  });
  const regional=independentPoints.map(p=>({zone:p.point.id,label:p.point.label,signal:signalForPoint(p,date,days)}));
  if(regional.some(x=>!x.signal))return {date,status:"insufficient-data",regional};
  const worst=regional.reduce((a,b)=>b.signal.rank>a.signal.rank?b:a,regional[0]);
  const average=regional.reduce((s,x)=>s+x.signal.rank,0)/regional.length;
  return {date,status:"scored",regional,regionalSampleCount:regional.length,worstZone:worst.zone,worstZoneLabel:worst.label,worstSignal:worst.signal,regionalMeanRank:average,rank:Math.max(worst.signal.rank,Math.round(average))};
 });
 if(rounds.some(x=>x.status!=="scored"))return {status:"insufficient-data",tripStart,tripEnd:addDays(tripStart,4),rounds,missingDates:rounds.filter(x=>x.status!=="scored").map(x=>x.date)};
 const ranks=rounds.map(x=>x.rank),mean=ranks.reduce((a,b)=>a+b,0)/3,worst=Math.max(...ranks);
 const tendencyRank=Math.max(Math.round(mean),worst);
 return {status:"scored",tripStart,tripEnd:addDays(tripStart,4),golfDates,rounds,regionalSampleCount:Math.min(...rounds.map(x=>x.regionalSampleCount)),tendencyRank,tendency:labelFor(tendencyRank),
  confidence:tendencyRank>=2?"低":"極低",
  temporalConfidence:tendencyRank>=2?"低":"極低",
  spatialConfidence:Math.min(...rounds.map(x=>x.regionalSampleCount))>=3?"較完整":Math.min(...rounds.map(x=>x.regionalSampleCount))===2?"有限":"非常有限",
  spatialWarning:Math.min(...rounds.map(x=>x.regionalSampleCount))<3?"代表區域有重複預報網格，空間證據有限；不可解讀為多區獨立確認。":null,
  interpretation:"區域週／月尺度濕潤趨勢篩選；不是逐日降雨預報、降雨機率或取消機率"};
}
export function recommendLongRangeWindows({referenceDate,points,limit=3,minStartGap=5,horizonDays=90}){
 const first=addDays(referenceDate,16),lastStart=addDays(referenceDate,horizonDays-5);
 const all=[];
 for(let d=first;d<=lastStart;d=addDays(d,1))all.push(evaluateLongRangeTripWindow({tripStart:d,referenceDate,points}));
 const scored=all.filter(x=>x.status==="scored").sort((a,b)=>a.tendencyRank-b.tendencyRank||a.tripStart.localeCompare(b.tripStart));
 const selected=[];
 for(const item of scored){
  if(selected.every(x=>Math.abs((Date.parse(item.tripStart+"T00:00:00Z")-Date.parse(x.tripStart+"T00:00:00Z"))/DAY)>=minStartGap)){
   selected.push(item);if(selected.length===limit)break;
  }
 }
 const missingCount=all.length-scored.length;
 const coverageRate=all.length?Number((scored.length/all.length).toFixed(3)):0;
 const buckets={weekly:{label:"17–46 天（週 EFI）",candidateCount:0,scoredCount:0},monthly:{label:"47–90 天（月距平）",candidateCount:0,scoredCount:0},transition:{label:"跨越 46／47 天邊界",candidateCount:0,scoredCount:0}};
 for(const item of all){
  const leads=item.rounds.map(round=>lead(round.date,referenceDate));
  const key=Math.max(...leads)<=46?"weekly":Math.min(...leads)>=47?"monthly":"transition";
  buckets[key].candidateCount++;
  if(item.status==="scored")buckets[key].scoredCount++;
 }
 const coverageByHorizon=Object.fromEntries(Object.entries(buckets).map(([key,b])=>[key,{
  ...b,missingCount:b.candidateCount-b.scoredCount,
  coverageRate:b.candidateCount?Number((b.scoredCount/b.candidateCount).toFixed(3)):0
 }]));
 return {candidateCount:all.length,scoredCount:scored.length,missingCount,coverageRate,coverageByHorizon,recommendations:selected.map((x,i)=>({...x,recommendationRank:i+1})),all};
}
