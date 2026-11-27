import test from "node:test";
import assert from "node:assert/strict";
import {classifyModelPrecipitationAnomaly,summarizeEra5MonthlyContext,buildSeasonalMonthlyContext} from "../scripts/okinawa-seasonal-monthly-context.js";
test("model anomaly direction is interpreted independently from ERA5",()=>{
 assert.equal(classifyModelPrecipitationAnomaly(12).code,"WETTER_THAN_MODEL_CLIMATE");
 assert.equal(classifyModelPrecipitationAnomaly(-3).code,"DRIER_THAN_MODEL_CLIMATE");
 assert.equal(classifyModelPrecipitationAnomaly(0).code,"NEAR_MODEL_CLIMATE");
 assert.equal(classifyModelPrecipitationAnomaly(null).code,"UNKNOWN");
});
test("ERA5 monthly context requires a valid baseline distribution",()=>{
 assert.equal(summarizeEra5MonthlyContext({months:[]},11).code,"INSUFFICIENT_ERA5_BASELINE");
 const r=summarizeEra5MonthlyContext({months:[{month:11,sampleYears:10,monthlyPrecipitationP10Mm:20,monthlyPrecipitationP50Mm:70,monthlyPrecipitationP90Mm:180,monthlyPrecipitationMeanMm:90}]},11);
 assert.equal(r.medianMm,70);assert.equal(r.sampleYears,10);
});
test("monthly forecast anomaly and ERA5 distribution remain separate signals",()=>{
 const records=buildSeasonalMonthlyContext({region:"north",forecastMonthly:{time:["2026-12-01"],precipitation_anomaly:[15]},era5Baseline:{months:[{month:12,sampleYears:9,monthlyPrecipitationP10Mm:30,monthlyPrecipitationP50Mm:90,monthlyPrecipitationP90Mm:200,monthlyPrecipitationMeanMm:100}]}});
 assert.equal(records[0].modelSignal.code,"WETTER_THAN_MODEL_CLIMATE");
 assert.equal(records[0].era5Context.medianMm,90);assert.equal(records[0].scalesCombined,false);assert.equal(records[0].calibrated,false);
});
