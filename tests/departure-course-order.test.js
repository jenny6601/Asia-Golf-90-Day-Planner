import test from "node:test";
import assert from "node:assert/strict";
import {orderCoursesByPriority,normalizeDepartureRegion} from "../assets/js/departure-course-order.js";

test("selected subregion courses appear first while all other regional courses remain in original order",()=>{
 const courses=[{id:"north-a"},{id:"south-a"},{id:"central-a"},{id:"north-b"},{id:"south-b"}];
 const ordered=orderCoursesByPriority(courses,["south-b","south-a"]);
 assert.deepEqual(ordered.map(x=>x.id),["south-b","south-a","north-a","central-a","north-b"]);
 assert.equal(ordered.length,courses.length);
});

test("empty subregion preference preserves the original course order",()=>{
 const courses=[{id:"a"},{id:"b"},{id:"c"}];
 assert.deepEqual(orderCoursesByPriority(courses,[]),courses);
});

test("Japan Okinawa subregion context maps to the runtime course catalog region",()=>{
 assert.equal(normalizeDepartureRegion("JP","沖繩"),"Okinawa");
 assert.equal(normalizeDepartureRegion("JP","Okinawa"),"Okinawa");
 assert.equal(normalizeDepartureRegion("JP","北海道"),"北海道");
 assert.equal(normalizeDepartureRegion("KR","沖繩"),"沖繩");
});