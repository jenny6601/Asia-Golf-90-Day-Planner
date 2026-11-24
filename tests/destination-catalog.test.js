import test from "node:test";
import assert from "node:assert/strict";
import {getDestinations,getDestination,getCoursesForCountry,getCourseRecords,getCourseCoverage} from "../assets/js/destination-catalog.js";
import {validateCourseRecord,isForecastReady} from "../assets/js/course-schema.js";

const valid={id:"sample",countryCode:"VN",region:"北部",city:"河內",courseName:"Sample Club",timezone:"Asia/Ho_Chi_Minh",latitude:21.1,longitude:105.8,coordinateSource:"Official club map",coordinateVerifiedAt:"2026-11-24",coordinateStatus:"verified",officialUrl:"https://example.com"};

test("destination catalogue contains exactly the original eight countries",()=>{
 const codes=getDestinations().map(x=>x.code);
 assert.deepEqual(codes,["JP","KR","CN","VN","TH","MY","SG","ID"]);
 assert.equal(new Set(codes).size,8);
});
test("course schema accepts verified records and exposes country name",()=>{
 const result=validateCourseRecord(valid,{requireForecastReady:true});
 assert.equal(result.countryName,"越南");
 assert.equal(isForecastReady(result),true);
});
test("provisional or pending coordinates cannot be forecast-ready",()=>{
 assert.throws(()=>validateCourseRecord({...valid,coordinateStatus:"provisional",coordinateVerifiedAt:null},{requireForecastReady:true}),/not forecast-ready/);
 assert.throws(()=>validateCourseRecord({...valid,latitude:null,longitude:null,coordinateStatus:"pending",coordinateSource:null,coordinateVerifiedAt:null},{requireForecastReady:true}),/not forecast-ready/);
});
test("invalid coordinates, timezone, country and partial GPS are rejected",()=>{
 assert.throws(()=>validateCourseRecord({...valid,latitude:100}),/latitude and longitude/);
 assert.throws(()=>validateCourseRecord({...valid,timezone:"Mars/Olympus"}),/IANA timezone/);
 assert.throws(()=>validateCourseRecord({...valid,countryCode:"US"}),/unsupported country/);
 assert.throws(()=>validateCourseRecord({...valid,longitude:null}),/latitude and longitude/);
});
test("Japan catalogue includes Okinawa and mainland candidates without inventing GPS",()=>{
 const records=getCourseRecords("JP");
 assert.equal(records.length,18);
 assert.equal(records.filter(x=>x.coordinateStatus==="provisional").length,5);
 assert.equal(records.filter(x=>x.coordinateStatus==="pending").length,13);
 const narita=records.find(x=>x.id==="jp-chiba-narita-golf-club");
 const hokkaidoClassic=records.find(x=>x.id==="jp-hokkaido-classic-golf-club");
 assert.equal(narita.latitude,null);assert.equal(narita.longitude,null);
 assert.equal(hokkaidoClassic.latitude,null);assert.equal(hokkaidoClassic.longitude,null);
 assert.ok(narita.officialUrl.startsWith("https://"));
 assert.ok(hokkaidoClassic.officialUrl.startsWith("https://"));
 const fujiArea=records.filter(x=>x.area==="富士五湖");
 assert.equal(fujiArea.length,6);
 assert.ok(fujiArea.every(x=>x.latitude===null&&x.longitude===null&&x.coordinateStatus==="pending"));
 const abiko=records.find(x=>x.id==="jp-chiba-abiko-golf-club");
 assert.equal(abiko.city,"我孫子市");
 assert.equal(abiko.coordinateStatus,"pending");
 assert.equal(abiko.latitude,null);assert.equal(abiko.longitude,null);
 assert.ok(abiko.officialUrl.includes("abikogc.com"));
 const hokkaidoGroup=records.filter(x=>x.area==="北海道");
 assert.equal(hokkaidoGroup.length,3);
 assert.ok(hokkaidoGroup.every(x=>x.latitude===null&&x.longitude===null&&x.coordinateStatus==="pending"));
 const chibaGroup=records.filter(x=>x.area==="千葉縣");
 assert.equal(chibaGroup.length,3);
 assert.ok(chibaGroup.every(x=>x.latitude===null&&x.longitude===null&&x.coordinateStatus==="pending"));
 const okinawaGroup=records.filter(x=>x.area==="沖繩本島");
 assert.equal(okinawaGroup.length,6);
 const areaCounts=new Map();for(const course of records)areaCounts.set(course.area,(areaCounts.get(course.area)||0)+1);
 for(const [area,count] of areaCounts)assert.ok(count>=3,`${area} must have at least 3 courses`);
 assert.equal(getCoursesForCountry("JP").length,18);
 assert.deepEqual(getCourseCoverage("JP"),{countryCode:"JP",total:18,forecastReady:0,provisional:5,pending:13});
 for(const code of ["KR","CN","VN","TH","MY","SG","ID"])assert.equal(getCourseRecords(code).length,0);
 assert.equal(getDestination("US"),null);
});
