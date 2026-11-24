import test from "node:test";
import assert from "node:assert/strict";
import {scorePwaStylePlayability} from "../assets/js/pwa-playability.js";
function fixture(overrides={}) {
 const time=Array.from({length:6},(_,i)=>"2027-01-10T"+String(7+i).padStart(2,"0")+":00");
 return {time,precipitation_probability:[0,0,0,0,0,0],precipitation:[0,0,0,0,0,0],wind_speed_10m:[2,2,2,2,2,2],wind_gusts_10m:[3,3,3,3,3,3],apparent_temperature:[23,24,25,25,24,23],weather_code:[1,1,1,1,1,1],...overrides};
}
test("PWA-style score returns five weighted factors and a grade",()=>{
 const result=scorePwaStylePlayability(fixture(),"2027-01-10",7);
 assert.equal(result.status,"scored");assert.equal(result.score,100);assert.equal(result.grade,"A");assert.equal(result.weightCoverage,100);assert.equal(result.parts.length,5);
});
test("thunderstorm safety override forces E",()=>{
 const result=scorePwaStylePlayability(fixture({weather_code:[1,1,95,1,1,1]}),"2027-01-10",7);
 assert.equal(result.grade,"E");assert.ok(result.safety);
});
test("heavy rainfall safety override caps grade at D",()=>{
 const result=scorePwaStylePlayability(fixture({precipitation:[1,1,1,1,1,1]}),"2027-01-10",7);
 assert.equal(result.grade,"D");
});
test("missing factor data is not treated as zero",()=>{
 const result=scorePwaStylePlayability(fixture({wind_speed_10m:[null,null,null,null,null,null],wind_gusts_10m:[null,null,null,null,null,null]}),"2027-01-10",7);
 assert.equal(result.parts.find(x=>x.key==="wind").value,null);assert.equal(result.weightCoverage,85);
});
test("incomplete six-hour window is not scored",()=>{
 const result=scorePwaStylePlayability(fixture(),"2027-01-10",8);
 assert.equal(result.status,"insufficient-data");
});

test("very low feels-like temperature adds a cold danger alert",()=>{
 const result=scorePwaStylePlayability(fixture({apparent_temperature:[8,9,9,10,10,10]}),"2027-01-10",7);
 assert.ok(result.alerts.some(x=>x.includes("極低溫")));
});
test("fog weather codes add a visibility alert",()=>{
 const result=scorePwaStylePlayability(fixture({weather_code:[45,45,1,1,1,1]}),"2027-01-10",7);
 assert.ok(result.alerts.some(x=>x.includes("霧況")));
});
