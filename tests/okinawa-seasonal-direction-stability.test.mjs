import test from "node:test";
import assert from "node:assert/strict";
import {buildSeasonalDirectionStability} from "../scripts/okinawa-seasonal-direction-stability.js";
const snap=(date,anomaly,efi=0)=>({archiveType:"okinawa-ecmwf-seasonal-snapshot",archiveDate:date,retrievedAt:date+"T02:00:00Z",points:["north","central","south"].map(id=>({point:{id},weeklyUnits:{precipitation_anomaly:"mm",precipitation_efi:"1"},monthlyUnits:{precipitation_anomaly:"mm"},weekly:{time:["2026-12-01"],precipitation_anomaly:[anomaly],precipitation_efi:[efi]},monthly:{time:["2027-01-01"],precipitation_anomaly:[anomaly]}}))});
test("three consistent snapshots are classified as consistent direction",()=>{
 const r=buildSeasonalDirectionStability([snap("2026-11-27",3),snap("2026-11-28",2),snap("2026-11-29",1)]);
 const row=r.records.find(x=>x.region==="north"&&x.scale==="weekly"&&x.field==="precipitation_anomaly");
 assert.equal(row.stabilityStatus,"CONSISTENT_DIRECTION");assert.equal(row.dominantDirection,"WETTER_THAN_MODEL_CLIMATE");assert.equal(row.directionChanges,0);
});
test("direction flips are counted only across valid observations",()=>{
 const r=buildSeasonalDirectionStability([snap("2026-11-27",3),snap("2026-11-28",null),snap("2026-11-29",-1),snap("2026-11-30",2)]);
 const row=r.records.find(x=>x.region==="north"&&x.scale==="weekly"&&x.field==="precipitation_anomaly");
 assert.equal(row.directionChanges,2);assert.equal(row.stabilityStatus,"DIRECTION_CHANGED");
});
test("fewer than three valid snapshots are insufficient",()=>{
 const r=buildSeasonalDirectionStability([snap("2026-11-27",3),snap("2026-11-28",3)]);
 const row=r.records.find(x=>x.region==="south"&&x.scale==="monthly");
 assert.equal(row.stabilityStatus,"INSUFFICIENT_SNAPSHOTS");
});
test("regional agreement is reported only with three regions",()=>{
 const a=snap("2026-11-27",2),b=snap("2026-11-28",1),c=snap("2026-11-29",3);
 const r=buildSeasonalDirectionStability([a,b,c]);
 assert.equal(r.regionalAgreement.find(x=>x.scale==="weekly").agreementStatus,"THREE_REGION_DIRECTION_AGREEMENT");
 const partial=structuredClone(c);partial.points=partial.points.filter(x=>x.point.id!=="south");
 const r2=buildSeasonalDirectionStability([a,b,partial]);
 assert.equal(r2.regionalAgreement.find(x=>x.scale==="weekly").agreementStatus,"INCOMPLETE_REGIONAL_COVERAGE");
});
test("stability output is not a confidence score or forecast skill",()=>{
 const r=buildSeasonalDirectionStability([snap("2026-11-27",2),snap("2026-11-28",2),snap("2026-11-29",2)]);
 assert.equal(r.gate.calibratedStabilityScore,false);assert.equal(r.gate.forecastSkillClaimed,false);assert.equal(r.gate.periodBoundaryVerified,false);
});
