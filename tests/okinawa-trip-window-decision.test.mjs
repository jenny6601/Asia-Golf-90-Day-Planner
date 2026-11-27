import test from "node:test";
import assert from "node:assert/strict";
import {buildOkinawaTripWindowDecision} from "../assets/js/okinawa-trip-window-decision.js";
const points=(efi=0,anomaly=0)=>["north","central","south"].map(id=>({point:{id,label:id},weekly:{time:["2026-12-10"],precipitation_efi:[efi],precipitation_anomaly:[anomaly]},monthly:{time:["2027-01-01","2027-02-01","2027-03-01"],precipitation_mean:[100,100,100],precipitation_anomaly:[anomaly,anomaly,anomaly]}}));
const courses=[{id:"southern-links",name:"Southern Links",area:"南部",region:"南部"},{id:"palm-hills",name:"Palm Hills",area:"南部",region:"南部"},{id:"pgm-okinawa",name:"PGM",area:"中部",region:"中部"},{id:"kise",name:"Kise",area:"北部",region:"北部"},{id:"atta-terrace",name:"Atta",area:"北部",region:"北部"},{id:"chura-orchard",name:"Chura Orchard",area:"北部",region:"北部"}];
test("builds five-day four-night windows with golf on days 2-4",()=>{
 const r=buildOkinawaTripWindowDecision({referenceDate:"2026-11-23",seasonalPoints:points(-.7,-30),courses});
 assert.equal(r.trip.durationDays,5);assert.equal(r.trip.nights,4);assert.equal(r.trip.golfRoundCount,3);
 const w=r.recommendations[0];assert.equal(w.golfDates.length,3);assert.equal(w.tripEnd,new Date(Date.parse(w.tripStart+"T00:00:00Z")+4*86400000).toISOString().slice(0,10));
 assert.equal(w.rounds[0].date,new Date(Date.parse(w.tripStart+"T00:00:00Z")+86400000).toISOString().slice(0,10));
});
test("retains six course options without claiming course-level seasonal forecasts",()=>{
 const r=buildOkinawaTripWindowDecision({referenceDate:"2026-11-23",seasonalPoints:points(),courses});
 const w=r.recommendations[0];assert.equal(w.rounds[0].courseChoices.length,6);assert.ok(w.rounds[0].courseChoices.every(x=>x.regionalProxyOnly));
});
test("ERA5 and stability context are separate from ordinal ranking",()=>{
 const monthly=[{region:"north",targetMonth:"2027-01",forecastVintage:"2026-11-27",era5Context:{sampleYears:10,p10Mm:20,medianMm:60,p90Mm:150},modelAnomalyMm:5,modelSignal:{code:"WETTER_THAN_MODEL_CLIMATE"}}];
 const r=buildOkinawaTripWindowDecision({referenceDate:"2026-11-23",seasonalPoints:points(),monthlyContext:monthly,courses});
 const round=r.recommendations.find(x=>x.golfDates.some(d=>d.startsWith("2027-01")))?.rounds.find(x=>x.date.startsWith("2027-01"));
 if(round){const north=round.regional.find(x=>x.zone==="north");assert.equal(north.historicalMonthlyContext.medianMm,60);}
 assert.equal(r.ranking.historicalEra5,"context only; not numerically merged with ECMWF");
 assert.equal(r.ranking.revisionStability,"context only; not treated as calibrated confidence");
});
test("missing regional seasonal signal fails closed",()=>{
 const p=points();p[2].weekly.precipitation_efi=[];
 const r=buildOkinawaTripWindowDecision({referenceDate:"2026-11-23",seasonalPoints:p,courses});
 assert.ok(r.coverage.insufficientWindows>0);
});
test("long-range output never emits probabilities or a combined short-range score",()=>{
 const r=buildOkinawaTripWindowDecision({referenceDate:"2026-11-23",seasonalPoints:points(),courses});
 assert.equal(r.ranking.shortRangeHourly,"not mixed into long-range ordinal tier");
 assert.ok(r.guardrails.some(x=>x.includes("不是雨概率")||x.includes("不是逐日降雨預報")));
});
