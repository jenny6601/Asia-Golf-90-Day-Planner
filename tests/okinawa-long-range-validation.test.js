import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {buildDailyClimateOutlook} from "../assets/js/daily-climate-outlook.js";

const courses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8")).filter(x=>["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"].includes(x.id));
const today="2026-11-27";
const add=(date,n)=>new Date(Date.parse(date+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
const dates=Array.from({length:74},(_,i)=>add(today,16+i));
function makeHistory(){return dates.map(date=>({date,sampleYears:30,rainSampleYears:30,temperatureSampleYears:30,feelsLikeSampleYears:30,rainFrequency:35,rainMean:2,rainP10:0,rainP90:8,highMean:24,lowMean:17,humidityMean:70,windMean:2,feelsLikeMinMeanC:14,feelsLikeMaxMeanC:22}))}
test("six Okinawa golf courses share a complete historical-only D17-D90 estimate timeline",()=>{
 assert.equal(courses.length,6);
 for(const course of courses){
  const rows=buildDailyClimateOutlook({},makeHistory(),today,90);
  assert.equal(rows.length,74,course.id);
  assert.equal(rows[0].lead,17,course.id);
  assert.equal(rows.at(-1).lead,90,course.id);
  assert.equal(new Set(rows.map(x=>x.date)).size,72,course.id);
  assert.ok(rows.every(x=>x.sourceType==="historical-climate-estimate"),course.id);
  assert.ok(rows.every(x=>Number.isFinite(x.feelsLikeMinEstimateC)&&Number.isFinite(x.feelsLikeMaxEstimateC)&&Number.isFinite(x.rainEstimate)&&Number.isFinite(x.rainChanceEstimate)&&Number.isFinite(x.windMeanEstimate)),course.id);
  assert.ok(rows.every(x=>x.rainProbability===null),course.id);
 }
});
test("all D19-D90 horizon bands use the same 1991-2020 historical-only method",()=>{
 const rows=buildDailyClimateOutlook({},makeHistory(),today,90);
 assert.ok(rows.every(x=>x.seasonal.disabled&&x.seasonalEvidenceCount===0));
 assert.ok(rows.filter(x=>x.lead<=46).every(x=>x.band==="D17–D46"));
 assert.ok(rows.filter(x=>x.lead>=47&&x.lead<=60).every(x=>x.band==="D47–D60"));
 assert.ok(rows.filter(x=>x.lead>=61).every(x=>x.band==="D61–D90"));
 assert.ok(rows.every(x=>x.historical.referencePeriod==="1991-2020"));
});
test("missing historical daily baseline stays null; no seasonal values are substituted",()=>{
 const rows=buildDailyClimateOutlook({weekly:{precipitation_efi:[1]},monthly:{precipitation_anomaly:[99]}},[],today,90);
 assert.ok(rows.every(x=>x.highEstimate===null&&x.lowEstimate===null&&x.feelsLikeMinEstimateC===null&&x.feelsLikeMaxEstimateC===null&&x.rainEstimate===null&&x.rainChanceEstimate===null));
 assert.ok(rows.every(x=>x.sourceType==="insufficient-data"));
});
