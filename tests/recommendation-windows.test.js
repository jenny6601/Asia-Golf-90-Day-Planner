import test from "node:test";
import assert from "node:assert/strict";
import {buildFiveDayWindows,pickRecommendedFiveDayWindows} from "../assets/js/recommendation-windows.js";

const makeAssessment = (eligibleDates, days = 31) => Array.from({length:days},(_,i)=>{
 const date="2026-12-"+String(i+1).padStart(2,"0");
 const status=eligibleDates.includes(date)?"適打":"不適";
 return {date,valid:true,grade:status==="適打"?0:3,chance:status==="適打"?10:80,amount:status==="適打"?.2:5,status};
});
const dates=Array.from({length:31},(_,i)=>"2026-12-"+String(i+1).padStart(2,"0"));

test("Top 1-3 prioritize five-day windows with three consecutive eligible core play days",()=>{
 const eligible=["2026-12-02","2026-12-03","2026-12-04","2026-12-09","2026-12-10","2026-12-11","2026-12-16","2026-12-17","2026-12-18"];
 const windows=buildFiveDayWindows(makeAssessment(eligible),dates);
 const top=pickRecommendedFiveDayWindows(windows,3);
 assert.equal(top.length,3);
 assert.ok(top.every(x=>x.qualifies));
 assert.deepEqual(top.map(x=>x.coreStart),["2026-12-02","2026-12-09","2026-12-16"]);
 assert.ok(top.every(x=>x.recommendationType==="符合核心條件"));
});

test("fallback candidates are selected only when fewer than three qualifying windows exist",()=>{
 const eligible=["2026-12-02","2026-12-03","2026-12-04","2026-12-09","2026-12-10"];
 const windows=buildFiveDayWindows(makeAssessment(eligible),dates);
 const top=pickRecommendedFiveDayWindows(windows,3);
 assert.equal(top.length,3);
 assert.equal(top[0].qualifies,true);
 assert.ok(top.slice(1).every(x=>!x.qualifies));
 assert.ok(top.slice(1).every(x=>x.recommendationType==="接近條件（替代推薦）"));
 assert.ok(top.slice(1).every(x=>x.explanation.includes("中間連續3天有")));
});

test("fallback ranks the candidate with the most eligible core days first",()=>{
 const eligible=["2026-12-02","2026-12-03","2026-12-04","2026-12-09","2026-12-10","2026-12-17"];
 const windows=buildFiveDayWindows(makeAssessment(eligible),dates);
 const top=pickRecommendedFiveDayWindows(windows,3);
 const fallbacks=top.filter(x=>!x.qualifies);
 assert.ok(fallbacks.length>0);
 assert.equal(fallbacks[0].coreEligible,2);
});

test("incomplete daily data is excluded instead of being interpolated",()=>{
 const assessment=makeAssessment(["2026-12-02","2026-12-03","2026-12-04"]).filter(x=>x.date!=="2026-12-03");
 const windows=buildFiveDayWindows(assessment,dates);
 assert.equal(windows.some(x=>x.start<="2026-12-03"&&x.end>="2026-12-03"),false);
});