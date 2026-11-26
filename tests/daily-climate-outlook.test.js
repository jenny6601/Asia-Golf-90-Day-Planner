import test from "node:test";
import assert from "node:assert/strict";
import {buildDailyClimateOutlook} from "../assets/js/daily-climate-outlook.js";

const today="2026-11-26";
const history=(date,overrides={})=>({
 date,sampleYears:10,rainSampleYears:10,temperatureSampleYears:10,
 rainFrequency:30,rainMean:2,rainP10:0,rainP90:8,
 highMean:24,lowMean:17,highStd:1.5,lowStd:1.2,...overrides
});

test("builds every daily estimate from D19 through D90 with explicit horizon bands",()=>{
 const rows=buildDailyClimateOutlook({},[history("2026-12-15")],today,90);
 assert.equal(rows.length,72);
 assert.equal(rows[0].date,"2026-12-15");
 assert.equal(rows[0].lead,19);
 assert.equal(rows[0].band,"D19–D46");
 assert.equal(rows[28].band,"D47–D60");
 assert.equal(rows.at(-1).lead,90);
 assert.equal(rows.at(-1).band,"D61–D90");
 assert.equal(rows[0].rainProbability,null);
});

test("seasonal weekly and monthly signals adjust historical rain frequency and temperature",()=>{
 const payload={
  weekly:{time:["2026-12-14"],precipitation_efi:[0.9],precipitation_anomaly_gt0:[80],precipitation_mean:[9],precipitation_anomaly:[4],temperature_2m_anomaly:[1.2],wind_speed_10m_mean:[6]},
  monthly:{time:["2026-12-01"],precipitation_mean:[180],precipitation_anomaly:[30],temperature_2m_anomaly:[0.8],wind_speed_10m_mean:[4]}
 };
 const [row]=buildDailyClimateOutlook(payload,[history("2026-12-15")],today,90);
 assert.ok(row.rainChanceEstimate>30);
 assert.ok(row.highEstimate>24);
 assert.ok(row.lowEstimate>17);
 assert.equal(row.windMeanEstimate,6);
 assert.equal(row.seasonal.precipitationEfi,0.9);
 assert.ok(row.rainEstimate>2);
 assert.ok(row.confidenceScore<=85);
 assert.notEqual(row.confidence,"高");
});

test("missing historical observations stay missing instead of becoming dry weather",()=>{
 const [row]=buildDailyClimateOutlook({},[],today,90);
 assert.equal(row.highEstimate,null);
 assert.equal(row.lowEstimate,null);
 assert.equal(row.rainEstimate,null);
 assert.equal(row.rainChanceEstimate,null);
 assert.equal(row.sourceType,"insufficient-data");
 assert.equal(row.confidence,"資料不足");
});

test("does not label estimated wet-day frequency as deterministic rain probability",()=>{
 const [row]=buildDailyClimateOutlook({},[history("2026-12-15")],today,90);
 assert.match(row.rainChanceLabel,/非逐日降雨機率/);
 assert.equal(row.rainProbability,null);
});

test("validates date and requested horizon",()=>{
 assert.throws(()=>buildDailyClimateOutlook({},[],"bad-date",90),/YYYY-MM-DD/);
 assert.throws(()=>buildDailyClimateOutlook({},[],today,16),/between 19 and 120/);
});
