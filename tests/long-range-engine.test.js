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
