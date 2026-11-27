import test from "node:test";
import assert from "node:assert/strict";
import {assessForecastPayload} from "../scripts/forecast-completeness.js";

const dailyFields=["weather_code","precipitation_sum","precipitation_probability_max","temperature_2m_min","temperature_2m_max","apparent_temperature_min","apparent_temperature_max","wind_speed_10m_max","wind_gusts_10m_max"];
const hourlyFields=["temperature_2m","apparent_temperature","relative_humidity_2m","precipitation_probability","precipitation","weather_code","wind_speed_10m","wind_direction_10m","wind_gusts_10m","cloud_cover","uv_index"];
function payload(){
 const daily={time:Array.from({length:16},(_,i)=>"2026-12-"+String(i+1).padStart(2,"0"))};
 const hourly={time:Array.from({length:384},(_,i)=>"2026-12-01T"+String(Math.floor(i/24)).padStart(2,"0")+":00")};
 for(const key of dailyFields)daily[key]=Array(16).fill(1);
 for(const key of hourlyFields)hourly[key]=Array(384).fill(1);
 return {timezone:"Asia/Tokyo",latitude:26.4,longitude:127.8,daily,hourly};
}

test("16-day forecast passes only with all App daily and hourly fields fully populated",()=>{
 const result=assessForecastPayload(payload());
 assert.equal(result.dailyCount,16);
 assert.equal(result.hourlyCount,384);
 assert.equal(result.requiredFieldCount,20);
 assert.equal(result.completeFieldCount,20);
 assert.equal(result.coreFieldsComplete,true);
 assert.equal(result.totalExpectedValues,4368);
 assert.equal(result.totalValidValues,4368);
});

test("missing relative humidity, wind direction or UV values fail strict completeness",()=>{
 for(const key of ["relative_humidity_2m","wind_direction_10m","uv_index"]){
  const p=payload();p.hourly[key][100]=null;
  const result=assessForecastPayload(p);
  assert.equal(result.hourly[key].missing,1,key);
  assert.equal(result.coreFieldsComplete,false,key);
 }
});

test("short hourly arrays fail even when all returned values are populated",()=>{
 const p=payload();p.hourly.time.pop();
 for(const key of hourlyFields)p.hourly[key].pop();
 const result=assessForecastPayload(p);
 assert.equal(result.hourlyCount,383);
 assert.equal(result.coreFieldsComplete,false);
});