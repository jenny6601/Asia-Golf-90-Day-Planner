import test from "node:test";
import assert from "node:assert/strict";
import {OKINAWA_COURSES} from "../assets/js/okinawa-courses.js";
import {fetchCourseForecast} from "../assets/js/weather-api.js";

test("Okinawa pilot catalog contains the six requested main-island courses",()=>{
 assert.equal(OKINAWA_COURSES.length,6);
 assert.deepEqual(OKINAWA_COURSES.map(x=>x.id),["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"]);
 assert.ok(OKINAWA_COURSES.every(x=>x.address.endsWith("Japan")));
});
test("pending GPS without numeric coordinates fails closed",async()=>{
 const southern=OKINAWA_COURSES.find(x=>x.id==="southern-links");
 const pending={...southern,id:"pending-test",name:"Pending GPS test",latitude:null,longitude:null,coordinateStatus:"pending"};
 await assert.rejects(fetchCourseForecast([pending],async()=>({ok:true,json:async()=>({})})),/GPS 座標核實/);
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
