import test from "node:test";
import assert from "node:assert/strict";
import {recommendGolfTripDates,TRIP_DATE_ENGINE_CONFIG} from "../assets/js/trip-date-recommendation-engine.js";
import {TRIP_DATE_CANDIDATE_MODELS} from "../assets/js/trip-date-candidate-models.js";

const asOf="2026-11-27";
const days=Array.from({length:10},(_,i)=>{
 const date=new Date(Date.parse(asOf+"T00:00:00Z")+(i+1)*86400000).toISOString().slice(0,10);
 const score=20+i*5;
 const signal=riskScore=>({riskScore,coverage:1});
 return {date,regions:{
  north:{forecast:signal(score),historical:signal(40),stability:signal(10)},
  central:{forecast:signal(score+2),historical:signal(42),stability:signal(10)},
  south:{forecast:signal(score+4),historical:signal(44),stability:signal(10)}
 }};
});
test("candidate models expose complete, normalized weights for every horizon",()=>{
 for(const [id,model] of Object.entries(TRIP_DATE_CANDIDATE_MODELS)){
  assert.ok(model.label,id);
  for(const horizon of ["short","ec46","seas5"]){
   const weights=model.sourceWeights[horizon];
   assert.ok(weights,id+" "+horizon);
   assert.ok(Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-1)<1e-9,id+" "+horizon);
  }
 }
});
test("shadow candidate weights are accepted without changing production defaults",()=>{
 const before=TRIP_DATE_ENGINE_CONFIG.sourceWeights;
 for(const model of Object.values(TRIP_DATE_CANDIDATE_MODELS)){
  const result=recommendGolfTripDates({asOf,horizonDays:10,days},{horizonDays:10,sourceWeights:model.sourceWeights,includeAllWindows:true});
  assert.equal(result.allWindows.length,6);
  assert.deepEqual(result.scoring.horizonWeights,model.sourceWeights);
 }
 assert.deepEqual(TRIP_DATE_ENGINE_CONFIG.sourceWeights,before);
});
test("invalid candidate weights are rejected",()=>{
 const bad={short:{forecast:.5,historical:.5,stability:.5},ec46:TRIP_DATE_ENGINE_CONFIG.sourceWeights.ec46,seas5:TRIP_DATE_ENGINE_CONFIG.sourceWeights.seas5};
 assert.throws(()=>recommendGolfTripDates({asOf,horizonDays:10,days},{sourceWeights:bad}),/Invalid sourceWeights/);
});
