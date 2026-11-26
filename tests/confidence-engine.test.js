import test from "node:test";
import assert from "node:assert/strict";
import {classifyForecastConfidence,summarizeWindowConfidence} from "../assets/js/confidence-engine.js";

const ref="2026-11-23";
test("1-16 day forecast is medium but explicitly uncalibrated",()=>{
 const c=classifyForecastConfidence({validDate:"2026-12-01",referenceDate:ref});
 assert.equal(c.level,"medium");
 assert.match(c.label,/未校準/);
 assert.match(c.reason,/歷史回測/);
});
test("17-46 day weekly outlook is low confidence",()=>{
 const c=classifyForecastConfidence({validDate:"2027-01-05",referenceDate:ref,temporalResolution:"weekly"});
 assert.equal(c.level,"low");
 assert.match(c.reason,/非逐日預報/);
});
test("47-90 day seasonal outlook is very low confidence",()=>{
 const c=classifyForecastConfidence({validDate:"2027-02-10",referenceDate:ref,temporalResolution:"monthly"});
 assert.equal(c.level,"very-low");
 assert.match(c.reason,/季節趨勢/);
});
test("missing or incomplete data is never assigned confidence",()=>{
 assert.equal(classifyForecastConfidence({validDate:"2026-12-01",referenceDate:ref,dataAvailable:false}).level,"very-low");
 assert.equal(classifyForecastConfidence({validDate:"2026-12-01",referenceDate:ref,completeness:.5}).level,"very-low");
});
test("confidence is not upgraded without hindcast validation and ensemble spread",()=>{
 const c=classifyForecastConfidence({validDate:"2026-11-30",referenceDate:ref,ensembleSpreadAvailable:true,hindcastValidated:true});
 assert.notEqual(c.level,"high");
});
test("itinerary confidence follows weakest day, not arithmetic average",()=>{
 const c=summarizeWindowConfidence([{level:"medium"},{level:"medium"},{level:"very-low"}]);
 assert.equal(c.level,"very-low");
});
