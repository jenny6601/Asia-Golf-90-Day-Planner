import test from "node:test";
import assert from "node:assert/strict";
import {forecastGridKey,groupForecastGridCells,compareNumericSeries,summarizeNumeric} from "../assets/js/okinawa-grid-analysis.js";

test("six Okinawa courses group into three shared forecast grid cells",()=>{
 const rows=[
  {courseId:"southern-links",name:"Southern",area:"南部",forecastGrid:{latitude:26.18629,longitude:127.69737}},
  {courseId:"palm-hills",name:"Palm",area:"南部",forecastGrid:{latitude:26.18629,longitude:127.69737}},
  {courseId:"pgm-okinawa",name:"PGM",area:"中部",forecastGrid:{latitude:26.467485,longitude:127.863434}},
  {courseId:"atta-terrace",name:"Atta",area:"北部",forecastGrid:{latitude:26.467485,longitude:127.863434}},
  {courseId:"chura-orchard",name:"Chura",area:"北部",forecastGrid:{latitude:26.467485,longitude:127.863434}},
  {courseId:"kise",name:"Kise",area:"北部",forecastGrid:{latitude:26.537785,longitude:128.00441}}
 ];
 const groups=groupForecastGridCells(rows);
 assert.equal(groups.length,3);
 assert.deepEqual(groups.map(x=>x.courseIds.length).sort(),[1,2,3]);
 assert.equal(forecastGridKey({latitude:26.18629,longitude:127.69737}),"26.18629,127.69737");
 assert.ok(groups.some(x=>x.areas.includes("中部")&&x.areas.includes("北部")));
});

test("same-grid series comparison reports exact matches and downscaling differences",()=>{
 const same=compareNumericSeries([1,2,3],[1,2,3]);
 assert.equal(same.n,3);assert.equal(same.exactMatchPercent,100);assert.equal(same.maxAbsoluteDifference,0);
 const different=compareNumericSeries([1,2,3],[1,2.5,4]);
 assert.ok(Math.abs(different.exactMatchPercent-100/3)<1e-10);assert.equal(different.meanAbsoluteDifference,0.5);assert.equal(different.maxAbsoluteDifference,1);
});

test("regional numeric summary ignores missing values and preserves sample count",()=>{
 const s=summarizeNumeric([1,null,3,NaN,5]);
 assert.equal(s.n,3);assert.equal(s.mean,3);assert.equal(s.min,1);assert.equal(s.max,5);assert.equal(s.sum,9);
});