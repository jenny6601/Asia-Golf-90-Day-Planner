import test from "node:test";
import assert from "node:assert/strict";
import {summarizeCourseRainRisks} from "../assets/js/rain-risk.js";

const scored=(id,risk)=>({course:{id},score:{status:"scored",rainRisk:risk}});
const missing=id=>({course:{id},score:{status:"insufficient-data"}});
test("three course comparison reports average, worst and best course",()=>{
 const s=summarizeCourseRainRisks([scored("north",20),scored("central",45),scored("south",70)]);
 assert.deepEqual(s,{requestedCount:3,scoredCount:3,incompleteCount:0,averageRisk:45,worstRisk:70,bestCourseId:"north",worstCourseId:"south"});
});
test("missing course data is counted but never treated as zero risk",()=>{
 const s=summarizeCourseRainRisks([scored("north",30),missing("central"),scored("south",60)]);
 assert.equal(s.scoredCount,2);
 assert.equal(s.incompleteCount,1);
 assert.equal(s.averageRisk,45);
 assert.equal(s.worstRisk,60);
});
test("all missing courses return null summary values",()=>{
 const s=summarizeCourseRainRisks([missing("north"),missing("south")]);
 assert.equal(s.averageRisk,null);
 assert.equal(s.worstRisk,null);
 assert.equal(s.bestCourseId,null);
});
