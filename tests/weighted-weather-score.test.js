import test from "node:test";
import assert from "node:assert/strict";
import {scoreMultiProviderGolfWindow} from "../assets/js/weighted-weather-score.js";
const hours=(p,r,g,t)=>Array.from({length:6},()=>({prob:p,rain:r,wind:g-1,gust:g,temp:t,feels:t}));
test("applies 65/15/20 weights and median across two valid providers",()=>{
 const result=scoreMultiProviderGolfWindow({openMeteo:{status:"available",sourceHours:hours(10,0,3,24)},visualCrossing:{status:"available",sourceHours:hours(90,3,12,34)},foreca:{status:"unavailable"}});
 assert.equal(result.status,"scored");assert.equal(result.providerCount,2);
 assert.deepEqual(result.weights,{rainfall:.65,wind:.15,temperature:.20});
 assert.ok(result.weightedRisk>0);assert.equal(result.calibration,"provisional-not-hindcast-validated");
});
test("does not score with fewer than two complete providers",()=>{
 const result=scoreMultiProviderGolfWindow({openMeteo:{status:"available",sourceHours:hours(10,0,3,24)},visualCrossing:{status:"unavailable"},foreca:{status:"unavailable"}});
 assert.equal(result.status,"insufficient-provider-coverage");assert.equal(result.consensus,null);
});
test("missing component data is not replaced with zero risk",()=>{
 const bad=hours(10,0,3,24);bad[0].feels=null;bad[0].temp=null;
 const result=scoreMultiProviderGolfWindow({openMeteo:{status:"available",sourceHours:bad},visualCrossing:{status:"unavailable"}});
 assert.equal(result.status,"insufficient-provider-coverage");
});
