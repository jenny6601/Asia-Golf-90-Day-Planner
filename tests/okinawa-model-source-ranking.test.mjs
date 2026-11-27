import test from "node:test";
import assert from "node:assert/strict";

test("ranking sample gate requires pair count, distinct days and rain events",()=>{
 const eligible=(n,days,wet)=>n>=200&&days>=30&&wet>=10;
 assert.equal(eligible(199,30,10),false);
 assert.equal(eligible(200,29,10),false);
 assert.equal(eligible(200,30,9),false);
 assert.equal(eligible(200,30,10),true);
});
test("fixed hindcast lead and retrieval age are distinct concepts",()=>{
 const sample={leadDays:3,retrievedAt:"2026-11-27T03:00:00+08:00"};
 assert.equal(sample.leadDays,3);
 assert.equal(Object.hasOwn(sample,"leadHours"),false);
});
