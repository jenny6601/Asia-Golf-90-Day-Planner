import test from "node:test";
import assert from "node:assert/strict";
import {buildDailyClimateOutlook} from "../assets/js/daily-climate-outlook.js";

const today="2026-11-26";
const history=(date,overrides={})=>({
 date,sampleYears:30,rainSampleYears:30,temperatureSampleYears:30,feelsLikeSampleYears:30,
 rainFrequency:30,rainMean:2,rainP10:0,rainP90:8,
 highMean:24,lowMean:17,humidityMean:72,windMean:2.5,
 feelsLikeMinMeanC:14.2,feelsLikeMaxMeanC:21.8,
 feelsLikeMinP10C:11,feelsLikeMinP90C:17,feelsLikeMaxP10C:19,feelsLikeMaxP90C:25,
 ...overrides
});

test("builds D19-D90 daily estimates using historical climate only",()=>{
 const rows=buildDailyClimateOutlook({},[history("2026-12-14")],today,90);
 assert.equal(rows.length,72);
 assert.equal(rows[0].date,"2026-12-14");
 assert.equal(rows[0].lead,19);
 assert.equal(rows[0].band,"D19–D46");
 assert.equal(rows[28].band,"D47–D60");
 assert.equal(rows.at(-1).lead,90);
 assert.equal(rows.at(-1).band,"D61–D90");
 assert.equal(rows[0].feelsLikeMinEstimateC,14.2);
 assert.equal(rows[0].feelsLikeMaxEstimateC,21.8);
 assert.equal(rows[0].rainChanceEstimate,30);
 assert.equal(rows[0].rainProbability,null);
 assert.equal(rows[0].sourceType,"historical-climate-estimate");
});

test("ignores seasonal model signals and does not adjust historical values",()=>{
 const payload={
  weekly:{time:["2026-12-14"],precipitation_efi:[1],precipitation_anomaly_gt0:[99],temperature_2m_anomaly:[2]},
  monthly:{time:["2026-12-01"],precipitation_mean:[300],precipitation_anomaly:[200],temperature_2m_anomaly:[2]}
 };
 const [row]=buildDailyClimateOutlook(payload,[history("2026-12-14")],today,90);
 assert.equal(row.rainChanceEstimate,30);
 assert.equal(row.rainEstimate,2);
 assert.equal(row.highEstimate,24);
 assert.equal(row.feelsLikeMaxEstimateC,21.8);
 assert.equal(row.seasonal.disabled,true);
 assert.equal(row.seasonalEvidenceCount,0);
});

test("missing historical observations stay missing instead of becoming dry weather",()=>{
 const [row]=buildDailyClimateOutlook({},[],today,90);
 assert.equal(row.highEstimate,null);
 assert.equal(row.lowEstimate,null);
 assert.equal(row.feelsLikeMinEstimateC,null);
 assert.equal(row.feelsLikeMaxEstimateC,null);
 assert.equal(row.rainEstimate,null);
 assert.equal(row.rainChanceEstimate,null);
 assert.equal(row.sourceType,"insufficient-data");
 assert.equal(row.confidence,"資料不足");
});

test("historical wet-day frequency is never labelled as future rain probability",()=>{
 const [row]=buildDailyClimateOutlook({},[history("2026-12-14")],today,90);
 assert.match(row.rainChanceLabel,/不是未來逐日降雨機率/);
 assert.equal(row.rainProbability,null);
 assert.match(row.confidenceNote,/1991-2020/);
});

test("validates date and requested horizon",()=>{
 assert.throws(()=>buildDailyClimateOutlook({},[],"bad-date",90),/YYYY-MM-DD/);
 assert.throws(()=>buildDailyClimateOutlook({},[],today,16),/between 19 and 120/);
});
