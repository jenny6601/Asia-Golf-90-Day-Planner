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
  assert.match(u.searchParams.get("daily"),/temperature_2m_max/);
  assert.match(u.searchParams.get("daily"),/sunshine_duration/);
  assert.match(u.searchParams.get("hourly"),/precipitation/);
  assert.match(u.searchParams.get("hourly"),/relative_humidity_2m/);
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
