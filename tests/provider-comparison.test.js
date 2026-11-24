import test from "node:test";
import assert from "node:assert/strict";
import {compareProviderGolfWindow} from "../assets/js/provider-comparison.js";
const date="2026-11-24",time=Array.from({length:8},(_,i)=>date+"T"+String(6+i).padStart(2,"0")+":00");
const openMeteo={hourly:{time,precipitation_probability:Array(8).fill(20),precipitation:Array(8).fill(.2),temperature_2m:Array(8).fill(25),apparent_temperature:Array(8).fill(26),wind_speed_10m:Array(8).fill(4),wind_gusts_10m:Array(8).fill(7)}};
test("compares identical six-hour windows and keeps missing provider data separate",()=>{
 const result=compareProviderGolfWindow({openMeteo,independentProviders:{providers:{visualCrossing:{status:"unavailable",error:"no key"},foreca:{status:"unavailable",error:"timeout"}}},date,teeHour:7,timeZone:"Asia/Tokyo"});
 assert.equal(result.openMeteo.status,"available");assert.equal(result.openMeteo.rainTotalMm,1.2);
 assert.equal(result.visualCrossing.status,"unavailable");assert.equal(result.foreca.status,"unavailable");
});
test("does not score incomplete six-hour windows",()=>{
 const result=compareProviderGolfWindow({openMeteo:{hourly:{time:time.slice(0,4)}},date,teeHour:7,timeZone:"Asia/Tokyo"});
 assert.equal(result.openMeteo.status,"incomplete");
});
