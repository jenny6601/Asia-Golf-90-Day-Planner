import test from "node:test";
import assert from "node:assert/strict";
import {getDestinations,getDestination,getCoursesForCountry,getCourseCoverage} from "../assets/js/destination-catalog.js";

test("destination catalogue contains exactly the original eight countries",()=>{
 const codes=getDestinations().map(x=>x.code);
 assert.deepEqual(codes,["JP","KR","CN","VN","TH","MY","SG","ID"]);
 assert.equal(new Set(codes).size,8);
});

test("Okinawa remains the only currently populated course catalogue",()=>{
 assert.equal(getCoursesForCountry("JP").length,6);
 for(const code of ["KR","CN","VN","TH","MY","SG","ID"]) assert.equal(getCoursesForCountry(code).length,0);
 assert.equal(getCourseCoverage("JP").available,true);
 assert.equal(getCourseCoverage("VN").available,false);
});

test("unknown destinations do not return a course catalogue",()=>{
 assert.equal(getDestination("US"),null);
 assert.deepEqual(getCoursesForCountry("US"),[]);
});
