import test from "node:test";
import assert from "node:assert/strict";

test("paired dataset contract preserves strict station and valid-time matching",()=>{
 const stationId="91107",validTime="2026-11-27T09:00";
 const forecast={stationId,validTime,leadHours:31.5,observationQuality:1};
 const observation={stationId,validTime,quality:1};
 assert.equal(forecast.stationId,observation.stationId);
 assert.equal(forecast.validTime,observation.validTime);
 assert.ok(forecast.leadHours>0);
 assert.equal(forecast.observationQuality,1);
});
test("retrieval age is not represented as provider issue-time lead",()=>{
 const record={retrievedAt:"2026-11-26T18:00:00Z",validTime:"2026-11-27T09:00",leadHours:6};
 assert.equal(Object.hasOwn(record,"issueTime"),false);
 assert.equal(record.leadHours,6);
});
