import test from "node:test";
import assert from "node:assert/strict";
import { compareForecastBaselines } from "../assets/js/forecast-baseline-comparison.js";
const sample=(f,o,c)=>({countryCode:"JP",provider:"ecmwf",model:"seas5",initializationTime:"2026-01-01T00:00:00Z",validTime:"2026-02-01T00:00:00Z",leadDays:30,variable:"precipitation",verificationSource:"era5-proxy",unit:"mm",forecastValue:f,verificationValue:o,climatologyValue:c});
test("three-way comparison scores raw, corrected and climatology on same holdout rows",()=>{
 const rows=[sample(8,5,6),sample(7,5,6)];
 const result=compareForecastBaselines(rows,{status:"fitted",correction:-2});
 assert.equal(result.n,2); assert.equal(result.rawMae,2.5);
 assert.equal(result.correctedMae,.5); assert.equal(result.climatologyMae,1);
 assert.equal(result.best,"corrected"); assert.equal(result.correctionBeatsClimatology,true);
});
test("comparison refuses missing comparable baseline data",()=>{
 assert.equal(compareForecastBaselines([],null).status,"no-comparable-holdout-data");
});
