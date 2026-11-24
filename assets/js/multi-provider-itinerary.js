import {compareProviderGolfWindow} from "./provider-comparison.js";
import {scoreMultiProviderGolfWindow} from "./weighted-weather-score.js";
import {scoreGolfSuitabilityWindow} from "./suitability-engine.js";
const DAY=86400000;
const addDays=(date,n)=>new Date(Date.parse(date+"T00:00:00Z")+n*DAY).toISOString().slice(0,10);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
/** Rank 5d/4n itineraries using the 65/15/20 provider-median score.
 * Each golf day requires at least two complete provider forecasts for its course.
 * Travel days are not scored. */
export function recommendMultiProviderFiveDayWindows({courses,independentProviders,teeHour=7,limit=3,minStartGap=5,minimumProviders=2}){
 if(!Array.isArray(courses)||courses.length!==3)throw new RangeError("Exactly three courses are required");
 if(!Array.isArray(independentProviders))throw new TypeError("independentProviders array is required");
 if(!Number.isInteger(teeHour)||teeHour<6||teeHour>13)throw new RangeError("teeHour must be between 06:00 and 13:00");
 const providerByCourse=new Map(independentProviders.map(x=>[x.course?.id,x]));
 const dateSets=courses.map(c=>new Set((c.hourly?.time??[]).map(t=>t.slice(0,10))));
 const common=[...(dateSets[0]??[])].filter(d=>dateSets.every(s=>s.has(d))).sort();
 const starts=common.filter(start=>[1,2,3].every(offset=>dateSets.every(s=>s.has(addDays(start,offset)))));
 const all=starts.map(tripStart=>{
  const rounds=courses.map((course,index)=>{
   const date=addDays(tripStart,index+1);
   const comparison=compareProviderGolfWindow({openMeteo:course,independentProviders:providerByCourse.get(course.course.id),date,teeHour,timeZone:course.course.timezone??"Asia/Tokyo"});
   const score=scoreMultiProviderGolfWindow(comparison,{minimumProviders});
   const safety=scoreGolfSuitabilityWindow(course.hourly,date,teeHour,6);
   return {round:index+1,date,courseId:course.course.id,courseName:course.course.name,score,safety};
  });
  const complete=rounds.filter(x=>x.score.status==="scored"&&x.safety.status==="scored");
  if(complete.length!==3)return {status:"insufficient-data",tripStart,tripEnd:addDays(tripStart,4),rounds,scoredRounds:complete.length,itineraryRisk:null};
  const safetyOverrides=complete.filter(x=>x.safety.severity>=3);
  if(safetyOverrides.length)return {status:"excluded-severe-weather",tripStart,tripEnd:addDays(tripStart,4),rounds,scoredRounds:3,itineraryRisk:null,safetyOverrides:safetyOverrides.map(x=>({date:x.date,courseName:x.courseName,reasons:x.safety.reasons}))};
  const values=complete.map(x=>x.score.weightedRisk),average=mean(values),worst=Math.max(...values);
  const itineraryRisk=Math.round((.7*average+.3*worst)*10)/10;
  return {status:"scored",tripStart,tripEnd:addDays(tripStart,4),rounds,scoredRounds:3,averageRisk:Math.round(average*10)/10,worstRisk:worst,itineraryRisk,
   label:itineraryRisk<15?"低":itineraryRisk<35?"偏低":itineraryRisk<60?"中":itineraryRisk<80?"高":"很高",
   providersPerRound:rounds.map(x=>({date:x.date,count:x.score.providerCount,providers:x.score.providers}))};
 });
 const scored=all.filter(x=>x.status==="scored").sort((a,b)=>a.itineraryRisk-b.itineraryRisk||a.tripStart.localeCompare(b.tripStart));
 const excludedSevereCount=all.filter(x=>x.status==="excluded-severe-weather").length;
 const selected=[];
 for(const item of scored){if(selected.every(x=>Math.abs((Date.parse(item.tripStart+"T00:00:00Z")-Date.parse(x.tripStart+"T00:00:00Z"))/DAY)>=minStartGap)){selected.push(item);if(selected.length===limit)break;}}
 return {candidateCount:starts.length,scoredCount:scored.length,missingCount:all.filter(x=>x.status==="insufficient-data").length,excludedSevereCount,recommendations:selected.map((x,i)=>({...x,recommendationRank:i+1,confidence:"provisional",confidenceLabel:"暫定（多來源未回測校準）"})),all,
  method:"rainfall 65%, wind 15%, temperature comfort 20%; provider-wise median; itinerary 70% average + 30% worst round; exclude any round with a severe thunderstorm, extreme gust/wind, or extreme apparent-temperature signal from the existing playability overlay",
  minimumProviders};
}
