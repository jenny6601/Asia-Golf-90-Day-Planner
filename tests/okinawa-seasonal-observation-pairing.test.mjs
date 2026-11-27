import test from "node:test";
import assert from "node:assert/strict";
import {stationPeriodTotal,regionalPeriodTotal} from "../scripts/okinawa-seasonal-observation-pairing.js";
test("weekly station total requires 90 percent hourly coverage",()=>{
 const rows=Array.from({length:168},(_,i)=>({time:new Date(Date.parse("2026-12-01T00:00:00Z")+i*3600000).toISOString().slice(0,16),value:1,usable:true}));
 assert.equal(stationPeriodTotal(rows,"2026-12-01","2026-12-07").rainTotalMm,168);
 assert.equal(stationPeriodTotal(rows.slice(0,100),"2026-12-01","2026-12-07").complete,false);
});
test("regional total requires at least two eligible stations",()=>{
 assert.equal(regionalPeriodTotal([{complete:true,rainTotalMm:10}]).complete,false);
 const result=regionalPeriodTotal([{complete:true,rainTotalMm:10},{complete:true,rainTotalMm:20}]);
 assert.equal(result.complete,true);assert.equal(result.observedRegionalMeanTotalMm,15);
});
