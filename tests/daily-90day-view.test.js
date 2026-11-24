import test from "node:test";
import assert from "node:assert/strict";
import {build90DayDailyView} from "../assets/js/daily-90day-view.js";
const ref="2026-11-24";
const courses=Array.from({length:3},(_,n)=>({course:{name:"Course "+n},daily:{time:Array.from({length:16},(_,i)=>new Date(Date.parse(ref+"T00:00:00Z")+i*86400000).toISOString().slice(0,10)),precipitation_probability_max:Array(16).fill(20+n),precipitation_sum:Array(16).fill(1+n),temperature_2m_min:Array(16).fill(18),temperature_2m_max:Array(16).fill(25),wind_speed_10m_max:Array(16).fill(5),wind_gusts_10m_max:Array(16).fill(8)}}));
const points=Array.from({length:3},(_,n)=>({point:{id:"z"+n,label:"區域"+n},weekly:{time:["2026-12-10"],precipitation_efi:[-.6]},monthly:{time:["2027-01-01","2027-02-01"],precipitation_mean:[100,100],precipitation_anomaly:[-30,30]}}));
test("builds 90 consecutive daily rows with honest horizon semantics",()=>{
 const rows=build90DayDailyView({referenceDate:ref,courses,points});
 assert.equal(rows.length,90);assert.equal(rows[0].date,ref);assert.equal(rows[89].date,"2027-02-21");
 assert.equal(rows[0].horizon,"forecast");assert.equal(rows[15].horizon,"forecast");
 assert.equal(rows[16].horizon,"weekly-trend");assert.equal(rows[45].horizon,"weekly-trend");
 assert.equal(rows[46].horizon,"seasonal-outlook");assert.equal(rows[89].horizon,"seasonal-outlook");
 assert.equal(rows[0].weather.courseCount,3);assert.equal(rows[0].weather.precipitationProbabilityMax,22);
 assert.equal(rows[16].signals[0].signal.label,"偏乾");
 assert.equal(rows[46].signals[0].signal.label,"偏乾");
});
test("missing daily data remains incomplete and never becomes zero",()=>{
 const broken=courses.map((c,i)=>i===1?{...c,daily:{...c.daily,time:[]}}:c);
 const rows=build90DayDailyView({referenceDate:ref,courses:broken,points});
 assert.equal(rows[0].status,"incomplete");assert.equal(rows[0].weather.courseCount,2);
 assert.equal(rows[0].weather.precipitationProbabilityMax,22);
});
