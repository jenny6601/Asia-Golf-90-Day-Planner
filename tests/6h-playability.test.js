import test from "node:test";
import assert from "node:assert/strict";
import {buildSixHourWindows,summarizeSixHourWindows} from "../scripts/evaluate-okinawa-6h-playability.mjs";

function rows({missingHour=null,missingField=null}={}){
 const out=[];
 for(let h=0;h<24;h++){
  if(h===missingHour)continue;
  const t="2025-07-15T"+String(h).padStart(2,"0")+":00";
  const f={precipitation:h===7?0.5:0,wind_speed_10m:h===9?8:3};
  const o={precipitation:h===7?1:0,wind_speed_10m:h===10?6:4};
  if(missingField&&h===8)f[missingField]=null;
  out.push({modelId:"ecmwf_ifs025",pointId:"north",leadHours:24,validTime:t,season:"summer",forecast:f,verification:o,gridAligned:true});
 }
 return out;
}
test("builds tee-time six-hour windows using tee hour through +5h",()=>{
 const {windows}=buildSixHourWindows(rows(),[7]);
 assert.equal(windows.length,1);
 assert.equal(windows[0].startLocal,"2025-07-15T07:00");
 assert.equal(windows[0].endLocal,"2025-07-15T12:00");
 assert.equal(windows[0].forecastRain6hMm,0.5);
 assert.equal(windows[0].verificationRain6hMm,1);
 assert.equal(windows[0].forecastMaxWindMs,8);
});
test("rejects windows with a missing hour without interpolation",()=>{
 const {windows,rejected}=buildSixHourWindows(rows({missingHour:9}),[7]);
 assert.equal(windows.length,0);
 assert.equal(rejected[0].reason,"missing-hour");
});
test("rejects windows with missing required rain or wind values",()=>{
 const {windows,rejected}=buildSixHourWindows(rows({missingField:"precipitation"}),[7]);
 assert.equal(windows.length,0);
 assert.equal(rejected[0].reason,"missing-values");
});
test("reports rain event contingency metrics at threshold",()=>{
 const {windows}=buildSixHourWindows(rows(),[7]);
 const s=summarizeSixHourWindows(windows);
 assert.equal(s.rainEvents["0.1"].hit,1);
 assert.equal(s.rainEvents["0.1"].csi,1);
});
