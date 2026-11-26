import test from "node:test";
import assert from "node:assert/strict";
import {
  longRangeLeadBand, validatePairedForecastSample, pairedForecastMetrics,
  summarizeLongRangeVerification, calibratedRainBrierScore, ensembleSpreadSummary
} from "../assets/js/shared-forecast-verification.js";
const sample=(leadDays,forecastValue,verificationValue,extra={})=>({
 countryCode:"JP",courseId:"course-1",provider:"ecmwf",model:"seas5",modelVersion:"51",
 initializationTime:"2026-01-01T00:00:00Z",validTime:"2026-02-01T00:00:00Z",
 leadDays,variable:"precipitation",forecastValue,verificationValue,
 verificationSource:"era5-proxy",temporalResolution:"daily",unit:"mm",...extra
});
test("long-range lead bands split the four required horizons",()=>{
 assert.equal(longRangeLeadBand(17),"D17_30");
 assert.equal(longRangeLeadBand(30),"D17_30");
 assert.equal(longRangeLeadBand(31),"D31_46");
 assert.equal(longRangeLeadBand(46),"D31_46");
 assert.equal(longRangeLeadBand(47),"D47_60");
 assert.equal(longRangeLeadBand(60),"D47_60");
 assert.equal(longRangeLeadBand(61),"D61_90");
 assert.equal(longRangeLeadBand(90),"D61_90");
 assert.equal(longRangeLeadBand(91),"OUT_OF_RANGE");
});
test("paired samples require provenance, same-time keys and numeric values",()=>{
 assert.equal(validatePairedForecastSample(sample(25,5,3)).valid,true);
 const invalid=sample(25,5,3,{provider:""});
 assert.equal(validatePairedForecastSample(invalid).valid,false);
});
test("paired metrics and band summary skip invalid data",()=>{
 const rows=[sample(20,5,3),sample(35,4,6),sample(55,8,6),sample(70,1,3),sample(20,null,3)];
 const summary=summarizeLongRangeVerification(rows);
 assert.equal(summary.bands.D17_30.n,1);
 assert.equal(summary.bands.D31_46.n,1);
 assert.equal(summary.bands.D47_60.n,1);
 assert.equal(summary.bands.D61_90.n,1);
 assert.equal(pairedForecastMetrics(rows).n,4);
});
test("Brier score refuses uncalibrated ensemble fractions",()=>{
 const rows=[{probability:.7,probabilityType:"ensemble-fraction",observedRainEvent:true,verificationSource:"era5"}];
 assert.deepEqual(calibratedRainBrierScore(rows),{n:0,score:null,status:"no-calibrated-probabilities"});
});
test("Brier score accepts explicitly calibrated probabilities only",()=>{
 const rows=[{probability:.8,probabilityType:"calibrated",observedRainEvent:true,verificationSource:"era5"}];
 const result=calibratedRainBrierScore(rows);
 assert.equal(result.n,1); assert.ok(Math.abs(result.score-.04)<1e-12);
});
test("ensemble spread is summarized only when at least two members exist",()=>{
 const result=ensembleSpreadSummary([{members:[1,2,3]},{members:[2]}]);
 assert.equal(result.n,1); assert.ok(result.meanSpread>0);
});
