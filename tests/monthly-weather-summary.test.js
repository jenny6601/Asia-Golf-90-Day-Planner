import test from "node:test";
import assert from "node:assert/strict";
import { classifyMonthlyDay, summarizeMonthlyWeather } from "../assets/js/monthly-weather-summary.js";

test("classifies using available rainfall evidence without fabricating missing fields", () => {
  assert.deepEqual(classifyMonthlyDay({rainFrequency:20,rainAmount:0.4}), {grade:0,status:"適打",playable:true});
  assert.equal(classifyMonthlyDay({rainFrequency:20}).grade,0);
  assert.equal(classifyMonthlyDay({rainAmount:2.5}).grade,2);
  assert.equal(classifyMonthlyDay({}),null);
  assert.equal(classifyMonthlyDay({rainAmount:0.2,highTemp:34}).status,"不適");
});

test("monthly summary counts only future dates and reports coverage", () => {
  const days = [
    {date:"2026-11-27",grade:3},
    ...Array.from({length:10},(_,i)=>({date:`2026-12-${String(i+1).padStart(2,"0")}`,grade:i<9?0:3}))
  ];
  const result=summarizeMonthlyWeather(days,"2026-11-28",days.map(x=>x.date));
  assert.equal(result.validDays,10);
  assert.equal(result.counts.suitable,9);
  assert.equal(result.counts.poor,1);
  assert.equal(result.label,"整體適打");
});

test("insufficient valid coverage does not issue an overall verdict", () => {
  const result=summarizeMonthlyWeather([{date:"2026-12-01",grade:0}],"2026-11-28",Array.from({length:30},(_,i)=>`2026-12-${String(i+1).padStart(2,"0")}`));
  assert.equal(result.label,"資料不足");
});


test("wind is deliberately excluded from daily playability classification", () => {
  const baseline = classifyMonthlyDay({rainFrequency:20,rainAmount:0.4,highTemp:28});
  const withStrongWind = classifyMonthlyDay({rainFrequency:20,rainAmount:0.4,highTemp:28,windSpeed:45,windGust:70});
  assert.deepEqual(withStrongWind, baseline);
});

test("uses air temperature consistently and applies the heat threshold above 33 C", () => {
  assert.equal(classifyMonthlyDay({rainFrequency:20,rainAmount:0.4,highTemp:33}).status,"適打");
  assert.equal(classifyMonthlyDay({rainFrequency:20,rainAmount:0.4,highTemp:33.1}).status,"不適");
});

test("falls back per metric when a higher-priority source has a missing value", async () => {
  const {firstAvailableMetric}=await import("../assets/js/monthly-weather-summary.js");
  assert.equal(firstAvailableMetric(null,42,35),42);
  assert.equal(firstAvailableMetric(undefined,NaN,28),28);
  assert.equal(firstAvailableMetric(null,undefined),null);
});
