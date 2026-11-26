import test from "node:test";
import assert from "node:assert/strict";
import {scoreGolfSuitabilityWindow} from "../assets/js/suitability-engine.js";
function sample(overrides={}) {
 const time=Array.from({length:24},(_,h)=>`2026-11-24T${String(h).padStart(2,"0")}:00`);
 return {time,wind_speed_10m:Array(24).fill(3),wind_gusts_10m:Array(24).fill(5),
  apparent_temperature:Array(24).fill(24),weather_code:Array(24).fill(1),...overrides};
}
test("benign six-hour weather yields good playability",()=>{
 const r=scoreGolfSuitabilityWindow(sample(),"2026-11-24",7);
 assert.equal(r.status,"scored");assert.equal(r.severity,0);assert.equal(r.grade,"良好");
});
test("strong gusts and thunderstorms trigger not-recommended overlay",()=>{
 const h=sample();h.wind_gusts_10m.fill(16);h.weather_code[9]=95;
 const r=scoreGolfSuitabilityWindow(h,"2026-11-24",7);
 assert.equal(r.severity,3);assert.equal(r.grade,"不建議");
 assert.equal(r.thunderstormSignal,true);
});
test("cold feels-like temperature triggers caution",()=>{
 const h=sample();h.apparent_temperature.fill(8);
 const r=scoreGolfSuitabilityWindow(h,"2026-11-24",7);
 assert.equal(r.severity,2);assert.ok(r.reasons.includes("體感溫度需留意"));
});
test("missing suitability fields are not treated as benign",()=>{
 const h=sample();delete h.wind_gusts_10m;
 assert.equal(scoreGolfSuitabilityWindow(h,"2026-11-24",7).status,"insufficient-data");
});
test("missing forecast hour fails closed",()=>{
 const h=sample();h.time.splice(10,1);
 assert.equal(scoreGolfSuitabilityWindow(h,"2026-11-24",7).status,"insufficient-data");
});
