import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLongRangeTripWindow,recommendLongRangeWindows} from "../assets/js/long-range-engine.js";
const points=(weeklyEfi=0.1,monthlyAnomaly=0)=>[
 {point:{id:"north",label:"北部"},weekly:{time:["2026-12-10","2027-01-10"],precipitation_efi:[weeklyEfi,weeklyEfi]},monthly:{time:["2027-01-01","2027-02-01","2027-03-01"],precipitation_mean:[100,100,100],precipitation_anomaly:[monthlyAnomaly,monthlyAnomaly,monthlyAnomaly]}},
 {point:{id:"central",label:"中部"},weekly:{time:["2026-12-10","2027-01-10"],precipitation_efi:[weeklyEfi,weeklyEfi]},monthly:{time:["2027-01-01","2027-02-01","2027-03-01"],precipitation_mean:[100,100,100],precipitation_anomaly:[monthlyAnomaly,monthlyAnomaly,monthlyAnomaly]}},
 {point:{id:"south",label:"南部"},weekly:{time:["2026-12-10","2027-01-10"],precipitation_efi:[weeklyEfi,weeklyEfi]},monthly:{time:["2027-01-01","2027-02-01","2027-03-01"],precipitation_mean:[100,100,100],precipitation_anomaly:[monthlyAnomaly,monthlyAnomaly,monthlyAnomaly]}}
];
test("17-46 day windows use weekly EFI as a qualitative signal",()=>{
 const p=points(.7,0);
 p.forEach(x=>{x.weekly.time=["2026-12-10","2026-12-17"];x.weekly.precipitation_efi=[.7,.7];});
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-15",referenceDate:"2026-11-23",points:p});
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
 const p=points(-.1,0);p.forEach(x=>{x.weekly.time=["2026-12-10","2026-12-17"];x.weekly.precipitation_efi=[-.1,-.1];});p[0].weekly.precipitation_efi=[.9,.9];
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

test("weekly EFI is not carried beyond its seven-day bucket",()=>{
 const p=points(.2,0);
 p.forEach(x=>{x.weekly.time=["2026-12-10"];x.weekly.precipitation_efi=[.2];});
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-20",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"insufficient-data");
 assert.ok(r.rounds.every(x=>x.status==="insufficient-data"));
});
test("cross-month golf dates require monthly evidence for each actual golf month",()=>{
 const p=points(.1,0);
 p.forEach(x=>{
  x.monthly.time=["2027-01-01"];
  x.monthly.precipitation_mean=[100];
  x.monthly.precipitation_anomaly=[0];
 });
 const r=evaluateLongRangeTripWindow({tripStart:"2027-01-30",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"insufficient-data");
 assert.deepEqual(r.missingDates,["2027-02-01","2027-02-02"]);
});
test("46-to-47-day boundary switches from weekly EFI to monthly anomaly by golf date",()=>{
 const p=points(.2,0);
 p.forEach(x=>{
  x.weekly.time=["2027-01-08"];
  x.weekly.precipitation_efi=[.2];
  x.monthly.time=["2027-01-01","2027-02-01"];
  x.monthly.precipitation_mean=[100,100];
  x.monthly.precipitation_anomaly=[0,0];
 });
 const r=evaluateLongRangeTripWindow({tripStart:"2027-01-07",referenceDate:"2026-11-23",points:p});
 assert.equal(r.rounds[0].date,"2027-01-08");
 assert.equal(r.rounds[0].status,"scored");
 assert.equal(r.rounds[1].date,"2027-01-09");
 assert.equal(r.rounds[1].status,"scored");
 assert.equal(r.rounds[2].date,"2027-01-10");
 assert.equal(r.rounds[2].status,"scored");
 assert.equal(r.rounds[0].rounds,undefined);
 assert.equal(r.rounds[0].regional[0].signal.period,"2027-01-08");
 assert.equal(r.rounds[1].regional[0].signal.period,"2027-01-01");
});

test("duplicate returned grid cells are not double-weighted",()=>{
 const p=points(.2,0);
 p[0].latitude=26.5;p[0].longitude=127.9;
 p[1].latitude=26.2;p[1].longitude=127.8;
 p[2].latitude=26.2;p[2].longitude=127.8;
 p.forEach(x=>{x.weekly.time=["2026-12-10","2026-12-17"];x.weekly.precipitation_efi=[.2,.2];});
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-15",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"scored");
 assert.equal(r.regionalSampleCount,2);
 assert.equal(r.rounds[0].regional.length,2);
});

test("spatial coverage is reported separately from temporal confidence",()=>{
 const p=points(.2,0);
 p[0].latitude=26.5;p[0].longitude=127.9;
 p[1].latitude=26.2;p[1].longitude=127.8;
 p[2].latitude=26.2;p[2].longitude=127.8;
 p.forEach(x=>{x.weekly.time=["2026-12-10","2026-12-17"];x.weekly.precipitation_efi=[.2,.2];});
 const r=evaluateLongRangeTripWindow({tripStart:"2026-12-15",referenceDate:"2026-11-23",points:p});
 assert.equal(r.status,"scored");
 assert.equal(r.temporalConfidence,r.confidence);
 assert.equal(r.spatialConfidence,"有限");
 assert.match(r.spatialWarning,/空間證據有限/);
});

\ntest("coverage accounting separates fully scored windows from missing evidence",()=>{
 const p=points(.1,0);
 p.forEach(x=>{
  x.weekly.time=["2026-12-10","2026-12-17","2026-12-24"];
  x.weekly.precipitation_efi=[.1,.1,.1];
  x.monthly.time=["2027-01-01"];
  x.monthly.precipitation_mean=[100];
  x.monthly.precipitation_anomaly=[0];
 });
 const r=recommendLongRangeWindows({referenceDate:"2026-11-23",points:p});
 assert.equal(r.candidateCount,r.scoredCount+r.missingCount);
 assert.equal(r.coverageRate,Number((r.scoredCount/r.candidateCount).toFixed(3)));
 assert.ok(r.scoredCount>0);
 assert.ok(r.missingCount>0);
 assert.ok(r.recommendations.every(x=>x.status==="scored"));
 assert.ok(r.recommendations.every(x=>x.rounds.length===3&&x.rounds.every(round=>round.status==="scored")));
});

test("no-data horizon reports zero coverage and no recommendations",()=>{
 const p=points();
 p.forEach(x=>{
  x.weekly={time:[],precipitation_efi:[]};
  x.monthly={time:[],precipitation_mean:[],precipitation_anomaly:[]};
 });
 const r=recommendLongRangeWindows({referenceDate:"2026-11-23",points:p});
 assert.equal(r.coverageRate,0);
 assert.equal(r.scoredCount,0);
 assert.equal(r.missingCount,r.candidateCount);
 assert.deepEqual(r.recommendations,[]);
});
