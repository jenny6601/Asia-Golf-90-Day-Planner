import test from "node:test";
import assert from "node:assert/strict";
import {scoreForecastSamples} from "../assets/js/trip-date-forecast-backtest.js";

test("scores probability forecasts against the ERA5 wet-day reference and amount separately",()=>{
  const result=scoreForecastSamples([
    {leadDays:1,probability:80,forecastRainMm:4,observedRainMm:5},
    {leadDays:2,probability:20,forecastRainMm:1,observedRainMm:0}
  ]);
  assert.equal(result.overall.probabilitySampleCount,2);
  assert.equal(result.overall.brierScore,0.04);
  assert.equal(result.overall.rainfallAmountMaeMm,1);
  assert.equal(result.byLeadBucket[0].probabilitySampleCount,2);
});

test("keeps missing forecast or observed values out of metrics without imputing",()=>{
  const result=scoreForecastSamples([
    {leadDays:1,probability:null,forecastRainMm:null,observedRainMm:2},
    {leadDays:2,probability:40,forecastRainMm:3,observedRainMm:null}
  ]);
  assert.equal(result.overall.probabilitySampleCount,0);
  assert.equal(result.overall.amountSampleCount,0);
  assert.equal(result.overall.brierScore,null);
  assert.equal(result.overall.rainfallAmountMaeMm,null);
});

test("separates short and longer forecast lead buckets",()=>{
  const result=scoreForecastSamples([
    {leadDays:2,probability:50,forecastRainMm:1,observedRainMm:1},
    {leadDays:5,probability:50,forecastRainMm:1,observedRainMm:0},
    {leadDays:12,probability:50,forecastRainMm:1,observedRainMm:0}
  ]);
  assert.deepEqual(result.byLeadBucket.map(x=>x.probabilitySampleCount),[1,1,1]);
});

test("rejects forecast lead outside the 16-day source horizon",()=>{
  assert.throws(()=>scoreForecastSamples([{leadDays:17,probability:30,observedRainMm:0}]),/leadDays must be 1..16/);
});
