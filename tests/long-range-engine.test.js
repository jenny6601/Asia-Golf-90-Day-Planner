import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLongRangeTripWindow,recommendLongRangeWindows} from "../assets/js/long-range-engine.js";
const points=(weeklyEfi=0.1,monthlyAnomaly=0)=>[
 {point:{id:"north",label:"北部"},weekly:{time:["2026-12-10","2027-01-10"],precipitation_efi:[weeklyEfi,weeklyEfi]},monthly:{time:["2027-01-01","2027-02-01","2027-03-01"],precipitation_mean:[100,100,100],precipitation_anomaly:[monthlyAnomaly,monthlyAnomaly,monthlyAnomaly]}},
 {point:{id:"central",label:"中部"},weekly:{time:["2026-12-10","2027-01-10"],precipitation_efi:[weeklyEfi,weeklyEfi]},monthly:{time:["2027-01-01","2027-02-01","2027-03-01"],precipitation_mean:[100,100,100],precipitation_anomaly:[monthlyAnomaly,monthlyAnomaly,monthlyAnomaly]}},
 {point:{id:"south",label:"南部"},weekly:{time:["2026-12-10","2027-01-10"],precipitation_efi:[weeklyEfi,weeklyEfi]},monthly:{time:["2027-01-01","2027-02-01","2027-03-01"],precipitation_mean:[100,100,100],precipitation_anomaly:[monthlyAnomaly,monthlyAnomaly,monthlyAnomaly]}}
];
test("17-46 day windows use weekly EFI as a qualitative signal",()=>{
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-15",referenceDate:"2026-11-23",points:points(.7,0)});
 assert.equal(r.status,"scored");
 assert.equal(r.tendencyRank,2);
 assert.match(r.interpretation,/不是逐日降雨預報/);
});
test("47-90 day windows use monthly anomaly ratios, not daily rain probability",()=>{
 const r=evaluateLongRangeTripWindow({tripStart:"2027-01-15",referenceDate:"2026-11-23",points:points(.1,30)});
 assert.equal(r.status,"scored");
 assert.equal(r.tendencyRank,3);
 assert.equal(r.rounds[0].rounds,undefined);
});
test("worst regional wet signal is retained instead of averaged away",()=>{
 const p=points(-.1,0);p[0].weekly.precipitation_efi=[.9,.9];
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-15",referenceDate:"2026-11-23",points:p});
 assert.equal(r.rounds[0].worstZone,"north");
 assert.equal(r.rounds[0].rank,3);
});
test("missing weekly/monthly evidence fails closed",()=>{
 const p=points();p[2].weekly.precipitation_efi=[];
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-15",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"insufficient-data");
});
test("long range recommendations are spaced and ranked by tendency tiers",()=>{
 const r=recommendLongRangeWindows({referenceDate:"2026-11-23",points:points(-.7, -30)});
 assert.ok(r.recommendations.length>0);
 assert.ok(r.recommendations.length<=3);
 assert.ok(r.recommendations.every(x=>x.tendencyRank===0));
 for(let i=1;i<r.recommendations.length;i++){
  const gap=(Date.parse(r.recommendations[i].tripStart+"T00:00:00Z")-Date.parse(r.recommendations[i-1].tripStart+"T00:00:00Z"))/86400000;
  assert.ok(gap>=5);
 }
});

test("weekly EFI is not carried beyond its seven-day coverage window",()=>{
 const p=points();
 p.forEach(x=>{x.weekly.time=["2026-12-01"];x.weekly.precipitation_efi=[.8]});
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-15",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"insufficient-data");
 assert.equal(r.rounds[0].status,"insufficient-data");
});
test("weekly EFI switches at the next weekly period boundary",()=>{
 const p=points();
 p.forEach(x=>{x.weekly.time=["2026-12-10","2026-12-17"];x.weekly.precipitation_efi=[.8,-.6]});
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-15",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"scored");
 assert.equal(r.rounds[0].regional[0].signal.period,"2026-12-17");
 assert.equal(r.rounds[0].regional[0].signal.rank,0);
});
test("a trip crossing a calendar month uses each golf day's own monthly anomaly",()=>{
 const p=points();
 p.forEach(x=>{
  x.monthly.time=["2027-01-01","2027-02-01"];
  x.monthly.precipitation_mean=[100,100];
  x.monthly.precipitation_anomaly=[30,-30];
 });
 const r=evaluateLongRangeTripWindow({tripStart:"2027-01-30",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"scored");
 assert.equal(r.rounds[0].date,"2027-01-31");
 assert.equal(r.rounds[0].regional[0].signal.rank,3);
 assert.equal(r.rounds[1].date,"2027-02-01");
 assert.equal(r.rounds[1].regional[0].signal.rank,0);
 assert.equal(r.rounds[1].regional[0].signal.period,"2027-02-01");
});
test("a three-round trip crossing lead day 46 to 47 switches weekly to monthly evidence",()=>{
 const p=points();
 p.forEach(x=>{
  x.weekly.time=["2027-01-06","2027-01-13"];
  x.weekly.precipitation_efi=[-.6,-.6];
  x.monthly.time=["2027-01-01"];
  x.monthly.precipitation_mean=[100];
  x.monthly.precipitation_anomaly=[30];
 });
 const r=evaluateLongRangeTripWindow({tripStart:"2027-01-06",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"scored");
 assert.deepEqual(r.rounds.map(x=>x.date),["2027-01-07","2027-01-08","2027-01-09"]);
 assert.deepEqual(r.rounds.map(x=>x.regional[0].signal.period),["2027-01-06","2027-01-06","2027-01-01"]);
 assert.deepEqual(r.rounds.map(x=>x.regional[0].signal.rank),[0,0,3]);
});
