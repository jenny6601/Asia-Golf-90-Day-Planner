import test from "node:test";
import assert from "node:assert/strict";
import {groupCoursesByWeatherRegion,findCourseWeatherRegion} from "../assets/js/regional-weather.js";

const courses=[
 {id:"kise",countryCode:"JP",weatherRegionId:"JP-OKINAWA-NORTH",weatherRegionLabel:"沖繩北部區域",latitude:26.5,longitude:127.9},
 {id:"atta",countryCode:"JP",weatherRegionId:"JP-OKINAWA-NORTH",weatherRegionLabel:"沖繩北部區域",latitude:26.4,longitude:127.8},
 {id:"southern",countryCode:"JP",weatherRegionId:"JP-OKINAWA-SOUTH",weatherRegionLabel:"沖繩南部區域",latitude:null,longitude:null}
];

test("nearby courses share one explicit regional weather group",()=>{
 const groups=groupCoursesByWeatherRegion(courses);
 const north=groups.find(x=>x.weatherRegionId==="JP-OKINAWA-NORTH");
 assert.equal(north.courseCount,2);
 assert.deepEqual(north.courseIds,["kise","atta"]);
 assert.equal(groups.length,2);
});
test("selected course resolves to region without requiring coordinates",()=>{
 const region=findCourseWeatherRegion("southern",courses);
 assert.equal(region.weatherRegionId,"JP-OKINAWA-SOUTH");
 assert.deepEqual(region.courseIds,["southern"]);
});
test("missing region assignment fails closed rather than guessing from GPS",()=>{
 assert.throws(()=>groupCoursesByWeatherRegion([{id:"x",countryCode:"JP",latitude:1,longitude:2}]),/weatherRegionId/);
});
test("a region cannot mix countries or conflicting labels",()=>{
 assert.throws(()=>groupCoursesByWeatherRegion([
  {id:"a",countryCode:"JP",weatherRegionId:"shared",weatherRegionLabel:"北區"},
  {id:"b",countryCode:"KR",weatherRegionId:"shared",weatherRegionLabel:"北區"}
 ]),/cannot span countries/);
 assert.throws(()=>groupCoursesByWeatherRegion([
  {id:"a",countryCode:"JP",weatherRegionId:"shared",weatherRegionLabel:"北區"},
  {id:"b",countryCode:"JP",weatherRegionId:"shared",weatherRegionLabel:"南區"}
 ]),/inconsistent/);
});
test("duplicate course IDs are rejected",()=>{
 assert.throws(()=>groupCoursesByWeatherRegion([
  {id:"a",countryCode:"JP",weatherRegionId:"x"},
  {id:"a",countryCode:"JP",weatherRegionId:"x"}
 ]),/duplicate course id/);
});
