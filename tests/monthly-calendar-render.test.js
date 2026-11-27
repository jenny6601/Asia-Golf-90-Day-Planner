import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("monthly calendar builds a date lookup before rendering each daily card",async()=>{
 const source=await readFile(new URL("../assets/js/app.js",import.meta.url),"utf8");
 assert.match(source,/const byDate=new Map\(dailyAssessment\.map\(item=>\[item\.date,item\]\)\)/);
 assert.match(source,/const dayAssessment=byDate\.get\(date\)/);
 assert.ok(source.indexOf("const byDate=new Map(dailyAssessment.map(item=>[item.date,item]))")<source.indexOf("dates.forEach(date=>",source.indexOf("const byDate=new Map(dailyAssessment.map(item=>[item.date,item]))")));
});