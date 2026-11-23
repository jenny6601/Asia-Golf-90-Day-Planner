/**
 * Coarse 17-90 day trip-window screening.
 * Uses weekly EFI (17-46d) and monthly precipitation anomaly (47-90d).
 * Outputs ordinal tendency classes only; never daily rain probabilities or precise risk scores.
 */
const DAY=86400000;
const addDays=(s,n)=>new Date(Date.parse(s+"T00:00:00Z")+n*DAY).toISOString().slice(0,10);
const lead=(date,ref)=>(Date.parse(date+"T00:00:00Z")-Date.parse(ref+"T00:00:00Z"))/DAY;
function weeklyAt(series,date){
 const times=series?.time??[];
 // Weekly records describe bounded periods. Never carry the last available
 // EFI value forward indefinitely when a later week is missing.
 for(let i=0;i<times.length;i++){
  const start=times[i];
  const next=times[i+1]??addDays(start,7);
  if(typeof start==="string"&&date>=start&&date<next)
   return {index:i,date:start,periodEnd:addDays(next,-1)};
 }
 return null;
}
function classifyWeekly(series,date){
 const rec=weeklyAt(series,date);if(!rec)return null;
 const efi=series.precipitation_efi?.[rec.index];
 if(typeof efi!=="number"||!Number.isFinite(efi))return null;
 const rank=efi>=0.8?3:efi>=0.5?2:efi<=-0.5?0:1;
 return {rank,label:rank===3?"顯著偏濕":rank===2?"偏濕":rank===0?"偏乾":"接近基準",period:rec.date,periodEnd:rec.periodEnd,efi};
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
  const regional=points.map(p=>({zone:p.point.id,label:p.point.label,signal:signalForPoint(p,date,days)}));
  if(regional.some(x=>!x.signal))return {date,status:"insufficient-data",regional};
  const worst=regional.reduce((a,b)=>b.signal.rank>a.signal.rank?b:a,regional[0]);
  const average=regional.reduce((s,x)=>s+x.signal.rank,0)/regional.length;
  return {date,leadDays:days,status:"scored",regional,worstZone:worst.zone,worstZoneLabel:worst.label,worstSignal:worst.signal,regionalMeanRank:average,rank:Math.max(worst.signal.rank,Math.round(average))};
 });
 if(rounds.some(x=>x.status!=="scored"))return {status:"insufficient-data",tripStart,tripEnd:addDays(tripStart,4),rounds,missingDates:rounds.filter(x=>x.status!=="scored").map(x=>x.date)};
 const ranks=rounds.map(x=>x.rank),mean=ranks.reduce((a,b)=>a+b,0)/3,worst=Math.max(...ranks);
 const tendencyRank=Math.max(Math.round(mean),worst);
 return {status:"scored",tripStart,tripEnd:addDays(tripStart,4),golfDates,rounds,tendencyRank,tendency:labelFor(tendencyRank),
  confidence:rounds.some(x=>x.leadDays>46)?"極低":"低",
  confidenceBasis:"依行程中最長預報提前期與資料解析度決定，不受濕潤趨勢等級影響",
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
 return {candidateCount:all.length,scoredCount:scored.length,missingCount:all.length-scored.length,
  rankingBasis:"ordinal-tendency-only",
  rankingNote:"同一趨勢級別的候選日期視為同級；日期先後僅用於排列與間距，不代表天氣優劣差異。",
  recommendations:selected.map((x,i)=>({...x,recommendationRank:i+1,rankingNote:"同級候選日期不代表彼此有可量化的天氣差異。"})),all};
}
