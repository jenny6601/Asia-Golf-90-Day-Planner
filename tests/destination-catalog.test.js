import test from "node:test";
import assert from "node:assert/strict";
import {getDestinations,getDestination,getCoursesForCountry,getCourseRecords,getCourseCoverage,getOkinawaPilotCourses} from "../assets/js/destination-catalog.js";
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
 assert.equal(records.length,19);
 assert.equal(records.filter(x=>x.coordinateStatus==="provisional").length,6);
 assert.equal(records.filter(x=>x.coordinateStatus==="pending").length,11);
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
 const brooks=records.find(x=>x.id==="jp-hokkaido-brooks-country-club");
 assert.equal(brooks.localName,"北海道ブルックスカントリークラブ");
 assert.equal(brooks.city,"苫小牧市");
 assert.equal(brooks.coordinateStatus,"verified");
 assert.equal(brooks.latitude,42.7222222);assert.equal(brooks.longitude,141.6694445);
 assert.ok(brooks.coordinateSource.includes("Official Hokkaido Brooks"));
 assert.equal(brooks.officialUrl,"https://www.brooks-c.com/en/");
 const tomakomaiGroup=records.filter(x=>x.area==="苫小牧");
 assert.equal(tomakomaiGroup.length,3);
 assert.ok(tomakomaiGroup.every(x=>x.city==="苫小牧市"));
 assert.equal(tomakomaiGroup.filter(x=>x.coordinateStatus==="verified").length,1);
 assert.equal(tomakomaiGroup.filter(x=>x.coordinateStatus==="provisional").length,2);
 const nidom=records.find(x=>x.id==="jp-hokkaido-nidom-classic-course");
 const katsura=records.find(x=>x.id==="jp-hokkaido-katsura-golf-club");
 assert.deepEqual([nidom.latitude,nidom.longitude],[42.717879,141.654109]);
 assert.deepEqual([katsura.latitude,katsura.longitude],[42.749008,141.644209]);
 assert.equal(nidom.coordinateStatus,"provisional");
 assert.equal(katsura.coordinateStatus,"provisional");
 assert.ok(nidom.coordinateSource.includes("NAVITIME"));
 assert.ok(katsura.coordinateSource.includes("FullGolf"));
 const abiraGroup=records.filter(x=>x.area==="安平");
 assert.equal(abiraGroup.length,1);
 assert.equal(abiraGroup[0].city,"安平町");
 const hokkaidoRegion=records.filter(x=>x.region==="北海道");
 assert.equal(hokkaidoRegion.length,4);
 const chibaGroup=records.filter(x=>x.area==="千葉縣");
 assert.equal(chibaGroup.length,3);
 assert.ok(chibaGroup.every(x=>x.latitude===null&&x.longitude===null&&x.coordinateStatus==="pending"));
 const okinawaGroup=records.filter(x=>x.area==="沖繩本島");
 assert.equal(okinawaGroup.length,6);
 const regionCounts=new Map();for(const course of records)regionCounts.set(course.region,(regionCounts.get(course.region)||0)+1);
 for(const [region,count] of regionCounts)assert.ok(count>=3,region+" must have at least 3 courses");
 assert.equal(getCoursesForCountry("JP").length,19);
 assert.deepEqual(getCourseCoverage("JP"),{countryCode:"JP",total:19,forecastReady:2,provisional:6,pending:11});
 for(const code of ["KR","CN","VN","TH","MY","SG","ID"])assert.equal(getCourseRecords(code).length,0);
 assert.equal(getDestination("US"),null);
});

test("active pilot course scope contains Okinawa Main Island only",()=>{
 const pilot=getOkinawaPilotCourses();
 assert.equal(pilot.length,6);
 assert.ok(pilot.every(course=>course.countryCode==="JP"&&course.area==="沖繩本島"));
 assert.deepEqual(pilot.map(course=>course.id),["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"]);
});

test("Southern Links GPS is verified from the official embedded access map",()=>{
 const course=getOkinawaPilotCourses().find(x=>x.id==="southern-links");
 assert.equal(course.coordinateStatus,"verified");
 assert.equal(course.latitude,26.114086000297586);
 assert.equal(course.longitude,127.73689211539313);
 assert.equal(course.coordinateVerifiedAt,"2026-11-24");
 assert.equal(getCourseRecords("JP").find(x=>x.id==="southern-links").coordinateVerifiedAt,"2026-11-24");
 assert.match(course.coordinateSource,/Official Accordia Golf access page/);
 assert.match(course.coordinateSourceUrl,/accordia\.golf/);
 assert.equal(isForecastReady(course),true);
});
