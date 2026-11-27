import test from "node:test";
import assert from "node:assert/strict";
import {buildSeasonalRevisionHistory} from "../scripts/okinawa-seasonal-revision-history.js";
const snapshot=(date,mean,anomaly,efi=0)=>({archiveType:"okinawa-ecmwf-seasonal-snapshot",archiveDate:date,retrievedAt:date+"T02:00:00Z",model:"ecmwf_seasonal_seamless",points:["north","central","south"].map(id=>({point:{id},weeklyUnits:{precipitation_mean:"mm",precipitation_anomaly:"mm"},monthlyUnits:{precipitation_mean:"mm",precipitation_anomaly:"mm"},weekly:{time:["2026-12-01"],precipitation_mean:[mean],precipitation_anomaly:[anomaly],precipitation_efi:[efi]},monthly:{time:["2027-01-01"],precipitation_mean:[mean],precipitation_anomaly:[anomaly]}}))});
test("revision history compares same exact region scale target label and model",()=>{
 const r=buildSeasonalRevisionHistory([snapshot("2026-11-28",12,4,.3),snapshot("2026-11-27",10,-2,.1)]);
 assert.equal(r.snapshotCount,2);assert.equal(r.comparisonCount,18);
 const row=r.comparisons.find(x=>x.region==="north"&&x.scale==="weekly");
 assert.equal(row.changes.precipitation_mean.delta,2);assert.equal(row.changes.precipitation_anomaly.delta,6);assert.equal(row.changes.precipitation_anomaly.directionChanged,true);
});
test("revision history never zero-fills missing values",()=>{
 const a=snapshot("2026-11-27",null,0),b=snapshot("2026-11-28",5,1);
 const row=buildSeasonalRevisionHistory([a,b]).comparisons.find(x=>x.region==="north"&&x.scale==="weekly");
 assert.equal(row.changes.precipitation_mean.previous,null);assert.equal(row.changes.precipitation_mean.delta,null);
});
test("revision history refuses comparisons across model or unit changes",()=>{
 const a=snapshot("2026-11-27",2,1),b=snapshot("2026-11-28",3,2);b.model="different_model";
 const r=buildSeasonalRevisionHistory([a,b]);assert.equal(r.comparisonCount,0);
 const c=snapshot("2026-11-28",3,2);c.points[0].weeklyUnits.precipitation_mean="inch";
 const r2=buildSeasonalRevisionHistory([a,c]);assert.equal(r2.comparisons.some(x=>x.region==="north"&&x.scale==="weekly"),false);
});
test("revision output never asserts period semantics or forecast skill",()=>{
 const r=buildSeasonalRevisionHistory([snapshot("2026-11-27",2,1),snapshot("2026-11-28",3,2)]);
 assert.equal(r.gate.periodBoundaryVerified,false);assert.equal(r.gate.issueTimeKnown,false);assert.equal(r.gate.forecastSkillClaimed,false);
});
