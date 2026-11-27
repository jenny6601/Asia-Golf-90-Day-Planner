import test from "node:test";
import assert from "node:assert/strict";
import { classifyMonthlyDay, summarizeMonthlyWeather } from "../assets/js/monthly-weather-summary.js";

test("classifies using available rainfall evidence without fabricating missing fields", () => {
  assert.deepEqual(classifyMonthlyDay({rainFrequency:20,rainAmount:0.4}), {grade:0,status:"適打",playable:true});
  assert.equal(classifyMonthlyDay({rainFrequency:20}).grade,0);
  assert.equal(classifyMonthlyDay({rainAmount:2.5}).grade,2);
  assert.equal(classifyMonthlyDay({}).grade,undefined);
  assert.equal(classifyMonthlyDay({rainAmount:0.2,highTemp:34}).status,"不適");
});

test("monthly summary counts only future dates and reports coverage", () => {
  const days = [
    {date:"2026-11-27",grade:3},
    ...Array.from({length:10},(_,i)=>({date:`2026-12-${String(i+1).padStart(2,"0")}`,grade:i<8?0:3}))
  ];
  const result=summarizeMonthlyWeather(days,"2026-11-28",days.map(x=>x.date));
  assert.equal(result.validDays,10);
  assert.equal(result.counts.suitable,8);
  assert.equal(result.counts.poor,2);
  assert.equal(result.label,"整體適打");
});

test("insufficient valid coverage does not issue an overall verdict", () => {
  const result=summarizeMonthlyWeather([{date:"2026-12-01",grade:0}],"2026-11-28",Array.from({length:30},(_,i)=>`2026-12-${String(i+1).padStart(2,"0")}`));
  assert.equal(result.label,"資料不足");
});
