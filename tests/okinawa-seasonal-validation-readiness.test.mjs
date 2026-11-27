import test from "node:test";
import assert from "node:assert/strict";
import {summarizeSeasonalValidationReadiness} from "../scripts/okinawa-seasonal-validation-readiness.js";
test("weekly and monthly readiness remain separate by region",()=>{
 const pairs=[{pairs:[{region:"north",temporalScale:"weekly",observation:{complete:true},forecast:{precipitationMean:12},periodBoundaryVerified:false,issueTimeKnown:false,status:"OBSERVATION_COVERAGE_COMPLETE_SEMANTICS_UNVERIFIED"},{region:"north",temporalScale:"monthly",observation:{complete:false},forecast:{precipitationMean:80},periodBoundaryVerified:false,issueTimeKnown:false,status:"INCOMPLETE_OBSERVATION_COVERAGE"}]}];
 const result=summarizeSeasonalValidationReadiness(pairs,[]);
 const weekly=result.groups.find(x=>x.region==="north"&&x.temporalScale==="weekly");
 const monthly=result.groups.find(x=>x.region==="north"&&x.temporalScale==="monthly");
 assert.equal(weekly.coverageCompleteRecords,1);assert.equal(weekly.scoringEligibleRecords,0);
 assert.equal(monthly.incompleteRecords,1);assert.equal(monthly.scoringEligibleRecords,0);
});
test("complete observations do not permit scoring when temporal semantics or issue time are unknown",()=>{
 const pair={region:"south",temporalScale:"weekly",observation:{complete:true},forecast:{precipitationMean:1},periodBoundaryVerified:false,issueTimeKnown:false,status:"OBSERVATION_COVERAGE_COMPLETE_SEMANTICS_UNVERIFIED"};
 const result=summarizeSeasonalValidationReadiness([{pairs:[pair]}],[]);
 assert.equal(result.totals.coverageCompleteRecords,1);assert.equal(result.totals.scoringEligibleRecords,0);
 assert.match(result.globalReadiness,/NO_SKILL_SCORING/);
});
test("ERA5 context availability is reported independently from ECMWF anomaly values",()=>{
 const contexts=[{records:[{region:"central",modelAnomalyMm:4,era5Context:{code:"ERA5_REFERENCE_ONLY"}},{region:"central",modelAnomalyMm:null,era5Context:{code:"INSUFFICIENT_ERA5_BASELINE"}}]}];
 const result=summarizeSeasonalValidationReadiness([],contexts);
 const central=result.monthlyContext.find(x=>x.region==="central");
 assert.equal(central.knownAnomalyRecords,1);assert.equal(central.era5ReferenceRecords,1);assert.equal(central.missingEra5ReferenceRecords,1);
});
