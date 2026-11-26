import test from "node:test";
import assert from "node:assert/strict";
import { splitByValidTime, fitAdditiveBiasCorrection, applyAdditiveBiasCorrection, evaluateCorrectionOnHoldout } from "../assets/js/shared-bias-correction.js";
import { buildCountryCoverageMatrix } from "../assets/js/eight-country-coverage.js";
const row=(validTime,forecastValue,verificationValue)=>({countryCode:"JP",provider:"ecmwf",model:"seas5",initializationTime:"2026-01-01T00:00:00Z",validTime,leadDays:30,variable:"precipitation",verificationSource:"era5-proxy",unit:"mm",forecastValue,verificationValue});
test("time split prevents later holdout samples entering training",()=>{
 const s=splitByValidTime([row("2026-01-02T00:00:00Z",4,5),row("2026-02-02T00:00:00Z",4,5)],"2026-02-01T00:00:00Z");
 assert.equal(s.training.length,1); assert.equal(s.holdout.length,1);
});
test("bias correction refuses small training samples",()=>{
 assert.equal(fitAdditiveBiasCorrection([row("2026-01-02T00:00:00Z",4,5)]).status,"insufficient-training-data");
});
test("correction is fitted on training and accepted only on better holdout MAE",()=>{
 const training=Array.from({length:100},(_,i)=>row("2026-01-"+String((i%28)+1).padStart(2,"0")+"T00:00:00Z",4,5));
 const model=fitAdditiveBiasCorrection(training);
 assert.equal(model.status,"fitted"); assert.equal(applyAdditiveBiasCorrection(4,model),5);
 const result=evaluateCorrectionOnHoldout([row("2026-03-01T00:00:00Z",4,5)],model);
 assert.equal(result.adopt,true); assert.equal(result.correctedMae,0);
});
test("country coverage includes disabled countries and missing coordinates",()=>{
 const countries=[{code:"JP",name:"Japan",enabled:true},{code:"KR",name:"Korea",enabled:false}];
 const rows=buildCountryCoverageMatrix(countries,[{id:"x",countryCode:"JP",enabled:true,latitude:null,longitude:null}],["open-meteo"]);
 assert.equal(rows.length,2); assert.equal(rows[0].readiness,"course-coordinates-incomplete");
 assert.equal(rows[1].readiness,"country-disabled");
});
