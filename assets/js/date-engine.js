/**
 * Deterministic trip-date engine. No network access or forecast fetching.
 * Supply validated daily risk records from a separate data layer.
 */
export const WEIGHTS = Object.freeze({ rain: 0.60, wind: 0.15, thermal: 0.10, severe: 0.10 });
const clamp=(x)=>Math.max(0,Math.min(100,x));
const iso=(s)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"));
const add=(s,n)=>{const d=new Date(s+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const gap=(a,b)=>Math.round((Date.parse(b+"T00:00:00Z")-Date.parse(a+"T00:00:00Z"))/86400000);
const avg=(xs)=>xs.reduce((a,b)=>a+b,0)/xs.length;

export function generateTripWindows({startDate,horizonDays=90,tripDays=5,golfDayOffsets=[1,2,3]}){
 if(!iso(startDate)) throw new TypeError("startDate must be YYYY-MM-DD");
 if(!Number.isInteger(horizonDays)||!Number.isInteger(tripDays)||tripDays<1||horizonDays<tripDays) throw new RangeError("Invalid horizonDays/tripDays");
 if(!Array.isArray(golfDayOffsets)||golfDayOffsets.some(x=>!Number.isInteger(x)||x<0||x>=tripDays)) throw new RangeError("Invalid golfDayOffsets");
 return Array.from({length:horizonDays-tripDays+1},(_,i)=>{const tripStart=add(startDate,i);return {tripStart,tripEnd:add(tripStart,tripDays-1),golfDates:golfDayOffsets.map(x=>add(tripStart,x)),tripDays};});
}
function normalize(r){
 if(!r||typeof r!=="object") return null;
 for(const k of ["rainRisk","windRisk","thermalRisk","severeRisk"]) if(typeof r[k]!=="number"||!Number.isFinite(r[k])||r[k]<0||r[k]>100)return null;
 if(typeof r.dataCompleteness!=="number"||r.dataCompleteness<0||r.dataCompleteness>1)return null;
 return {...r};
}
function scoreDay(r){
 r=normalize(r);if(!r)return null;
 const penalty=WEIGHTS.rain*r.rainRisk+WEIGHTS.wind*r.windRisk+WEIGHTS.thermal*r.thermalRisk+WEIGHTS.severe*r.severeRisk;
 return {...r,suitability:clamp(100-penalty)};
}
function scoreZones(z){
 const keys=["north","central","south"],days={};
 for(const k of keys){days[k]=scoreDay(z?.[k]);if(!days[k])return null;}
 const fields=["suitability","rainRisk","windRisk","thermalRisk","severeRisk","dataCompleteness"];
 const out=Object.fromEntries(fields.map(f=>[f,avg(keys.map(k=>days[k][f]))]));
 const worstZone=keys.reduce((a,b)=>days[b].suitability<days[a].suitability?b:a,keys[0]);
 return {...out,perZone:days,worstZone,worstZoneSuitability:days[worstZone].suitability,worstZoneSevereRisk:Math.max(...keys.map(k=>days[k].severeRisk))};
}
export function scoreTripWindow(window,dailyInputs){
 const golfDays=window.golfDates.map(date=>{
  const raw=dailyInputs?.[date],zoned=raw&&["north","central","south"].every(k=>raw[k]);
  return {date,score:zoned?scoreZones(raw):scoreDay(raw)};
 });
 if(golfDays.some(x=>!x.score))return {...window,status:"insufficient-data",score:null,confidence:"low",missingDates:golfDays.filter(x=>!x.score).map(x=>x.date)};
 const vals=golfDays.map(x=>x.score.suitability),mean=avg(vals),worst=Math.min(...vals);
 const golfSuitability=.7*mean+.3*worst;
 const travel=[window.tripStart,window.tripEnd].map(d=>scoreDay(dailyInputs?.[d]));
 const travelSuitability=travel.every(Boolean)?avg(travel.map(x=>x.suitability)):null;
 const score=travelSuitability===null?golfSuitability:.95*golfSuitability+.05*travelSuitability;
 const completeness=avg(golfDays.map(x=>x.score.dataCompleteness));
 const confidence=completeness>=.85?"high":completeness>=.60?"medium":"low";
 const zoned=golfDays.filter(x=>x.score.worstZone);
 const worstZone=zoned.length?zoned.reduce((a,x)=>x.score.worstZoneSuitability<a.suitability?{zone:x.score.worstZone,date:x.date,suitability:x.score.worstZoneSuitability}:a,{zone:zoned[0].score.worstZone,date:zoned[0].date,suitability:zoned[0].score.worstZoneSuitability}):null;
 const severeOverride=golfDays.some(x=>x.score.severeRisk>=90 || x.score.worstZoneSevereRisk>=90 || (x.score.perZone && Object.values(x.score.perZone).some(z=>z.severeRisk>=90)));
 const band=severeOverride?"avoid":score>=85?"excellent":score>=70?"good":score>=55?"caution":"not-recommended";
 return {...window,status:"scored",score:Math.round(clamp(score)*10)/10,band,confidence,confidenceCompleteness:Math.round(completeness*100),golfDays:golfDays.map(x=>({date:x.date,suitability:Math.round(x.score.suitability*10)/10,rainRisk:x.score.rainRisk,severeRisk:x.score.severeRisk,worstZone:x.score.worstZone??null})),meanGolfSuitability:Math.round(mean*10)/10,worstGolfDaySuitability:Math.round(worst*10)/10,travelSuitability:travelSuitability===null?null:Math.round(travelSuitability*10)/10,worstZone,severeOverride};
}
export function rankDistinctWindows(items,{limit=3,minStartGap=5}={}){
 const sorted=items.filter(x=>x.status==="scored"&&Number.isFinite(x.score)&&!x.severeOverride).sort((a,b)=>b.score-a.score||a.tripStart.localeCompare(b.tripStart));
 const out=[];for(const item of sorted){if(out.every(p=>Math.abs(gap(p.tripStart,item.tripStart))>=minStartGap)){out.push(item);if(out.length===limit)break;}}
 return out.map((x,i)=>({...x,recommendationRank:i+1}));
}
export function recommendTripDates({startDate,horizonDays=90,dailyInputs,limit=3}){
 const windows=generateTripWindows({startDate,horizonDays}),all=windows.map(w=>scoreTripWindow(w,dailyInputs));
 return {candidateCount:windows.length,scoredCount:all.filter(x=>x.status==="scored").length,missingCount:all.filter(x=>x.status!=="scored").length,recommendations:rankDistinctWindows(all,{limit}),all};
}
