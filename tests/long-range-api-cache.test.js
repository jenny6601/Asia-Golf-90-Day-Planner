import test from "node:test";
import assert from "node:assert/strict";
import {fetchCourseHistoricalMonthlyClimate,fetchCourseHistoricalWeekNormals} from "../assets/js/long-range-api.js";

test("monthly and 31-day historical normals share one 1991-2020 ERA5 archive request",async()=>{
 let calls=0,requestUrl=null;
 const fetchImpl=async url=>{
  calls++;requestUrl=new URL(url);
  return {ok:true,json:async()=>({daily:{
   time:["2016-12-15","2025-12-15"],
   temperature_2m_max:[23,25],
   temperature_2m_min:[16,18],
   dew_point_2m_mean:[14,16],
   relative_humidity_2m_mean:[70,74],
   wind_speed_10m_mean:[2,3],
   wind_speed_10m_max:[4,5],
   precipitation_sum:[0,4],
   precipitation_hours:[0,3],
   weather_code:[1,61]
  }})};
 };
 const course={id:"cache-test",latitude:25.1,longitude:121.5,timezone:"Asia/Taipei"};
 const now=new Date("2026-11-26T00:00:00Z");
 const monthly=await fetchCourseHistoricalMonthlyClimate(course,fetchImpl,now);
 const daily=await fetchCourseHistoricalWeekNormals(course,["2026-12-15"],fetchImpl,now);
 assert.equal(calls,1);
 assert.equal(requestUrl.origin,"https://archive-api.open-meteo.com");
 assert.equal(requestUrl.searchParams.get("models"),"era5");
 assert.equal(requestUrl.searchParams.get("start_date"),"1991-01-01");
 assert.equal(requestUrl.searchParams.get("end_date"),"2020-12-31");
 for(const field of ["dew_point_2m_mean","relative_humidity_2m_mean","wind_speed_10m_mean","precipitation_sum"]) {
  assert.ok(requestUrl.searchParams.get("daily").includes(field));
 }
 assert.equal(monthly.monthly[11].years,2);
 assert.equal(daily.startYear,1991);
 assert.equal(daily.endYear,2020);
 assert.equal(daily.days[0].sampleYears,2);
 assert.equal(daily.days[0].highMean,24);
 assert.equal(daily.days[0].lowMean,17);
 assert.equal(daily.days[0].rainFrequency,50);
 assert.ok(Number.isFinite(daily.days[0].feelsLikeMinMeanC));
 assert.ok(Number.isFinite(daily.days[0].feelsLikeMaxMeanC));
 assert.equal(daily.days[0].feelsLikeSampleYears,2);
});
