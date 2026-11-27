import test from "node:test";
import assert from "node:assert/strict";
import {fetchCourseHistoricalMonthlyClimate,fetchCourseHistoricalWeekNormals} from "../assets/js/long-range-api.js";

test("monthly and 31-day historical normals share one complete 1991-2020 ERA5 archive request",async()=>{
 let calls=0,requestUrl=null;
 const dates=[];
 for(const year of [1991,2020]){
  for(let day=1;day<=31;day++)dates.push(year+"-12-"+String(day).padStart(2,"0"));
 }
 const fetchImpl=async url=>{
  calls++;requestUrl=new URL(url);
  return {ok:true,json:async()=>({daily:{
   time:dates,
   temperature_2m_max:dates.map((_,i)=>i<31?23:25),
   temperature_2m_min:dates.map((_,i)=>i<31?16:18),
   dew_point_2m_mean:dates.map((_,i)=>i<31?14:16),
   relative_humidity_2m_mean:dates.map((_,i)=>i<31?70:74),
   wind_speed_10m_mean:dates.map((_,i)=>i<31?2:3),
   wind_speed_10m_max:dates.map((_,i)=>i<31?4:5),
   precipitation_sum:dates.map((_,i)=>i<31?0:4),
   precipitation_hours:dates.map((_,i)=>i<31?0:3),
   weather_code:dates.map((_,i)=>i<31?1:61)
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
 assert.equal(requestUrl.searchParams.get("wind_speed_unit"),"ms");
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

test("a rolling window with less than 90 percent valid daily values is excluded",async()=>{
 const dates=["2016-12-01","2016-12-02","2016-12-03","2016-12-04","2016-12-05"];
 const fetchImpl=async()=>({ok:true,json:async()=>({daily:{
  time:dates,temperature_2m_max:[23,23,23,23,23],temperature_2m_min:[16,16,16,16,16],
  dew_point_2m_mean:[14,14,14,14,14],relative_humidity_2m_mean:[70,70,70,70,70],
  wind_speed_10m_mean:[2,2,2,2,2],wind_speed_10m_max:[4,4,4,4,4],
  precipitation_sum:[0,0,0,0,0],precipitation_hours:[0,0,0,0,0],weather_code:[1,1,1,1,1]
 }})});
 const course={id:"short-window",latitude:25.1,longitude:121.5,timezone:"Asia/Taipei"};
 const result=await fetchCourseHistoricalWeekNormals(course,["2016-12-03"],fetchImpl);
 assert.equal(result.days[0].rainMean,null);
 assert.equal(result.days[0].highMean,null);
 assert.equal(result.days[0].feelsLikeMaxMeanC,null);
});
