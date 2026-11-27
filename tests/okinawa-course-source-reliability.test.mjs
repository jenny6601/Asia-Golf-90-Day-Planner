import test from "node:test";
import assert from "node:assert/strict";
import {haversineKm,stationWeights,sampleEligibility} from "../scripts/okinawa-course-source-reliability.js";
test("haversine distance returns zero for identical coordinates",()=>assert.equal(haversineKm({latitude:26,longitude:127},{latitude:26,longitude:127}),0));
test("inverse-square station weights normalize to one",()=>{
 const result=stationWeights([{stationId:"near",distanceKm:5},{stationId:"far",distanceKm:10}]);
 assert.ok(Math.abs(result.reduce((s,x)=>s+x.weight,0)-1)<1e-12);
 assert.ok(result[0].weight>result[1].weight);
});
test("station proxy beyond 15 km is flagged weak",()=>assert.equal(stationWeights([{distanceKm:15.1}])[0].representativeness,"WEAK_OVER_15KM"));
test("course evidence gate requires 200 pairs, 30 days and rain samples",()=>{
 assert.equal(sampleEligibility({n:199,uniqueValidDays:30,wetObserved:10},"precipitation"),false);
 assert.equal(sampleEligibility({n:200,uniqueValidDays:29,wetObserved:10},"precipitation"),false);
 assert.equal(sampleEligibility({n:200,uniqueValidDays:30,wetObserved:9},"precipitation"),false);
 assert.equal(sampleEligibility({n:200,uniqueValidDays:30,wetObserved:10},"precipitation"),true);
 assert.equal(sampleEligibility({n:200,uniqueValidDays:30},"temperature"),true);
});
