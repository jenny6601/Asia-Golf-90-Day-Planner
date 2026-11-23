import test from "node:test";
import assert from "node:assert/strict";
import {fetchOkinawaLongRange,interpretPrecipitationEfi} from "../assets/js/long-range-api.js";

test("long-range adapter requests weekly and monthly ECMWF seasonal diagnostics for three Okinawa zones",async()=>{
 const urls=[];
 const mock=async url=>{
  urls.push(new URL(url));
  return {ok:true,json:async()=>({
   timezone:"Asia/Tokyo",latitude:26.5,longitude:127.8,
   weekly:{time:["2026-12-14"],precipitation_efi:[0.2],precipitation_anomaly_gt0:[55]},
   monthly:{time:["2027-01-01"],precipitation_anomaly:[3.2]}
  })};
 };
 const result=await fetchOkinawaLongRange(mock);
 assert.equal(urls.length,3);
 assert.deepEqual(result.points.map(x=>x.point.id),["north","central","south"]);
 for(const u of urls){
  assert.equal(u.origin,"https://seasonal-api.open-meteo.com");
  assert.equal(u.searchParams.get("forecast_days"),"90");
  assert.equal(u.searchParams.get("timezone"),"Asia/Tokyo");
  assert.equal(u.searchParams.get("models"),"ecmwf_seasonal_seamless");
  assert.match(u.searchParams.get("weekly"),/precipitation_efi/);
  assert.match(u.searchParams.get("weekly"),/precipitation_anomaly_gt0/);
  assert.match(u.searchParams.get("monthly"),/precipitation_anomaly/);
 }
});
test("long-range adapter fails closed on provider errors",async()=>{
 await assert.rejects(fetchOkinawaLongRange(async()=>({ok:false,status:502})),/API HTTP 502/);
});
test("EFI is interpreted as a qualitative anomaly signal, not probability",()=>{
 assert.equal(interpretPrecipitationEfi(0.9).tone,"wet");
 assert.equal(interpretPrecipitationEfi(-0.7).tone,"dry");
 assert.equal(interpretPrecipitationEfi(0.1).tone,"neutral");
 assert.equal(interpretPrecipitationEfi(null).tone,"unknown");
});

test("live payload audit reports whether all three zones are scoreable",async()=>{
 const mock=async url=>{
  const u=new URL(url);
  const isNorth=u.searchParams.get("latitude")==="26.5916";
  return {ok:true,json:async()=>({
   timezone:"Asia/Tokyo",latitude:Number(u.searchParams.get("latitude")),longitude:Number(u.searchParams.get("longitude")),
   weekly:{time:["2026-12-01","2026-12-08"],precipitation_efi:isNorth?[0.2,0.3]:[null,null],precipitation_mean:[20,22],precipitation_anomaly:[1,2]},
   monthly:{time:["2027-01-01"],precipitation_mean:[100],precipitation_anomaly:[5]}
  })};
 };
 const r=await fetchOkinawaLongRange(mock);
 assert.equal(r.dataQuality.zoneCount,3);
 assert.equal(r.dataQuality.readyForMonthlyScoring,true);
 assert.equal(r.dataQuality.readyForWeeklyScoring,false);
 assert.ok(r.dataQuality.warnings.some(x=>x.includes("中部")||x.includes("南部")));
});
test("live payload audit flags mismatched arrays instead of treating them as complete",async()=>{
 const mock=async()=>({ok:true,json:async()=>({
  timezone:"Asia/Tokyo",
  weekly:{time:["2026-12-01","2026-12-08"],precipitation_efi:[0.1]},
  monthly:{time:["2027-01-01"],precipitation_mean:[100],precipitation_anomaly:[0]}
 })});
 const r=await fetchOkinawaLongRange(mock);
 assert.equal(r.dataQuality.readyForWeeklyScoring,false);
 assert.equal(r.dataQuality.readyForMonthlyScoring,true);
 assert.ok(r.points.every(x=>x.dataQuality.warnings.length>0));
});
test("malformed time coordinates are rejected",async()=>{
 const mock=async()=>({ok:true,json:async()=>({
  weekly:{time:["not-a-date"],precipitation_efi:[0.1]},
  monthly:{time:["2027-01-01"],precipitation_mean:[100],precipitation_anomaly:[0]}
 })});
 await assert.rejects(fetchOkinawaLongRange(mock),/日期格式錯誤/);
});

test("field audit distinguishes partial availability from complete coverage",async()=>{
 const mock=async()=>({ok:true,json:async()=>({
  timezone:"Asia/Tokyo",
  weekly:{time:["2026-12-01","2026-12-08"],precipitation_efi:[0.1,null],precipitation_mean:[20,null],precipitation_anomaly:[1,null]},
  monthly:{time:["2027-01-01","2027-02-01"],precipitation_mean:[100,100],precipitation_anomaly:[5,5]}
 })});
 const r=await fetchOkinawaLongRange(mock);
 assert.equal(r.points[0].dataQuality.weekly.fields.precipitation_efi.available,true);
 assert.equal(r.points[0].dataQuality.weekly.fields.precipitation_efi.complete,false);
 assert.equal(r.points[0].dataQuality.weekly.fields.precipitation_efi.coverage,0.5);
 assert.equal(r.points[0].dataQuality.monthly.fields.precipitation_mean.complete,true);
 assert.equal(r.dataQuality.weeklyCoverageComplete,false);
 assert.equal(r.dataQuality.monthlyCoverageComplete,true);
});

test("duplicate returned grid cells are detected as one spatial sample",async()=>{
 const mock=async url=>{
  const u=new URL(url),isNorth=u.searchParams.get("latitude")==="26.5916";
  return {ok:true,json:async()=>({
   timezone:"Asia/Tokyo",latitude:isNorth?26.557377:26.276346,longitude:isNorth?127.95652:127.792206,
   weekly:{time:["2026-12-01"],precipitation_efi:[0.2],precipitation_mean:[20],precipitation_anomaly:[1]},
   monthly:{time:["2027-01-01"],precipitation_mean:[100],precipitation_anomaly:[5]}
  })};
 };
 const r=await fetchOkinawaLongRange(mock);
 assert.equal(r.dataQuality.uniqueGridCellCount,2);
 assert.equal(r.dataQuality.spatiallyDistinct,false);
 assert.ok(r.dataQuality.warnings.some(x=>x.includes("不能視為三份獨立區域證據")));
});
