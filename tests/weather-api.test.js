import test from "node:test";
import assert from "node:assert/strict";
import {OKINAWA_ZONES,fetchOkinawa16DayForecast,fetchCourseForecast} from "../assets/js/weather-api.js";

test("Okinawa adapter requests three distinct representative zones", async () => {
  const urls=[];
  const mockFetch=async url=>{
    urls.push(new URL(url));
    return {ok:true,json:async()=>({
      timezone:"Asia/Tokyo",latitude:26.5,longitude:127.8,generationtime_ms:1.2,
      daily:{time:["2026-11-23"],precipitation_sum:[0],precipitation_probability_max:[10],temperature_2m_min:[20],temperature_2m_max:[25],wind_speed_10m_max:[5]},
      hourly:{time:["2026-11-23T00:00"],temperature_2m:[22]}
    })};
  };
  const result=await fetchOkinawa16DayForecast(mockFetch);
  assert.equal(urls.length,3);
  assert.equal(result.zones.length,3);
  assert.deepEqual(result.zones.map(x=>x.zone.id),["north","central","south"]);
  for(const url of urls){
    assert.equal(url.searchParams.get("forecast_days"),"16");
    assert.equal(url.searchParams.get("timezone"),"Asia/Tokyo");
    assert.equal(url.searchParams.get("wind_speed_unit"),"ms");
    assert.match(url.searchParams.get("hourly"),/apparent_temperature/);
    assert.match(url.searchParams.get("hourly"),/precipitation_probability/);
    assert.match(url.searchParams.get("hourly"),/wind_gusts_10m/);
    assert.match(url.searchParams.get("daily"),/wind_gusts_10m_max/);
  }
  assert.deepEqual(OKINAWA_ZONES.map(x=>x.place),["名護市","沖繩市","那霸市"]);
});

test("Okinawa adapter fails closed on provider HTTP errors", async () => {
  await assert.rejects(
    fetchOkinawa16DayForecast(async()=>({ok:false,status:503})),
    /API HTTP 503/
  );
});

test("course forecast requests daily weather condition and apparent temperature for seven-day display",async()=>{
 let requested;
 const course={id:"test",name:"Test Course",latitude:26.2,longitude:127.7,timezone:"Asia/Tokyo"};
 const result=await fetchCourseForecast([course],async url=>{
  requested=new URL(url);
  return {ok:true,json:async()=>({timezone:"Asia/Tokyo",latitude:26.2,longitude:127.7,
   daily:{time:["2026-12-01"],weather_code:[1],apparent_temperature_min:[16],apparent_temperature_max:[23]},
   hourly:{time:["2026-12-01T06:00"],temperature_2m:[18],apparent_temperature:[17]}})};
 });
 assert.match(requested.searchParams.get("daily"),/weather_code/);
 assert.match(requested.searchParams.get("daily"),/apparent_temperature_min/);
 assert.match(requested.searchParams.get("daily"),/apparent_temperature_max/);
 assert.equal(result.courses[0].daily.weather_code[0],1);
});
