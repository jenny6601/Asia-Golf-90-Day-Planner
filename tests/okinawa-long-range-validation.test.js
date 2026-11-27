import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {buildDailyClimateOutlook} from "../assets/js/daily-climate-outlook.js";

const courses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8")).filter(x=>x.countryCode==="JP"&&x.region==="Okinawa");
const today="2026-11-27";
const add=(date,n)=>new Date(Date.parse(date+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
const dates=Array.from({length:72},(_,i)=>add(today,18+i));
const weeklyDates=[add(today,18),add(today,25),add(today,32),add(today,39)];
const monthlyDates=["2026-12-01","2027-01-01","2027-02-01","2027-03-01"];
function makeSeasonal(){return {weekly:{time:weeklyDates,precipitation_mean:[5,5,5,5],precipitation_anomaly:[1,1,1,1],precipitation_efi:[.2,.2,.2,.2],precipitation_anomaly_gt0:[55,55,55,55],temperature_2m_anomaly:[.5,.5,.5,.5],wind_speed_10m_mean:[4,4,4,4]},monthly:{time:monthlyDates,precipitation_mean:[150,150,150,150],precipitation_anomaly:[10,10,10,10],temperature_2m_anomaly:[.5,.5,.5,.5],wind_speed_10m_mean:[4,4,4,4],cloud_cover_anomaly:[5,5,5,5]}}}
function makeHistory(){return dates.map(date=>({date,sampleYears:10,rainSampleYears:10,temperatureSampleYears:10,rainFrequency:35,rainMean:2,rainP10:0,rainP90:8,highMean:24,lowMean:17,highStd:1,lowStd:1}))}
test("six Okinawa GPS points each produce a complete D19-D90 estimate timeline",()=>{
 assert.equal(courses.length,6);
 for(const course of courses){
  const rows=buildDailyClimateOutlook(makeSeasonal(),makeHistory(),today,90);
  assert.equal(rows.length,72,course.id);
  assert.equal(rows[0].lead,19,course.id);
  assert.equal(rows.at(-1).lead,90,course.id);
  assert.equal(new Set(rows.map(x=>x.date)).size,72,course.id);
  assert.ok(rows.every(x=>x.sourceType==="seasonal-plus-historical-estimate"),course.id);
  assert.ok(rows.every(x=>Number.isFinite(x.highEstimate)&&Number.isFinite(x.lowEstimate)&&Number.isFinite(x.rainEstimate)&&Number.isFinite(x.rainChanceEstimate)&&Number.isFinite(x.windMeanEstimate)),course.id);
  assert.ok(rows.every(x=>x.rainProbability===null),course.id);
 }
});
test("D19-D46 and D47-D90 retain distinct weekly and monthly seasonal evidence",()=>{
 const rows=buildDailyClimateOutlook(makeSeasonal(),makeHistory(),today,90);
 assert.ok(rows.filter(x=>x.lead<=46).every(x=>x.seasonal.weeklyDate!==null));
 assert.ok(rows.filter(x=>x.lead>=47).every(x=>Number.isFinite(x.seasonal.precipitationAnomaly)));
 assert.ok(rows.filter(x=>x.lead<=46).every(x=>x.band==="D19–D46"));
 assert.ok(rows.filter(x=>x.lead>=47&&x.lead<=60).every(x=>x.band==="D47–D60"));
 assert.ok(rows.filter(x=>x.lead>=61).every(x=>x.band==="D61–D90"));
});
test("missing historical daily baseline never gets filled with invented numeric weather",()=>{
 const rows=buildDailyClimateOutlook(makeSeasonal(),[],today,90);
 assert.ok(rows.every(x=>x.highEstimate===null&&x.lowEstimate===null&&x.rainEstimate===null&&x.rainChanceEstimate===null));
 assert.ok(rows.every(x=>x.sourceType==="seasonal-signal-without-daily-baseline"));
});