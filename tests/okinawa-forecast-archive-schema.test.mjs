import test from "node:test";
import assert from "node:assert/strict";
import {HOURLY_FIELDS,DAILY_FIELDS,buildFieldCoverage,missingCoverageFields,validateArchiveRecords} from "../scripts/okinawa-forecast-archive-schema.mjs";
const ids=["southern-links","palm-hills","pgm-okinawa","atta-terrace","chura-orchard","kise"];
function record(id){
 const hourly={time:Array.from({length:384},(_,i)=>String(i))},daily={time:Array.from({length:16},(_,i)=>String(i))};
 for(const field of HOURLY_FIELDS)hourly[field]=Array(384).fill(1);
 for(const field of DAILY_FIELDS)daily[field]=Array(16).fill(1);
 const hourlyCoverage=buildFieldCoverage(hourly,HOURLY_FIELDS,384),dailyCoverage=buildFieldCoverage(daily,DAILY_FIELDS,16);
 return {course:{id},hourlyCoverage,dailyCoverage};
}
test("accepts exactly the six unique Okinawa pilot courses in configured order",()=>{
 const rows=ids.map(record),quality=validateArchiveRecords(rows,ids);
 assert.equal(quality.recordsPass,true);assert.equal(quality.courseIdsPass,true);
});
test("rejects duplicate or missing course IDs",()=>{
 const rows=ids.map(record);rows[5]=record(ids[4]);
 assert.equal(validateArchiveRecords(rows,ids).courseCountPass,false);
 assert.equal(validateArchiveRecords(rows,ids).recordsPass,false);
});
test("missing numeric values stay missing and fail coverage",()=>{
 const hourly={temperature_2m:[1,null,NaN,2]};
 const coverage=buildFieldCoverage(hourly,["temperature_2m"],4);
 assert.deepEqual(coverage.temperature_2m,{valid:2,expected:4});
});
test("rejects absent required fields and incomplete daily arrays",()=>{
 const row=record(ids[0]);row.dailyCoverage.precipitation_sum.valid=15;
 assert.ok(missingCoverageFields(row.hourlyCoverage,row.dailyCoverage).includes("precipitation_sum"));
});
test("rejects empty time axes even when both counts are zero",()=>{
 const h=buildFieldCoverage({},["temperature_2m"],0),d=buildFieldCoverage({},["weather_code"],0);
 assert.ok(missingCoverageFields(h,d).includes("temperature_2m"));
});
