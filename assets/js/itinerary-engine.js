import {scoreGolfRainWindow} from "./rain-risk.js";
import {scoreGolfSuitabilityWindow} from "./suitability-engine.js";

const DAY_MS=86400000;
const addDays=(date,n)=>new Date(Date.parse(date+"T00:00:00Z")+n*DAY_MS).toISOString().slice(0,10);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;

/**
 * Evaluate a five-day/four-night itinerary with rounds on trip days 2, 3 and 4.
 * courses must be in the intended round order and each item must contain hourly data.
 * Day 1 and Day 5 are reported as travel days, but are not scored without travel-location
 * forecasts. Missing golf-hour data is never imputed.
 */
export function scoreFiveDayItinerary({tripStart, courses, teeHour=7}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tripStart) || Number.isNaN(Date.parse(tripStart+"T00:00:00Z"))) {
    throw new TypeError("tripStart must be YYYY-MM-DD");
  }
  if (!Array.isArray(courses) || courses.length !== 3) {
    throw new RangeError("Exactly three selected courses are required, in round order");
  }
  if (!Number.isInteger(teeHour) || teeHour < 6 || teeHour > 13) {
    throw new RangeError("teeHour must be between 06:00 and 13:00");
  }
  const tripEnd=addDays(tripStart,4);
  const rounds=courses.map((course,index)=>{
    const date=addDays(tripStart,index+1);
    const score=scoreGolfRainWindow(course.hourly,date,teeHour,6);
    const suitability=scoreGolfSuitabilityWindow(course.hourly,date,teeHour,6);
    return {round:index+1,date,courseId:course.course.id,courseName:course.course.name,area:course.course.area,score,suitability};
  });
  const valid=rounds.filter(x=>x.score.status==="scored"&&x.suitability?.status==="scored");
  if (valid.length !== 3) {
    return {
      status:"insufficient-data",tripStart,tripEnd,tripDays:5,nights:4,teeHour,
      travelDays:[{date:tripStart,day:1},{date:tripEnd,day:5}],
      rounds,scoredRounds:valid.length,missingRounds:3-valid.length,
      itineraryRisk:null,averageRoundRisk:null,worstRoundRisk:null,bestRound:null,worstRound:null,
      message:"至少一場球缺少完整六小時逐時資料；不產生整趟行程分數。"
    };
  }
  const risks=valid.map(x=>x.score.rainRisk);
  const averageRoundRisk=mean(risks);
  const worstRoundRisk=Math.max(...risks);
  const itineraryRisk=Math.round((0.7*averageRoundRisk+0.3*worstRoundRisk)*10)/10;
  const label=itineraryRisk<15?"低":itineraryRisk<35?"偏低":itineraryRisk<60?"中":itineraryRisk<80?"高":"很高";
  const bestRound=valid.reduce((a,b)=>a.score.rainRisk<=b.score.rainRisk?a:b);
  const worstRound=valid.reduce((a,b)=>a.score.rainRisk>=b.score.rainRisk?a:b);
  return {
    status:"scored",tripStart,tripEnd,tripDays:5,nights:4,teeHour,
    travelDays:[{date:tripStart,day:1},{date:tripEnd,day:5}],
    rounds,scoredRounds:3,missingRounds:0,
    averageRoundRisk:Math.round(averageRoundRisk*10)/10,
    worstRoundRisk,
    itineraryRisk,label,
    bestRound:{round:bestRound.round,date:bestRound.date,courseId:bestRound.courseId,courseName:bestRound.courseName,risk:bestRound.score.rainRisk},
    worstRound:{round:worstRound.round,date:worstRound.date,courseId:worstRound.courseId,courseName:worstRound.courseName,risk:worstRound.score.rainRisk},
    calibration:"unvalidated"
  };
}

/**
 * Rank non-overlapping five-day windows from real hourly course forecasts.
 * Only dates with complete six-hour data for all three ordered rounds are eligible.
 */
export function recommendFiveDayWindows({courses,teeHour=7,limit=3,minStartGap=5,referenceDate}){
 if(!Array.isArray(courses)||courses.length!==3)throw new RangeError("Exactly three selected courses are required");
 if(!Number.isInteger(limit)||limit<1||!Number.isInteger(minStartGap)||minStartGap<1)throw new RangeError("Invalid ranking options");
 const dates=courses.map(c=>new Set((c.hourly?.time??[]).map(t=>t.slice(0,10))));
 const common=[...dates[0]].filter(d=>dates.every(s=>s.has(d))).sort();
 if(common.length<5)return {candidateCount:0,scoredCount:0,missingCount:0,recommendations:[],all:[]};
 const starts=common.filter(start=>[1,2,3].every(offset=>dates.every(s=>s.has(addDays(start,offset)))));
 const all=starts.map(tripStart=>scoreFiveDayItinerary({tripStart,courses,teeHour}));
 const scored=all.filter(x=>x.status==="scored").sort((a,b)=>a.itineraryRisk-b.itineraryRisk||a.tripStart.localeCompare(b.tripStart));
 const selected=[];
 for(const item of scored){
  const gapOk=selected.every(x=>Math.abs((Date.parse(item.tripStart+"T00:00:00Z")-Date.parse(x.tripStart+"T00:00:00Z"))/DAY_MS)>=minStartGap);
  if(gapOk){selected.push(item);if(selected.length===limit)break;}
 }
 const ranked=selected.map((x,i)=>({...x,recommendationRank:i+1,confidence:"medium",confidenceLabel:"中等（未校準）",confidenceNote:"使用16天逐時預報；沖繩歷史回測尚未完成"}));
 return {candidateCount:starts.length,scoredCount:scored.length,missingCount:all.length-scored.length,recommendations:ranked,all};
}
