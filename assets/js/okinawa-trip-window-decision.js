import {recommendLongRangeWindows} from "./long-range-engine.js";
import {buildSeasonalDirectionStability} from "./okinawa-seasonal-direction-stability.js";
const REGIONS=["north","central","south"];
const REGION_LABELS={north:"北部",central:"中部",south:"南部"};
const addDays=(date,n)=>new Date(Date.parse(date+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
const finite=v=>typeof v==="number"&&Number.isFinite(v);
function latestMonthlyContext(records,region,date){
 return [...records].filter(x=>x.region===region&&x.targetMonth===date.slice(0,7)).sort((a,b)=>String(a.forecastVintage).localeCompare(String(b.forecastVintage))).at(-1)??null;
}
function enrichWindow(window,{stability,monthlyContext,courses}){
 const rounds=window.rounds.map(round=>{
  if(round.status!=="scored")return round;
  const daysFromLead=round.date;
  const regional=round.regional.map(zone=>{
   const scale=zone.signal.efi!==undefined?"weekly":"monthly";
   const stable=stability.records.find(x=>x.region===zone.zone&&x.scale===scale&&x.targetTimeLabel===zone.signal.period&&x.field==="precipitation_anomaly");
   const era5=latestMonthlyContext(monthlyContext,zone.zone,round.date);
   const options=courses.filter(c=>c.region===REGION_LABELS[zone.zone]).map(c=>({courseId:c.id,name:c.name,area:c.area,regionalProxyOnly:true}));
   return {...zone,scale,stability:stable?{status:stable.stabilityStatus,validSnapshots:stable.validValueCount,directionChanges:stable.directionChanges,descriptiveConsistencyRatio:stable.directionConsistencyRatio}: {status:"NO_MATCHING_ARCHIVED_VINTAGE",validSnapshots:0,directionChanges:null,descriptiveConsistencyRatio:null},historicalMonthlyContext:era5?{era5SampleYears:era5.era5Context?.sampleYears??0,p10Mm:era5.era5Context?.p10Mm??null,medianMm:era5.era5Context?.medianMm??null,p90Mm:era5.era5Context?.p90Mm??null,modelAnomalyMm:era5.modelAnomalyMm??null,modelSignal:era5.modelSignal?.code??"UNKNOWN"}:{status:"NO_MONTHLY_CONTEXT"},courseOptions:options};
  });
  const courseChoices=regional.flatMap(x=>x.courseOptions.map(c=>({...c,regionalTendencyRank:x.signal.rank,regionalTendency:x.signal.label,region:x.zone}))).sort((a,b)=>a.regionalTendencyRank-b.regionalTendencyRank||a.courseId.localeCompare(b.courseId));
  return {...round,regional,courseChoices,courseSelectionRule:"Regional trend is a coarse proxy shared by courses in that region; it is not a course-level forecast. Select actual courses only after reviewing current course-level forecasts and tee-time availability."};
 });
 return {...window,rounds,tripFormat:"5天4夜",golfDays:"Day 2–4 (3 rounds)",travelDays:{arrival:window.tripStart,departure:window.tripEnd},rankingBasis:"三個打球日最不利區域的 EC46/SEAS5 ordinal tendency tier; ERA5 and revision stability are displayed separately and do not change the tier.",historicalAndStabilityAreContextOnly:true};
}
export function buildOkinawaTripWindowDecision({referenceDate,seasonalPoints,snapshots=[],monthlyContext=[],courses=[],limit=3,minStartGap=5}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)||!Array.isArray(seasonalPoints)||seasonalPoints.length!==3)throw new TypeError("referenceDate and three Okinawa regional seasonal points are required");
 const base=recommendLongRangeWindows({referenceDate,points:seasonalPoints,limit,minStartGap,horizonDays:90});
 const stability=buildSeasonalDirectionStability(snapshots);
 const recommendations=base.recommendations.map(x=>enrichWindow(x,{stability,monthlyContext,courses}));
 const all=base.all.map(x=>x.status==="scored"?enrichWindow(x,{stability,monthlyContext,courses}):x);
 return {schemaVersion:1,archiveType:"okinawa-five-day-three-round-trip-decision",generatedAt:new Date().toISOString(),referenceDate,scope:"Okinawa Main Island six-course pilot",trip:{durationDays:5,nights:4,golfRoundCount:3,golfDays:[2,3,4],arrivalDay:1,departureDay:5},horizon:{start:addDays(referenceDate,17),end:addDays(referenceDate,90),candidateStartDates:base.candidateCount},coverage:{scoredWindows:base.scoredCount,insufficientWindows:base.missingCount},recommendationCount:recommendations.length,recommendations,ranking:{primary:"existing 0-3 ordinal seasonal tendency tier; lower is drier",tieBreak:"earlier start date",historicalEra5:"context only; not numerically merged with ECMWF",revisionStability:"context only; not treated as calibrated confidence",shortRangeHourly:"not mixed into long-range ordinal tier"},allWindows:all,guardrails:["Each five-day trip has arrival Day 1, golf Days 2-4, departure Day 5.","D17-D46 golf dates use weekly EC46 EFI; D47-D90 golf dates use monthly SEAS5 anomaly ratio under the existing long-range engine rules.","The worst regional signal is retained for each golf date; dry regional averages do not hide a wetter region.","ERA5 P10/median/P90 are displayed as a separate historical monthly reference, not merged with ECMWF model climatology.","Revision stability is descriptive only; fewer than three valid snapshots remains insufficient.","The six courses are listed as regional options; all courses in one region share the same coarse regional signal. No course-level long-range forecast is claimed.","The long-range 0-3 tendency tier is ordinal, not rain probability, daily rainfall, cancellation probability, or calibrated risk.","Short-range 0-100 six-hour playability score is not mixed with the long-range ordinal tier.","Missing regional seasonal signals make a window unscored; no zero-fill or synthetic data."]};
}
