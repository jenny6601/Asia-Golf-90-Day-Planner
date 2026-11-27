import test from "node:test";
import assert from "node:assert/strict";
import {scoreRiskRankingSamples} from "../assets/js/trip-date-ranking-verification.js";
test("perfect ranking produces AUC 1",()=>{
 const r=scoreRiskRankingSamples([
 {region:"north",source:"historical",leadDays:20,riskScore:10,observedRainMm:0},
 {region:"north",source:"historical",leadDays:21,riskScore:20,observedRainMm:.2},
 {region:"north",source:"historical",leadDays:22,riskScore:80,observedRainMm:4},
 {region:"north",source:"historical",leadDays:23,riskScore:90,observedRainMm:12}]);
 assert.equal(r.groups["historical.north"].auc,1);
});
test("ties receive half credit and null scores are excluded",()=>{
 const r=scoreRiskRankingSamples([
 {region:"central",source:"seas5",leadDays:50,riskScore:50,observedRainMm:0},
 {region:"central",source:"seas5",leadDays:51,riskScore:50,observedRainMm:3},
 {region:"central",source:"seas5",leadDays:52,riskScore:null,observedRainMm:8}]);
 assert.equal(r.groups["seas5.central"].auc,.5);
 assert.equal(r.groups["seas5.central"].sampleCount,2);
});
test("lead buckets and minimum sample gate are explicit",()=>{
 const rows=Array.from({length:40},(_,i)=>({region:"south",source:"composite",leadDays:47+i%40,riskScore:i,observedRainMm:i%2?2:0}));
 const r=scoreRiskRankingSamples(rows);
 assert.equal(r.groups["composite.south.47-90"].sampleCount,40);
 assert.equal(r.groups["composite.south.47-90"].ready,true);
});
test("invalid lead or region is rejected",()=>{
 assert.throws(()=>scoreRiskRankingSamples([{region:"east",source:"x",leadDays:1}]),/region/);
 assert.throws(()=>scoreRiskRankingSamples([{region:"north",source:"x",leadDays:91}]),/leadDays/);
});
