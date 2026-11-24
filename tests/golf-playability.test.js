import test from "node:test";
import assert from "node:assert/strict";
import {buildGolfPlayabilityReport} from "../scripts/lib/golf-playability.mjs";

const makeRow=(time,temp,rain=0)=>({time,temperatureC:temp,relativeHumidityPct:70,precipitationProbabilityPct:20,precipitationMm:rain,windSpeedMs:3,windGustMs:5,shortwaveRadiationWm2:500,uvIndex:5});
function course({coordinateStatus="verified",missingForecaHour=null}={}){
 const hours=Array.from({length:7},(_,i)=>10+i);
 const open=hours.map(h=>makeRow("2026-11-25T"+String(h).padStart(2,"0")+":00",28+h/10,0.1));
 const vc=hours.map(h=>makeRow("2026-11-25T"+String(h).padStart(2,"0")+":00:00",28+h/10,0.2));
 const foreca=hours.filter(h=>h!==missingForecaHour).map(h=>makeRow("2026-11-25T"+String(h).padStart(2,"0")+":00+09:00",28+h/10,0.3));
 return {id:"course",name:"Test Course",coordinateStatus,providers:{
  openMeteo:{status:"available",data:{hourly:open}},
  visualCrossing:{status:"available",data:{days:[{hours:vc}]}},
  foreca:{status:"available",data:{hourly:{forecast:foreca}}}
 }};
}

test("six-hour 10:00–16:00 window includes seven hourly endpoints and only common complete days",()=>{
 const report=buildGolfPlayabilityReport([course()]);
 assert.equal(report.window.elapsedHours,6);
 assert.equal(report.window.requiredHourlyEndpoints,7);
 const day=report.courses[0].daily[0];
 assert.equal(day.date,"2026-11-25");
 for(const provider of ["openMeteo","visualCrossing","foreca"]){
  assert.equal(day.providers[provider].complete,true);
  assert.equal(day.providers[provider].availableHourlyPoints,7);
  assert.equal(day.providers[provider].hourly[0].time,"2026-11-25T10:00");
  assert.equal(day.providers[provider].hourly[6].time,"2026-11-25T16:00");
 }
});

test("a day missing any provider endpoint is excluded from common comparison",()=>{
 const report=buildGolfPlayabilityReport([course({missingForecaHour:13})]);
 assert.equal(report.courses[0].commonCompleteDays,0);
 assert.equal(report.courses[0].daily.length,0);
});

test("provisional course-vicinity coordinates are eligible for preliminary screening without a calibrated composite score",()=>{
 const report=buildGolfPlayabilityReport([course({coordinateStatus:"provisional"})]);
 const item=report.courses[0];
 assert.equal(item.operationalRankingEligible,true);
 assert.equal(item.rankingStatus,"descriptive-only-no-calibrated-score");
 assert.equal("score" in item,false);
 assert.equal(report.rankingPolicy.includes("Coordinate confidence remains separate"),true);
});

test("precipitation and exposure indicators remain separate metrics",()=>{
 const report=buildGolfPlayabilityReport([course()]);
 const window=report.courses[0].daily[0].providers.openMeteo;
 assert.equal(window.totalReportedPrecipitationMm,0.7);
 assert.equal(window.precipitationProbabilityPct.max,20);
 assert.equal(window.maxWindGustMs,5);
 assert.equal(window.openMeteoSolarRadiationWm2.max,500);
 assert.equal(window.openMeteoUvIndex.max,5);
});


test("two complete providers qualify a date for preliminary playability while three-provider comparison stays separate",()=>{
 const c=course({missingForecaHour:13});
 c.providers.foreca.status="unavailable";
 c.providers.foreca.data=null;
 const report=buildGolfPlayabilityReport([c]);
 const item=report.courses[0];
 assert.equal(item.eligibleDaysAtLeastTwoProviders,1);
 assert.equal(item.commonCompleteDays,0);
 assert.equal(item.daily.length,1);
 assert.deepEqual(item.daily[0].completeProviders,["openMeteo","visualCrossing"]);
 assert.equal(item.daily[0].providers.foreca.complete,false);
});

test("one complete provider is insufficient for multi-provider playability",()=>{
 const c=course();
 c.providers.visualCrossing.status="unavailable";
 c.providers.visualCrossing.data=null;
 c.providers.foreca.status="unavailable";
 c.providers.foreca.data=null;
 const report=buildGolfPlayabilityReport([c]);
 assert.equal(report.courses[0].eligibleDaysAtLeastTwoProviders,0);
 assert.equal(report.courses[0].daily.length,0);
});
