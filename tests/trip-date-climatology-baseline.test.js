import test from "node:test";
import assert from "node:assert/strict";
import {buildDailyClimatology,compareForecastToClimatology} from "../assets/js/trip-date-climatology-baseline.js";

test("builds calendar-day wet frequency and mean rainfall from valid baseline rows",()=>{
 const c=buildDailyClimatology([
  {date:"1991-06-01",rainMm:0},{date:"1992-06-01",rainMm:2},
  {date:"1993-06-01",rainMm:4},{date:"bad",rainMm:99},{date:"1994-06-01",rainMm:-1}
 ]);
 assert.equal(c["06-01"].sampleCount,3);
 assert.equal(c["06-01"].wetDayFrequency,2/3);
 assert.equal(c["06-01"].meanRainMm,2);
});
test("compares forecast and climatology on identical samples",()=>{
 const rows=[{region:"north",targetDate:"2026-06-01",leadDays:2,probability:90,forecastRainMm:3,observedRainMm:2}];
 const c={north:{"06-01":{sampleCount:30,wetDayFrequency:.2,meanRainMm:1}}};
 const r=compareForecastToClimatology(rows,c);
 assert.equal(r.overall.sampleCount,1);
 assert.equal(r.overall.forecastBrier,.01);
 assert.equal(r.overall.climatologyBrier,.64);
 assert.equal(r.overall.brierSkillScore,.9844);
 assert.equal(r.overall.forecastAmountMaeMm,1);
 assert.equal(r.overall.climatologyAmountMaeMm,1);
});
test("excludes missing climatology without imputing",()=>{
 const r=compareForecastToClimatology([{region:"south",targetDate:"2026-02-01",leadDays:8,probability:50,forecastRainMm:1,observedRainMm:0}],{});
 assert.equal(r.overall.sampleCount,0);
 assert.equal(r.excluded.missingClimatology,1);
});
