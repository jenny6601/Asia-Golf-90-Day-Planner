import test from "node:test";
import assert from "node:assert/strict";
import {OKINAWA_COURSES} from "../assets/js/okinawa-courses.js";
import {fetchCourseForecast} from "../assets/js/weather-api.js";

const expected = {
 "southern-links":[26.113785,127.739021],
 "palm-hills":[26.120580,127.699640],
 "pgm-okinawa":[26.455335,127.820344],
 "kise":[26.524228,127.939192],
 "atta-terrace":[26.499868,127.896002],
 "chura-orchard":[26.506260,127.895720]
};

test("Okinawa pilot catalog contains the six requested main-island courses",()=>{
 assert.equal(OKINAWA_COURSES.length,6);
 assert.deepEqual(OKINAWA_COURSES.map(x=>x.id),["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"]);
 assert.ok(OKINAWA_COURSES.every(x=>x.address.endsWith("Japan")));
});

test("all six courses preserve the user-provided Google Maps coordinates",()=>{
 for(const course of OKINAWA_COURSES){
  assert.deepEqual([course.latitude,course.longitude],expected[course.id],course.id);
  assert.equal(course.timezone,"Asia/Tokyo",course.id);
  assert.equal(course.coordinateStatus,"user_provided_google_maps",course.id);
 }
});

test("PGM now passes GPS validation and requests the exact user-provided point",async()=>{
 const course=OKINAWA_COURSES.find(x=>x.id==="pgm-okinawa"),urls=[];
 const mock=async url=>{
  urls.push(new URL(url));
  return {ok:true,json:async()=>({
   timezone:"Asia/Tokyo",latitude:course.latitude,longitude:course.longitude,
   daily:{time:["2026-11-23"],precipitation_sum:[0]},
   hourly:{time:["2026-11-23T06:00"],precipitation:[0]}
  })};
 };
 const result=await fetchCourseForecast([course],mock);
 assert.equal(urls.length,1);
 assert.equal(Number(urls[0].searchParams.get("latitude")),26.455335);
 assert.equal(Number(urls[0].searchParams.get("longitude")),127.820344);
 assert.equal(result.courses[0].course.id,"pgm-okinawa");
});

test("course forecast requests selected exact coordinates and returns course identity",async()=>{
 const course=OKINAWA_COURSES.find(x=>x.id==="southern-links"),urls=[];
 const mock=async url=>{
  urls.push(new URL(url));
  return {ok:true,json:async()=>({
   timezone:"Asia/Tokyo",latitude:course.latitude,longitude:course.longitude,
   daily:{time:["2026-11-23"],precipitation_sum:[0]},
   hourly:{time:["2026-11-23T06:00"],precipitation:[0]}
  })};
 };
 const result=await fetchCourseForecast([course],mock);
 assert.equal(urls.length,1);
 assert.equal(Number(urls[0].searchParams.get("latitude")),course.latitude);
 assert.equal(Number(urls[0].searchParams.get("longitude")),course.longitude);
 assert.equal(result.courses[0].course.id,course.id);
 assert.equal(result.timezone,"Asia/Tokyo");
});
