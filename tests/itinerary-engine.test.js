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
