import test from "node:test";
import assert from "node:assert/strict";
import {buildTripDateEngineInput,groupCourseHistoricalNormals,TRIP_DATE_SOURCE_ADAPTERS} from "../assets/js/trip-date-source-adapters.js";

const asOf="2026-11-27";
const addDays=(date,n)=>new Date(Date.parse(date+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
const regions=["north","central","south"];
const forecastZones=regions.map(id=>({
  zone:{id},
  daily:{time:Array.from({length:16},(_,i)=>addDays(asOf,i+1)),
    precipitation_probability_max:Array(16).fill(30),
    precipitation_sum:Array(16).fill(2)}
}));
const longRangePoints=regions.map(id=>({
  point:{id},
  weekly:{time:["2026-12-14"],precipitation_efi:[-0.6],precipitation_mean:[12],precipitation_anomaly:[-3]},
  monthly:{time:["2026-12-01","2027-01-01","2027-02-01"],precipitation_mean:[70,80,120],precipitation_anomaly:[-5,-10,20]}
}));
const historicalByRegion=Object.fromEntries(regions.map(id=>[id,Array.from({length:90},(_,i)=>({
  date:addDays(asOf,i+1),
  courseNormals:[{rainFrequency:25,rainMean:1.5,rainSampleYears:10}]
}))]));

test("uses only the fixed north/central/south regions and course counts",()=>{
  assert.deepEqual(TRIP_DATE_SOURCE_ADAPTERS.regions,regions);
  assert.deepEqual(TRIP_DATE_SOURCE_ADAPTERS.representativeCourseByRegion,{north:"kise",central:"pgm-okinawa",south:"southern-links"});
});

test("maps short forecast, EC46 weekly EFI, SEAS5 monthly anomaly and historical signals",()=>{
  const input=buildTripDateEngineInput({asOf,forecastZones,longRangePoints,historicalByRegion});
  assert.equal(input.days.length,90);
  const d1=input.days[0].regions.north;
  assert.ok(d1.forecast);
  assert.equal(d1.forecast.riskScore,26.5);
  assert.ok(d1.historical);
  assert.equal(d1.ec46,undefined);
  const d20=input.days[19].regions.north;
  assert.ok(d20.ec46);
  assert.ok(d20.seas5);
  assert.equal(d20.ec46.method,"weekly-precipitation-efi-relative-risk-index");
  assert.equal(d20.ec46.riskScore,20);
  assert.equal(d20.seas5.method,"monthly-seas5-precipitation-anomaly-ratio-index");
  const d60=input.days[59].regions.north;
  assert.ok(d60.seas5);
  assert.equal(d60.seas5.method,"monthly-seas5-precipitation-anomaly-ratio-index");
});

test("does not fabricate stability when fewer than two forecast snapshots exist",()=>{
  const input=buildTripDateEngineInput({asOf,forecastZones,longRangePoints,historicalByRegion});
  assert.equal(input.days[0].regions.north.stability,undefined);
});

test("derives instability from actual forecast-run spread and exposes direction",()=>{
  const snapshots=[10,25,45].map((riskScore,i)=>({
    fetchedAt:"2026-11-2"+(7+i)+"T00:00:00Z",
    regions:Object.fromEntries(regions.map(region=>[region,[{date:addDays(asOf,1),riskScore}]]))
  }));
  const input=buildTripDateEngineInput({asOf,forecastZones,longRangePoints,historicalByRegion,stabilitySnapshots:snapshots});
  const stability=input.days[0].regions.north.stability;
  assert.equal(stability.riskScore,35);
  assert.equal(stability.runCount,3);
  assert.equal(stability.direction,"wetter");
  assert.equal(stability.coverage,1);
});

test("missing forecast fields stay missing and reduce source coverage",()=>{
  const broken=forecastZones.map(x=>({...x,daily:{...x.daily,precipitation_sum:[]}}));
  const input=buildTripDateEngineInput({asOf,forecastZones:broken,longRangePoints,historicalByRegion});
  assert.equal(input.days[0].regions.north.forecast.coverage,0.5);
  assert.equal(input.days[0].regions.north.forecast.rainMm,null);
});

test("invalid dates fail closed",()=>{
  assert.throws(()=>buildTripDateEngineInput({asOf:"2026-02-30"}),/valid YYYY-MM-DD/);
});

test("uses exactly one representative course per region; other same-region courses are ignored",()=>{
  const ids=["southern-links","palm-hills","pgm-okinawa","kise","atta-terrace","chura-orchard"];
  const results=ids.map(courseId=>({
    course:{id:courseId},
    days:[{date:addDays(asOf,60),rainFrequency:30,rainMean:2,rainSampleYears:10}]
  }));
  const grouped=groupCourseHistoricalNormals(results);
  assert.deepEqual(grouped.north[0].courseNormals.map(x=>x.courseId),["kise"]);
  assert.deepEqual(grouped.central[0].courseNormals.map(x=>x.courseId),["pgm-okinawa"]);
  assert.deepEqual(grouped.south[0].courseNormals.map(x=>x.courseId),["southern-links"]);
  assert.equal(grouped.north[0].courseNormals.length,3);
  assert.equal(grouped.central[0].courseNormals.length,1);
  assert.equal(grouped.south[0].courseNormals.length,2);
  const input=buildTripDateEngineInput({asOf,forecastZones,longRangePoints,historicalCourseResults:results});
  assert.equal(input.days[59].regions.north.historical.validCourseCount,1);
  assert.equal(input.days[59].regions.north.historical.representativeCourseId,"kise");
  assert.equal(input.days[59].regions.north.historical.coverage,1);
});
