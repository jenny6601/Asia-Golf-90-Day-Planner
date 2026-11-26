import test from "node:test";
import assert from "node:assert/strict";
import {evaluateRegionalGolfTrip,recommendRegionalGolfTrips} from "../assets/js/regional-trip-engine.js";

function regionWeather(regionId="VN-DA-NANG", efi=0.1, anomaly=0) {
 return {
  regionId, regionLabel:"峴港旅遊區域",
  weekly:{time:["2026-12-01","2026-12-08","2026-12-15","2026-12-22"],precipitation_efi:[efi,efi,efi,efi]},
  monthly:{time:["2027-01-01","2027-02-01","2027-03-01"],precipitation_mean:[100,100,100],precipitation_anomaly:[anomaly,anomaly,anomaly]}
 };
}

test("destination trip screening uses one regional signal, not three course points",()=>{
 const result=evaluateRegionalGolfTrip({tripStart:"2026-12-15",referenceDate:"2026-11-23",regionWeather:regionWeather("VN-HANOI",0.7)});
 assert.equal(result.status,"scored");
 assert.equal(result.regionId,"VN-HANOI");
 assert.equal(result.tripDays,5);
 assert.equal(result.nights,4);
 assert.equal(result.rounds.length,3);
 assert.equal(result.tendencyRank,2);
 assert.equal(result.confidence,"very-low");
 assert.match(result.interpretation,/不是逐日降雨預報/);
});

test("47-90 day destination screening uses monthly anomaly rather than daily rain probability",()=>{
 const result=evaluateRegionalGolfTrip({tripStart:"2027-01-15",referenceDate:"2026-11-23",regionWeather:regionWeather("VN-HO-CHI-MINH-CITY",0.1,30)});
 assert.equal(result.status,"scored");
 assert.ok(result.evidenceTypes.includes("monthly-precipitation-anomaly"));
 assert.equal(result.tendencyRank,3);
});

test("incomplete regional evidence fails closed",()=>{
 const weather=regionWeather();weather.monthly.precipitation_anomaly=[];
 const result=evaluateRegionalGolfTrip({tripStart:"2027-01-15",referenceDate:"2026-11-23",regionWeather:weather});
 assert.equal(result.status,"insufficient-data");
 assert.equal(result.score,null);
});

test("recommendations are regional 5-day trips with spacing and no false precision",()=>{
 const result=recommendRegionalGolfTrips({referenceDate:"2026-11-23",regionWeather:regionWeather("VN-DA-NANG",-0.7,-30)});
 assert.ok(result.candidateCount>0);
 assert.ok(result.recommendations.length>0);
 assert.ok(result.recommendations.every(x=>x.regionId==="VN-DA-NANG"&&x.tripDays===5&&x.nights===4&&x.confidence==="very-low"));
 for(let i=1;i<result.recommendations.length;i++){
  const gap=(Date.parse(result.recommendations[i].tripStart+"T00:00:00Z")-Date.parse(result.recommendations[i-1].tripStart+"T00:00:00Z"))/86400000;
  assert.ok(gap>=5);
 }
});

test("invalid golf-day offsets and invalid date windows are rejected",()=>{
 assert.throws(()=>evaluateRegionalGolfTrip({tripStart:"bad",referenceDate:"2026-11-23",regionWeather:regionWeather()}),/YYYY-MM-DD/);
 assert.throws(()=>evaluateRegionalGolfTrip({tripStart:"2026-12-15",referenceDate:"2026-11-23",regionWeather:regionWeather(),roundDayOffsets:[1,1,3]}),/distinct/);
});
