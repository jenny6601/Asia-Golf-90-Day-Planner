import test from "node:test";
import assert from "node:assert/strict";
import {fetchCourseHistoricalMonthlyClimate,fetchCourseHistoricalWeekNormals} from "../assets/js/long-range-api.js";

test("monthly and same-calendar-day climatology share one ERA5 archive request",async()=>{
 let calls=0;
 const fetchImpl=async()=>{
  calls++;
  return {ok:true,json:async()=>({daily:{
   time:["2016-12-15","2025-12-15"],
   temperature_2m_max:[23,25],
   temperature_2m_min:[16,18],
   precipitation_sum:[0,4]
  }})};
 };
 const course={id:"cache-test",latitude:25.1,longitude:121.5,timezone:"Asia/Taipei"};
 const now=new Date("2026-11-26T00:00:00Z");
 const monthly=await fetchCourseHistoricalMonthlyClimate(course,fetchImpl,now);
 const daily=await fetchCourseHistoricalWeekNormals(course,["2026-12-15"],fetchImpl,now);
 assert.equal(calls,1);
 assert.equal(monthly.monthly[11].years,2);
 assert.equal(daily.days[0].sampleYears,2);
 assert.equal(daily.days[0].highMean,24);
 assert.equal(daily.days[0].lowMean,17);
 assert.equal(daily.days[0].rainFrequency,50);
});
