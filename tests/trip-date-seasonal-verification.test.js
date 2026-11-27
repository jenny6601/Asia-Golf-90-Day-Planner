import test from "node:test";
import assert from "node:assert/strict";
import {buildSeasonalVerificationTargets,scoreSeasonalVerification} from "../assets/js/trip-date-seasonal-verification.js";

test("builds only completed unit-verified weekly and monthly periods",()=>{
 const snapshots=[{localDate:"2026-09-01",seasonal:{
  north:{weeklyUnits:{precipitation_mean:"mm"},monthlyUnits:{precipitation_mean:"mm"},
   weekly:{time:["2026-09-08","2026-11-24"],precipitation_mean:[14,20]},
   monthly:{time:["2026-10-01","2026-11-01"],precipitation_mean:[40,60]}},
  central:{weeklyUnits:{precipitation_mean:"inch"},weekly:{time:["2026-09-08"],precipitation_mean:[1]}}
 }}];
 const targets=buildSeasonalVerificationTargets(snapshots,"2026-11-27");
 assert.equal(targets.length,2);
 assert.deepEqual(targets.map(x=>x.source).sort(),["EC46","SEAS5"]);
});
test("scores only complete ERA5 daily periods and computes amount errors",()=>{
 const target={source:"EC46",region:"north",issueDate:"2026-09-01",periodStart:"2026-09-08",periodEnd:"2026-09-14",periodDays:7,forecastMm:14};
 const observations={north:Object.fromEntries(Array.from({length:7},(_,i)=>["2026-09-"+String(8+i).padStart(2,"0"),2]))};
 const result=scoreSeasonalVerification([target],observations);
 assert.equal(result.bySource.EC46.sampleCount,1);
 assert.equal(result.bySource.EC46.maeMm,0);
 assert.equal(result.bySource.EC46.meanBiasMm,0);
 assert.equal(result.bySource.EC46.wetDry.hits,1);
});
test("excludes incomplete observed periods instead of imputing",()=>{
 const target={source:"SEAS5",region:"south",issueDate:"2026-08-01",periodStart:"2026-09-01",periodEnd:"2026-09-30",periodDays:30,forecastMm:100};
 const observations={south:{"2026-09-01":4,"2026-09-02":3}};
 const result=scoreSeasonalVerification([target],observations);
 assert.equal(result.bySource.SEAS5.sampleCount,0);
 assert.equal(result.excluded.incompleteObservedPeriods,1);
});
