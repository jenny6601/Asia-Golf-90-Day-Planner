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
 assert.equal(records.length,16);
 assert.equal(records.filter(x=>x.coordinateStatus==="provisional").length,5);
 assert.equal(records.filter(x=>x.coordinateStatus==="pending").length,11);
 const narita=records.find(x=>x.id==="jp-chiba-narita-golf-club");
 const hokkaido=records.find(x=>x.id==="jp-hokkaido-classic-golf-club");
 assert.equal(narita.latitude,null);assert.equal(narita.longitude,null);
 assert.equal(hokkaido.latitude,null);assert.equal(hokkaido.longitude,null);
 assert.ok(narita.officialUrl.startsWith("https://"));
 assert.ok(hokkaido.officialUrl.startsWith("https://"));
 const fujiArea=records.filter(x=>x.area?.startsWith("富士五湖"));
 assert.equal(fujiArea.length,6);
 assert.ok(fujiArea.every(x=>x.latitude===null&&x.longitude===null&&x.coordinateStatus==="pending"));
 const hokkaido=records.filter(x=>x.area==="北海道・苫小牧");
 assert.equal(hokkaido.length,2);
 assert.deepEqual(hokkaido.map(x=>x.id),["jp-hokkaido-nidom-classic-course","jp-hokkaido-katsura-golf-club"]);
 assert.ok(hokkaido.every(x=>x.latitude===null&&x.longitude===null&&x.coordinateStatus==="pending"));
 assert.equal(getCoursesForCountry("JP").length,16);
 assert.deepEqual(getCourseCoverage("JP"),{countryCode:"JP",total:16,forecastReady:0,provisional:5,pending:11});
 for(const code of ["KR","CN","VN","TH","MY","SG","ID"])assert.equal(getCourseRecords(code).length,0);
 assert.equal(getDestination("US"),null);
});
