import test from "node:test";
import assert from "node:assert/strict";
import {evaluateSixHourPlayability,SIX_HOUR_REQUIRED_FIELDS} from "../assets/js/six-hour-playability.js";

function hourly(overrides={}){
 const time=Array.from({length:24},(_,i)=>"2026-11-27T"+String(i).padStart(2,"0")+":00");
 const data={time,precipitation_probability:Array(24).fill(5),precipitation:Array(24).fill(0),temperature_2m:Array(24).fill(24),apparent_temperature:Array(24).fill(24),wind_speed_10m:Array(24).fill(3),wind_gusts_10m:Array(24).fill(5),weather_code:Array(24).fill(1)};
 return Object.assign(data,overrides);
}

test("six-hour evaluator requires and summarizes all seven weather fields",()=>{
 const r=evaluateSixHourPlayability(hourly(),"2026-11-27",7);
 assert.equal(r.status,"scored");assert.equal(r.sampleCount,6);
 assert.equal(r.inputs.rainfallTotalMm,0);assert.equal(r.inputs.maximumRainProbability,5);
 assert.equal(r.inputs.temperatureMinC,24);assert.equal(r.inputs.feelsLikeMaxC,24);
 assert.equal(r.inputs.averageWindMs,3);assert.equal(r.inputs.peakGustMs,5);
 assert.equal(r.playability.grade,"A");assert.equal(r.rain.status,"scored");assert.equal(r.environment.status,"scored");
 assert.deepEqual(SIX_HOUR_REQUIRED_FIELDS,["precipitation_probability","precipitation","temperature_2m","apparent_temperature","wind_speed_10m","wind_gusts_10m","weather_code"]);
});

test("missing rainfall, temperature, feels-like, wind, gust or weather code fails closed",()=>{
 for(const field of SIX_HOUR_REQUIRED_FIELDS){
  const h=hourly();h[field][9]=null;
  const r=evaluateSixHourPlayability(h,"2026-11-27",7);
  assert.equal(r.status,"insufficient-data",field);
  assert.ok(r.missingFields.includes(field),field);
 }
});

test("thunderstorm signal overrides the numeric score and marks the window unsafe",()=>{
 const h=hourly();h.weather_code[10]=95;
 const r=evaluateSixHourPlayability(h,"2026-11-27",7);
 assert.equal(r.status,"scored");assert.equal(r.inputs.thunderstormSignal,true);
 assert.equal(r.playability.grade,"E");assert.equal(r.playability.safety.grade,"E");
 assert.equal(r.environment.severity,3);
});

test("six-hour accumulated rainfall triggers the heavy-rain safety override",()=>{
 const h=hourly();for(let i=7;i<13;i++)h.precipitation[i]=1;
 const r=evaluateSixHourPlayability(h,"2026-11-27",7);
 assert.equal(r.inputs.rainfallTotalMm,6);assert.equal(r.playability.grade,"D");
 assert.equal(r.playability.safety.grade,"D");assert.ok(r.rain.rainRisk>60);
});

test("missing any of the six exact valid hours is rejected without interpolation",()=>{
 const h=hourly();h.time.splice(9,1);
 const r=evaluateSixHourPlayability(h,"2026-11-27",7);
 assert.equal(r.status,"insufficient-data");assert.equal(r.reason,"missing-hour");
 assert.equal(r.missingHour,"2026-11-27T09:00");
});

test("strong gusts trigger the environment caution and safety overlay",()=>{
 const h=hourly();for(let i=7;i<13;i++)h.wind_gusts_10m[i]=16;
 const r=evaluateSixHourPlayability(h,"2026-11-27",7);
 assert.equal(r.environment.severity,3);assert.equal(r.playability.grade,"D");
});