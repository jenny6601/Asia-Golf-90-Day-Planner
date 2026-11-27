import test from "node:test";
import assert from "node:assert/strict";
import {validateSeasonalSnapshot} from "../scripts/okinawa-seasonal-forecast-schema.js";
const point=id=>({point:{id},weekly:{time:["2026-12-01"],precipitation_efi:[0],precipitation_mean:[10]},monthly:{time:["2026-12-01"],precipitation_mean:[10],precipitation_anomaly:[0]}});
const snapshot=points=>({archiveType:"okinawa-ecmwf-seasonal-snapshot",points});
test("seasonal archive requires all three Okinawa regions",()=>{
 assert.equal(validateSeasonalSnapshot(snapshot(["north","central","south"].map(point))).valid,true);
 assert.equal(validateSeasonalSnapshot(snapshot(["north","central"].map(point))).valid,false);
});
test("seasonal archive rejects missing weekly EFI or monthly anomaly",()=>{
 const points=["north","central","south"].map(point);points[0].weekly.precipitation_efi=[];
 assert.equal(validateSeasonalSnapshot(snapshot(points)).valid,false);
 const points2=["north","central","south"].map(point);points2[1].monthly.precipitation_anomaly=[];
 assert.equal(validateSeasonalSnapshot(snapshot(points2)).valid,false);
});
