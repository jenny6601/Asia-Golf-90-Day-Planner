import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("monthly calendar builds a date lookup before rendering each daily card",async()=>{
 const source=await readFile(new URL("../assets/js/app.js",import.meta.url),"utf8");
 assert.match(source,/const byDate=new Map\(dailyAssessment\.map\(item=>\[item\.date,item\]\)\)/);
 assert.match(source,/const dayAssessment=byDate\.get\(date\)/);
 assert.ok(source.indexOf("const byDate=new Map(dailyAssessment.map(item=>[item.date,item]))")<source.indexOf("dates.forEach(date=>",source.indexOf("const byDate=new Map(dailyAssessment.map(item=>[item.date,item]))")));
});
test("clicking a monthly day routes to departure date and course selection with the selected subregion context",async()=>{
 const source=await readFile(new URL("../assets/js/app.js",import.meta.url),"utf8");
 assert.match(source,/card\.addEventListener\("click",\(\)=>showDepartureForm\(date,[\s\S]*?\{country:group\.country,region:group\.rootRegion,courses:group\.courses\}\)\)/);
 assert.doesNotMatch(source,/card\.addEventListener\("click",\(\)=>openMonthlyDateSevenDayReport/);
 assert.match(source,/departureCoursePriorityIds=Array\.isArray\(courseContext\?\.courses\)/);
 assert.match(source,/fillCourses\(\)/);
});
