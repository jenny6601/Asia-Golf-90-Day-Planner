import test from "node:test";
import assert from "node:assert/strict";
import {scoreFiveDayItinerary} from "../assets/js/itinerary-engine.js";

function course(id,name,probability=0,amount=0){
 return {course:{id,name,area:"測試區"},hourly:{
  time:Array.from({length:24*10},(_,i)=>{const d=new Date(Date.UTC(2026,10,20)+i*3600000);return d.toISOString().slice(0,16)}),
  precipitation_probability:Array(24*10).fill(probability),
  precipitation:Array(24*10).fill(amount)
 }};
}
test("five-day itinerary assigns rounds to Day 2, 3 and 4 and travel to Day 1 and 5",()=>{
 const r=scoreFiveDayItinerary({tripStart:"2026-11-23",courses:[course("a","A"),course("b","B"),course("c","C")]});
 assert.equal(r.status,"scored");
 assert.equal(r.tripEnd,"2026-11-27");
 assert.deepEqual(r.rounds.map(x=>x.date),["2026-11-24","2026-11-25","2026-11-26"]);
 assert.deepEqual(r.travelDays.map(x=>x.date),["2026-11-23","2026-11-27"]);
 assert.equal(r.itineraryRisk,0);
});
test("itinerary risk includes worst round so a single wet day is not hidden by average",()=>{
 const r=scoreFiveDayItinerary({tripStart:"2026-11-23",courses:[course("a","A",0,0),course("b","B",90,2),course("c","C",0,0)]});
 assert.ok(r.worstRoundRisk>r.averageRoundRisk);
 assert.ok(r.itineraryRisk>r.averageRoundRisk);
 assert.equal(r.worstRound.round,2);
});
test("missing hourly data prevents an itinerary score",()=>{
 const c=course("a","A");c.hourly.time=c.hourly.time.slice(0,10);
 const r=scoreFiveDayItinerary({tripStart:"2026-11-23",courses:[c,course("b","B"),course("c","C")]});
 assert.equal(r.status,"insufficient-data");
 assert.equal(r.itineraryRisk,null);
 assert.equal(r.missingRounds,1);
});
test("exactly three courses and valid tee hour are required",()=>{
 assert.throws(()=>scoreFiveDayItinerary({tripStart:"2026-11-23",courses:[course("a","A")]}),/Exactly three/);
 assert.throws(()=>scoreFiveDayItinerary({tripStart:"2026-11-23",courses:[course("a","A"),course("b","B"),course("c","C")],teeHour:15}),/teeHour/);
});

import {recommendFiveDayWindows} from "../assets/js/itinerary-engine.js";

test("date recommender ranks only complete real forecast windows and separates recommendations",()=>{
 const makeCourse=(id,wetDates=[])=>{
  const time=Array.from({length:24*16},(_,i)=>new Date(Date.UTC(2026,10,23)+i*3600000).toISOString().slice(0,16));
  const probability=time.map(t=>wetDates.includes(t.slice(0,10))?90:5);
  const precipitation=time.map(t=>wetDates.includes(t.slice(0,10))?2:0);
  return {course:{id,name:id,area:"test"},hourly:{time,precipitation_probability:probability,precipitation}};
 };
 const courses=[makeCourse("A",["2026-11-26"]),makeCourse("B"),makeCourse("C")];
 const result=recommendFiveDayWindows({courses,teeHour:7});
 assert.ok(result.candidateCount>0);
 assert.ok(result.recommendations.length>0);
 assert.ok(result.recommendations.length<=3);
 assert.ok(result.recommendations.every(x=>x.status==="scored"&&x.confidence==="medium"));
 for(let i=1;i<result.recommendations.length;i++){
  const gap=(Date.parse(result.recommendations[i].tripStart+"T00:00:00Z")-Date.parse(result.recommendations[i-1].tripStart+"T00:00:00Z"))/86400000;
  assert.ok(gap>=5);
 }
});
test("date recommender does not create recommendations when no complete golf-day windows exist",()=>{
 const c={course:{id:"A",name:"A"},hourly:{time:["2026-11-23T07:00"],precipitation_probability:[0],precipitation:[0]}};
 const result=recommendFiveDayWindows({courses:[c,c,c]});
 assert.equal(result.recommendations.length,0);
});


test("itinerary score uses 70% mean round risk and 30% worst round risk",()=>{
 const r=scoreFiveDayItinerary({tripStart:"2026-11-23",courses:[
  course("a","A",5,0),course("b","B",90,2),course("c","C",20,0)
 ]});
 const expected=Math.round((0.7*r.averageRoundRisk+0.3*r.worstRoundRisk)*10)/10;
 assert.equal(r.itineraryRisk,expected);
 assert.equal(r.worstRound.courseId,"b");
});

test("round dates remain attached to the selected course order",()=>{
 const r=scoreFiveDayItinerary({tripStart:"2026-11-23",courses:[
  course("south","Southern Links"),course("north","Kise"),course("central","Atta Terrace")
 ]});
 assert.deepEqual(r.rounds.map(x=>[x.courseId,x.date]),[
  ["south","2026-11-24"],["north","2026-11-25"],["central","2026-11-26"]
 ]);
});

test("rain itinerary remains scoreable when separate playability fields are missing",()=>{
 const r=scoreFiveDayItinerary({tripStart:"2026-11-23",courses:[
  course("a","A"),course("b","B"),course("c","C")
 ]});
 assert.equal(r.status,"scored");
 assert.equal(r.scoredRounds,3);
 assert.ok(r.rounds.every(x=>x.suitability.status==="insufficient-data"));
});

test("date recommendations begin with the lowest rain-impact itinerary",()=>{
 const makeCourse=(id,wetDates=[])=>{
  const time=Array.from({length:24*16},(_,i)=>new Date(Date.UTC(2026,10,23)+i*3600000).toISOString().slice(0,16));
  const wet=time.map(t=>wetDates.includes(t.slice(0,10)));
  return {course:{id,name:id,area:"test"},hourly:{
   time,precipitation_probability:wet.map(v=>v?95:5),precipitation:wet.map(v=>v?2:0)
  }};
 };
 const courses=[makeCourse("A",["2026-11-26","2026-11-27"]),makeCourse("B"),makeCourse("C")];
 const result=recommendFiveDayWindows({courses,teeHour:7,limit:3,minStartGap:5});
 assert.ok(result.scoredCount>0);
 assert.equal(result.recommendations[0].itineraryRisk,result.all.filter(x=>x.status==="scored").sort((a,b)=>a.itineraryRisk-b.itineraryRisk||a.tripStart.localeCompare(b.tripStart))[0].itineraryRisk);
 assert.ok(result.recommendations.every(x=>x.rounds.length===3&&x.scoredRounds===3));
});
