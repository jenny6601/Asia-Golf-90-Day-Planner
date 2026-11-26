import test from "node:test";
import assert from "node:assert/strict";
import {scoreGolfRainWindow} from "../assets/js/rain-risk.js";

function hourly({probability=0,amount=0}={}) {
  return {
    time:Array.from({length:24},(_,h)=>`2026-11-24T${String(h).padStart(2,"0")}:00`),
    precipitation_probability:Array(24).fill(probability),
    precipitation:Array(24).fill(amount)
  };
}
test("dry six-hour golf window has zero prototype rain risk",()=>{
 const r=scoreGolfRainWindow(hourly(), "2026-11-24", 7);
 assert.equal(r.status,"scored");
 assert.equal(r.rainRisk,0);
 assert.equal(r.label,"低");
});
test("heavy rain window produces higher risk and preserves raw metrics",()=>{
 const r=scoreGolfRainWindow(hourly({probability:90,amount:2}),"2026-11-24",7);
 assert.ok(r.rainRisk>70);
 assert.equal(r.expectedRainAmountMm,12);
 assert.equal(r.peakHourlyRainMm,2);
 assert.equal(r.wetHours,6);
 assert.equal(r.calibration,"unvalidated");
});
test("missing hourly data is not treated as zero rain",()=>{
 const h=hourly();h.precipitation_probability[9]=null;
 const r=scoreGolfRainWindow(h,"2026-11-24",7);
 assert.equal(r.status,"insufficient-data");
});
test("window crossing missing end hour is incomplete",()=>{
 const h=hourly();h.time=h.time.slice(0,11);
 const r=scoreGolfRainWindow(h,"2026-11-24",7,6);
 assert.equal(r.status,"insufficient-data");
});
