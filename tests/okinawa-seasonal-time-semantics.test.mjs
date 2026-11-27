import test from "node:test";
import assert from "node:assert/strict";
import {auditSeasonalForecastSnapshot,summarizeSeasonalSnapshotAudits} from "../scripts/okinawa-seasonal-time-semantics.js";
const point=id=>({point:{id},weeklyUnits:{precipitation_mean:"mm",precipitation_anomaly:"mm"},monthlyUnits:{precipitation_mean:"mm",precipitation_anomaly:"mm"},weekly:{time:["2026-12-01","2026-12-08"],precipitation_mean:[1,2],precipitation_anomaly:[0,1],precipitation_efi:[0,.1]},monthly:{time:["2026-12-01","2027-01-01"],precipitation_mean:[2,3],precipitation_anomaly:[0,1]}});
const snapshot={archiveDate:"2026-11-27",retrievedAt:"2026-11-27T00:00:00Z",model:"ecmwf_seasonal_seamless",archiveType:"okinawa-ecmwf-seasonal-snapshot",points:["north","central","south"].map(point)};
test("time audit validates cadence and array alignment without assigning period boundaries",()=>{
 const r=auditSeasonalForecastSnapshot(snapshot);
 assert.equal(r.validForStructuralReview,true);assert.equal(r.regions[0].weekly.timestampSemantics,"UNVERIFIED_LABEL_ONLY");
 assert.equal(r.issueTimeKnown,false);assert.equal(r.periodBoundariesVerified,false);assert.equal(r.scoringAllowed,false);
});
test("time audit flags duplicate, invalid and misaligned time arrays",()=>{
 const bad=structuredClone(snapshot);bad.points[0].weekly.time=["2026-12-01","2026-12-01"];bad.points[0].weekly.precipitation_mean=[1];
 const r=auditSeasonalForecastSnapshot(bad);
 assert.equal(r.validForStructuralReview,false);assert.ok(r.errors.some(x=>x.includes("duplicate")));assert.ok(r.errors.some(x=>x.includes("misaligned")));
});
test("monthly label cadence is checked by calendar month, including year boundary",()=>{
 const r=auditSeasonalForecastSnapshot(snapshot);
 assert.equal(r.regions[1].monthly.sequence.labelSpacingConsistent,true);
});
test("summary never marks scoring as allowed while metadata gates remain unknown",()=>{
 const r=summarizeSeasonalSnapshotAudits([auditSeasonalForecastSnapshot(snapshot)]);
 assert.equal(r.scoringAllowed,false);assert.equal(r.issueTimeKnownRecords,0);assert.match(r.globalGate,/UNVERIFIED/);
});
