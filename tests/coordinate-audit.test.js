import test from "node:test";
import assert from "node:assert/strict";
import {haversineKm,auditForecastPoint} from "../assets/js/coordinate-audit.js";
test("haversine returns zero for identical points and plausible short distance",()=>{
 assert.equal(haversineKm(26,127,26,127),0);
 const d=haversineKm(26,127,26.01,127);
 assert.ok(d>1&&d<1.2);
});
test("forecast audit reports provider grid offset without claiming GPS verification",()=>{
 const course={latitude:26.5,longitude:127.9,coordinateStatus:"provisional",coordinateSource:"third-party map"};
 const result=auditForecastPoint(course,{latitude:26.51,longitude:127.9,elevation:42,timezone:"Asia/Tokyo"});
 assert.ok(result.gridOffsetKm>1);
 assert.equal(result.elevationM,42);
 assert.match(result.warning,/不是球場界線/);
});
test("missing provider coordinates produce a null offset",()=>{
 const result=auditForecastPoint({latitude:26,longitude:127},{});
 assert.equal(result.gridOffsetKm,null);
});
