import test from "node:test";
import assert from "node:assert/strict";
import {buildFiveDayWindows,pickTopNonOverlappingWindows} from "../assets/js/recommendation-windows.js";

const dates=Array.from({length:31},(_,i)=>"2026-12-"+String(i+1).padStart(2,"0"));
const assessment=dates.map((date,i)=>({date,valid:true,grade:i>=10&&i<=14?0:i>=0&&i<=4?1:2,chance:i>=10&&i<=14?10:i>=0&&i<=4?25:55,amount:i>=10&&i<=14?.2:i>=0&&i<=4?.8:3,status:i>=10&&i<=14?"適打":i>=0&&i<=4?"可打":"不適"}));

test("monthly best five-day window equals weekly TOP 1",()=>{
 const monthly=buildFiveDayWindows(assessment,dates)[0];
 const weekly=pickTopNonOverlappingWindows(buildFiveDayWindows(assessment,dates),3)[0];
 assert.equal(monthly.start,"2026-12-11");
 assert.equal(monthly.end,"2026-12-15");
 assert.equal(weekly.start,monthly.start);
 assert.equal(weekly.end,monthly.end);
});

test("windows with missing or invalid days are excluded",()=>{
 const incomplete=assessment.filter(x=>x.date!=="2026-12-13");
 const windows=buildFiveDayWindows(incomplete,dates);
 assert.equal(windows.some(x=>x.start<="2026-12-13"&&x.end>="2026-12-13"),false);
});

test("top recommendations do not overlap and use identical score tie-breaks",()=>{
 const windows=buildFiveDayWindows(assessment,dates);
 const top=pickTopNonOverlappingWindows(windows,3);
 assert.ok(top.length<=3);
 for(let i=1;i<top.length;i++) assert.ok((Date.parse(top[i].start+"T12:00:00Z")-Date.parse(top[i-1].start+"T12:00:00Z"))/86400000>=5);
});
