import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSeasonalDaily,blendSeasonalWithHistory} from "../assets/js/seasonal-daily-engine.js";
const today="2026-11-26";
test("normalizes native six-hour samples into a daily rainfall estimate",()=>{
 const rows=normalizeSeasonalDaily({daily:{time:["2026-12-15"],weather_code:[61],temperature_2m_max:[24],temperature_2m_min:[18],temperature_2m_mean:[21],wind_speed_10m_mean:[4],cloud_cover_mean:[70],sunshine_duration:[10000]},hourly:{time:["2026-12-15T00:00","2026-12-15T06:00","2026-12-15T12:00","2026-12-15T18:00"],precipitation:[1,2,0,1],temperature_2m:[20,21,22,21],wind_speed_10m:[3,4,5,4],relative_humidity_2m:[80,82,75,78]}},today);
 assert.equal(rows.length,1);assert.equal(rows[0].lead,19);assert.equal(rows[0].band,"EC46");assert.equal(rows[0].rainEstimate,4);assert.equal(rows[0].sixHourSamples,4);assert.equal(rows[0].rainProbability,undefined);
});
test("D47-D90 are marked SEAS5 and missing gust is not treated as zero",()=>{
 const row=normalizeSeasonalDaily({daily:{time:["2027-01-12"],weather_code:[2],temperature_2m_max:[20],temperature_2m_min:[14],temperature_2m_mean:[17],wind_speed_10m_mean:[5],cloud_cover_mean:[40],sunshine_duration:[20000]},hourly:{time:["2027-01-12T00:00"],precipitation:[0]}},today)[0];
 assert.equal(row.lead,47);assert.equal(row.band,"SEAS5");assert.equal(row.gustMax,null);
});
test("blends seasonal and historical analogues without inventing rain probability",()=>{
 const [row]=blendSeasonalWithHistory([{date:"2026-12-15",lead:19,band:"EC46",code:1,weather:"晴時多雲",high:25,low:18,rainEstimate:3,windMean:4}], [{date:"2026-12-15",sampleYears:10,highMean:23,lowMean:17,rainMean:2,rainFrequency:30,rainMin:0,rainMax:12}]);
 assert.ok(row.highEstimate>23&&row.highEstimate<25);assert.ok(row.rainEstimate>2&&row.rainEstimate<3);assert.equal(row.rainProbability,null);assert.equal(row.historical.rainFrequency,30);assert.equal(row.confidence,"中低");
});
test("does not emit dates outside D19-D90",()=>{
 const rows=blendSeasonalWithHistory([{date:"2026-12-01",lead:5,high:20},{date:"2027-03-01",lead:95,high:20}]);assert.equal(rows.length,0);
});
