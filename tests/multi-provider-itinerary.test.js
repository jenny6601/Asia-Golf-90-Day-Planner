import test from "node:test";
import assert from "node:assert/strict";
import {recommendMultiProviderFiveDayWindows} from "../assets/js/multi-provider-itinerary.js";
function course(id){
 const time=Array.from({length:24*16},(_,i)=>new Date(Date.UTC(2026,10,23)+i*3600000).toISOString().slice(0,16));
 const n=time.length;
 return {course:{id,name:id,timezone:"Asia/Tokyo"},hourly:{time,precipitation_probability:Array(n).fill(10),precipitation:Array(n).fill(0),temperature_2m:Array(n).fill(24),apparent_temperature:Array(n).fill(24),wind_speed_10m:Array(n).fill(3),wind_gusts_10m:Array(n).fill(4),weather_code:Array(n).fill(0)}};
}
function independent(c){
 const time=c.hourly.time;
 const forecast=time.map(t=>({time:t,prob:10,rain:0,temp:24,feels:24,wind:3,gust:4,period:1}));
 const days=[...new Set(time.map(t=>t.slice(0,10)))].map(date=>({
  date,
  hours:forecast.filter(h=>h.time.startsWith(date)).map(h=>({
   time:h.time,
   precipitationProbabilityPct:h.prob,
   precipitationMm:h.rain,
   temperatureC:h.temp,
   feelsLikeC:h.feels,
   windSpeedMs:h.wind,
   windGustMs:h.gust,
   precipitationAccumulationPeriodHours:h.period
  }))
 }));
 return {
  course:c.course,
  providers:{
   visualCrossing:{status:"available",data:{provider:"Visual Crossing",days}},
   foreca:{status:"unavailable",error:"not configured"}
  }
 };
}

test("ranks only complete 5-day windows with at least two providers per golf day",()=>{
 const courses=[course("a"),course("b"),course("c")];
 const providers=courses.map(independent);
 const result=recommendMultiProviderFiveDayWindows({courses,independentProviders:providers});
 assert.ok(result.candidateCount>0);assert.ok(result.scoredCount>0);assert.ok(result.recommendations.length>0);assert.equal(result.recommendations[0].rounds[0].score.providerCount,2);
});
test("does not treat a single provider as a multi-provider consensus",()=>{
 const courses=[course("a"),course("b"),course("c")];
 const result=recommendMultiProviderFiveDayWindows({courses,independentProviders:[]});
 assert.equal(result.recommendations.length,0);assert.equal(result.missingCount,result.candidateCount);
});

test("excludes a five-day window when any round has a severe thunderstorm signal",()=>{
 const courses=[course("a"),course("b"),course("c")];
 const targetDate="2026-11-25";
 const index=courses[1].hourly.time.findIndex(t=>t===targetDate+"T09:00");
 courses[1].hourly.weather_code[index]=95;
 const result=recommendMultiProviderFiveDayWindows({courses,independentProviders:courses.map(independent)});
 assert.equal(result.recommendations.some(x=>x.tripStart==="2026-11-23"),false);
 assert.ok(result.excludedSevereCount>0);
 assert.ok(result.all.some(x=>x.status==="excluded-severe-weather"));
});
