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

import {scoreTripWindowRankingSamples} from "../assets/js/trip-date-ranking-verification.js";
test("trip-window ranking reports positive Spearman for correctly ordered risk",()=>{
 const rows=Array.from({length:40},(_,i)=>({model:"baseline",predictedScore:i,observedGolfRainMm:i*0.5}));
 const result=scoreTripWindowRankingSamples(rows);
 assert.equal(result.groups.baseline.spearman,1);
 assert.equal(result.groups.baseline.ready,true);
});
test("trip-window ranking rejects invalid scores and requires sample gate",()=>{
 assert.throws(()=>scoreTripWindowRankingSamples([{model:"x",predictedScore:120,observedGolfRainMm:2}]),/predictedScore/);
 const result=scoreTripWindowRankingSamples([{model:"x",predictedScore:10,observedGolfRainMm:0},{model:"x",predictedScore:20,observedGolfRainMm:1}]);
 assert.equal(result.groups.x.ready,false);
});

import {compareCandidateRankingSamples,compareTripWindowModels} from "../assets/js/trip-date-ranking-verification.js";
test("paired daily comparison uses identical outcomes and reports candidate AUC delta",()=>{
 const samples=[];
 for(let i=0;i<40;i++){
  const wet=i>=20,observedRainMm=wet?2:0,issueDate="2026-01-01",targetDate=new Date(Date.parse("2026-01-01T00:00:00Z")+(i+1)*86400000).toISOString().slice(0,10);
  samples.push({source:"composite-baseline",issueDate,targetDate,region:"north",leadDays:10,riskScore:wet?80:20,observedRainMm});
  samples.push({source:"composite-historyEnhanced",issueDate,targetDate,region:"north",leadDays:10,riskScore:wet?90:10,observedRainMm});
 }
 const r=compareCandidateRankingSamples(samples);
 assert.equal(r.groups["composite-historyEnhanced.overall"].matchedSamples,40);
 assert.equal(r.groups["composite-historyEnhanced.overall"].deltaAuc,0);
 assert.equal(r.groups["composite-historyEnhanced.overall"].ready,true);
});
test("paired daily comparison does not compare mismatched target outcomes",()=>{
 const r=compareCandidateRankingSamples([
  {source:"composite-baseline",issueDate:"a",targetDate:"b",region:"north",leadDays:2,riskScore:20,observedRainMm:0},
  {source:"composite-x",issueDate:"different",targetDate:"b",region:"north",leadDays:2,riskScore:90,observedRainMm:5}
 ]);
 assert.equal(r.groups["composite-x.overall"].matchedSamples,0);
});
test("paired trip window comparison compares only matching windows",()=>{
 const rows=[];
 for(let i=0;i<40;i++){
  const issueDate="2026-01-01",startDate=new Date(Date.parse("2026-01-01T00:00:00Z")+i*86400000).toISOString().slice(0,10);
  const observedGolfRainMm=i;
  rows.push({model:"baseline",issueDate,startDate,endDate:startDate,predictedScore:i,observedGolfRainMm});
  rows.push({model:"history",issueDate,startDate,endDate:startDate,predictedScore:i,observedGolfRainMm});
 }
 const r=compareTripWindowModels(rows);
 assert.equal(r.groups.history.matchedWindows,40);
 assert.equal(r.groups.history.deltaSpearman,0);
 assert.equal(r.groups.history.ready,true);
});

import {buildVerificationMaturity} from "../assets/js/trip-date-ranking-verification.js";
test("maturity gate counts unique outcome dates, not repeated issue dates",()=>{
 const rows=[];
 for(let issue=0;issue<35;issue++){
  const targetDate=new Date(Date.parse("2026-01-01T00:00:00Z")+(issue%10)*86400000).toISOString().slice(0,10);
  rows.push({source:"composite-baseline",region:"north",leadDays:10,targetDate,observedRainMm:issue%2?2:0});
 }
 const result=buildVerificationMaturity(rows,[],30);
 const gate=result.daily.groups["composite-baseline.north.1-16"];
 assert.equal(gate.forecastSamples,35);
 assert.equal(gate.uniqueValidDates,10);
 assert.equal(gate.ready,false);
});
test("maturity gate requires 30 unique dates plus five wet and five dry",()=>{
 const rows=Array.from({length:30},(_,i)=>({source:"composite-baseline",region:"south",leadDays:55,
  targetDate:new Date(Date.parse("2026-01-01T00:00:00Z")+i*86400000).toISOString().slice(0,10),
  observedRainMm:i<5?2:i<10?0:3}));
 const result=buildVerificationMaturity(rows,[],30);
 assert.equal(result.daily.groups["composite-baseline.south.47-90"].uniqueValidDates,30);
 assert.equal(result.daily.groups["composite-baseline.south.47-90"].ready,true);
});
test("trip maturity counts unique issue-date windows and wet/dry windows",()=>{
 const rows=Array.from({length:30},(_,i)=>({model:"baseline",issueDate:"2026-01-"+String(i+1).padStart(2,"0"),
  startDate:"2026-02-01",endDate:"2026-02-05",observedGolfRainMm:i<5?0:i<10?2:0.2}));
 const result=buildVerificationMaturity([],rows,30);
 assert.equal(result.tripWindows.groups.baseline.uniqueMaturedWindows,30);
 assert.equal(result.tripWindows.groups.baseline.ready,true);
});

test("maturity report retains all expected model buckets before observations mature",()=>{
 const result=buildVerificationMaturity([],[],30,
  ["composite-baseline","composite-historyEnhanced","composite-longRangeEnhanced"],
  ["baseline","historyEnhanced","longRangeEnhanced"]);
 assert.equal(result.daily.requiredGroups,27);
 assert.equal(result.daily.readyGroups,0);
 assert.equal(result.tripWindows.requiredModels,3);
 assert.equal(result.tripWindows.readyModels,0);
 assert.equal(result.daily.groups["composite-baseline.north.1-16"].uniqueValidDates,0);
});

import {evaluateRecommendationQuality} from "../assets/js/trip-date-recommendation-quality.js";
test("recommendation quality compares top-three non-overlapping portfolios with historical and random controls",()=>{
 const rows=[];
 for(let i=0;i<9;i++){
  const startDate=new Date(Date.parse("2026-01-01T00:00:00Z")+i*5*86400000).toISOString().slice(0,10);
  const rain=i<3?0:i<6?2:5;
  const common={issueDate:"2025-12-01",startDate,endDate:new Date(Date.parse(startDate+"T00:00:00Z")+4*86400000).toISOString().slice(0,10),
   historicalScore:8-i,predictedScore:i,observedGolfRainMm:rain,observedWetRegionDays:rain===0?0:rain===2?5:9,observedRegionDays:9};
  rows.push({...common,model:"baseline"});
  rows.push({...common,model:"historyEnhanced"});
 }
 const result=evaluateRecommendationQuality(rows,200);
 assert.equal(result.issueDatesWithThreeMaturedWindows,1);
 assert.equal(result.candidates.historyEnhanced.portfolioCount,1);
 assert.equal(result.historicalClimatology.portfolioCount,1);
 assert.equal(result.randomControl.portfolioCount,200);
 assert.equal(result.candidates.historyEnhanced.meanRainMmPerRegionDay,0);
 assert.equal(result.candidates.historyEnhanced.meanRainDeltaVsHistorical,-5);
 assert.equal(result.candidates.historyEnhanced.ready,false);
});
test("recommendation quality excludes incomplete observed windows and is deterministic",()=>{
 const rows=[];
 for(let i=0;i<4;i++){
  const startDate=new Date(Date.parse("2026-01-01T00:00:00Z")+i*5*86400000).toISOString().slice(0,10);
  rows.push({issueDate:"2025-12-01",model:"baseline",startDate,endDate:startDate,
   historicalScore:i,predictedScore:i,observedGolfRainMm:i,observedWetRegionDays:0,observedRegionDays:8});
 }
 const a=evaluateRecommendationQuality(rows,100),b=evaluateRecommendationQuality(rows,100);
 assert.equal(a.issueDatesWithThreeMaturedWindows,0);
 assert.equal(a.randomControl.portfolioCount,0);
 assert.deepEqual(a,b);
});
