import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildRegionalCoverage} from "../assets/js/regional-coverage.js";

const countries=[
 {code:"JP",name:"Japan",nameZh:"日本",enabled:true},
 {code:"KR",name:"South Korea",nameZh:"韓國",enabled:false},
 {code:"VN",name:"Vietnam",nameZh:"越南",enabled:false}
];
const courses=[
 {id:"north-a",countryCode:"JP",region:"Okinawa",area:"北部",name:"North A",latitude:26.50,longitude:127.90,coordinateStatus:"user_provided_google_maps",enabled:true},
 {id:"north-b",countryCode:"JP",region:"Okinawa",area:"北部",name:"North B",latitude:26.52,longitude:127.92,coordinateStatus:"user_provided_google_maps",enabled:true},
 {id:"south-a",countryCode:"JP",region:"Okinawa",area:"南部",name:"South A",latitude:26.10,longitude:127.70,coordinateStatus:"user_provided_google_maps",enabled:true},
 {id:"pending",countryCode:"JP",region:"Okinawa",area:"離島",name:"Pending",latitude:null,longitude:null,enabled:true},
 {id:"disabled",countryCode:"JP",region:"Okinawa",area:"中部",name:"Disabled",latitude:26.3,longitude:127.8,enabled:false}
];

test("coverage groups courses by country, region and subregion, then selects one centroid-nearest representative",()=>{
 const result=buildRegionalCoverage(countries,courses);
 assert.equal(result.countryCount,3);
 assert.equal(result.enabledCountryCount,1);
 assert.equal(result.countriesWithCoverage,1);
 assert.equal(result.subregionCount,2);
 const japan=result.countries.find(x=>x.code==="JP");
 assert.equal(japan.subregionCount,2);
 assert.equal(japan.subregions.find(x=>x.area==="北部").candidateCount,2);
 assert.equal(japan.subregions.find(x=>x.area==="北部").representative.id,"north-b");
 assert.equal(japan.subregions.find(x=>x.area==="南部").representative.id,"south-a");
});

test("countries without course data remain explicitly uncovered",()=>{
 const result=buildRegionalCoverage(countries,courses);
 assert.equal(result.countries.find(x=>x.code==="KR").subregionCount,0);
 assert.deepEqual(result.countries.find(x=>x.code==="VN").subregions,[]);
});

test("invalid inputs are rejected",()=>{
 assert.throws(()=>buildRegionalCoverage({},[]),/arrays/);
});

test("canonical registry retains planned countries and uses the designated representative course",()=>{
 const registry=[
  {countryCode:"JP",subregions:[{id:"JP-OKI-NORTH",region:"Okinawa",subregion:"北部",label:"沖繩北部",representativeCourseId:"north-b"}]},
  {countryCode:"KR",coverageStatus:"planned",subregions:[]}
 ];
 const result=buildRegionalCoverage(countries,courses,registry);
 const japan=result.countries.find(x=>x.code==="JP");
 assert.equal(japan.subregionCount,2);
 assert.equal(japan.subregions.find(x=>x.area==="北部").representative.id,"north-b");
 assert.equal(japan.subregions.find(x=>x.area==="北部").coverageStatus,"ready");
 assert.equal(result.countries.find(x=>x.code==="KR").registryStatus,"planned");
});

test("eight-country subregion registry has unique IDs and only the verified Okinawa pilot enabled",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const courseCatalog=JSON.parse(readFileSync(new URL("../config/global/courses.json",import.meta.url),"utf8"));
 assert.equal(registry.countries.length,8);
 assert.deepEqual(registry.countries.map(x=>x.countryCode),["JP","KR","CN","VN","TH","MY","SG","ID"]);
 const all=registry.countries.flatMap(x=>x.subregions.map(s=>({...s,countryCode:x.countryCode})));
 assert.equal(all.length,62);
 assert.equal(new Set(all.map(x=>x.id)).size,all.length);
 const configured=all.filter(x=>x.coverageStatus==="configured");
 assert.deepEqual(configured.map(x=>x.id).sort(),["JP-OKI-CENTRAL","JP-OKI-NORTH","JP-OKI-SOUTH"]);
 for(const item of configured){
  assert.ok(courseCatalog.some(course=>course.id===item.representativeCourseId&&course.countryCode===item.countryCode&&course.enabled&&Number.isFinite(course.latitude)&&Number.isFinite(course.longitude)));
 }
 for(const item of all.filter(x=>x.countryCode!=="JP"||!x.id.startsWith("JP-OKI-"))){
  assert.equal(item.coverageStatus,"planned");
  assert.equal(item.representativeCourseId,null);
 }
});

test("all planned subregions expose a research candidate without enabling forecast use",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const all=registry.countries.flatMap(x=>x.subregions);
 const candidates=all.filter(x=>typeof x.candidateCourseName==="string");
 assert.equal(candidates.length,59);
 assert.ok(candidates.every(x=>typeof x.candidateCourseName==="string"&&x.candidateCourseName.length>3));
 assert.ok(candidates.every(x=>x.representativeCourseId===null));
 assert.ok(candidates.every(x=>x.coverageStatus==="planned"));
 assert.equal(registry.candidateCount,59);
});


test("Japan has 16 mainland subregions with researched coordinates and no premature forecast enablement",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const mainland=japan.subregions.filter(x=>!x.id.startsWith("JP-OKI-"));
 assert.equal(japan.subregions.length,19);
 assert.equal(mainland.length,16);
 assert.ok(mainland.every(x=>x.candidateCourseName&&x.candidateCoordinates));
 assert.ok(mainland.every(x=>x.candidateCoordinates.timezone==="Asia/Tokyo"));
 assert.ok(mainland.every(x=>x.representativeCourseId===null&&x.coverageStatus==="planned"));
 const approximate=mainland.filter(x=>x.candidateCoordinates.coordinateStatus.includes("approximate"));
 assert.equal(approximate.length,1);
 assert.equal(approximate[0].candidateCourseName,"Leograd Golf Club");
 assert.equal(japan.coordinateResearchSummary.forecastEnabled,false);
});

test("Japan configured Okinawa representatives map to enabled course catalog records",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const courseCatalog=JSON.parse(readFileSync(new URL("../config/global/courses.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 for(const item of japan.subregions.filter(x=>x.id.startsWith("JP-OKI-"))){
  const course=courseCatalog.find(x=>x.id===item.representativeCourseId);
  assert.ok(course&&course.enabled);
  assert.equal(course.countryCode,"JP");
  assert.equal(course.region,"Okinawa");
  assert.equal(course.timezone,"Asia/Tokyo");
  assert.ok(Number.isFinite(course.latitude)&&Number.isFinite(course.longitude));
 }
});


test("Japan mainland candidate IDs are stable, unique, and cannot be mistaken for enabled course IDs",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const mainland=japan.subregions.filter(x=>!x.id.startsWith("JP-OKI-"));
 const ids=mainland.map(x=>x.candidateCourseId);
 assert.equal(ids.length,16);
 assert.ok(ids.every(x=>typeof x==="string"&&x.startsWith("jp-")));
 assert.equal(new Set(ids).size,16);
 assert.ok(mainland.every(x=>x.representativeCourseId===null));
});


test("Japan Setouchi representative candidate uses official Google Maps place coordinates",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const setouchi=japan.subregions.find(x=>x.candidateCourseName==="Setouchi Golf Resort");
 assert.equal(setouchi.candidateCoordinates.latitude,34.3061999);
 assert.equal(setouchi.candidateCoordinates.longitude,132.864325);
 assert.equal(setouchi.candidateCoordinates.coordinateStatus,"official-google-maps-place-coordinate");
 assert.match(setouchi.candidateCoordinates.coordinateSourceUrl,/maps\.app\.goo\.gl/);
 assert.equal(setouchi.representativeCourseId,null);
});


test("an invalid explicitly designated representative never silently falls back to another course",()=>{
 const registry=[
  {countryCode:"JP",subregions:[{id:"JP-OKI-NORTH",region:"Okinawa",subregion:"北部",label:"沖繩北部",representativeCourseId:"missing-course-id"}]}
 ];
 const result=buildRegionalCoverage(countries,courses,registry);
 const north=result.countries.find(x=>x.code==="JP").subregions.find(x=>x.area==="北部");
 assert.equal(north.representative,null);
 assert.equal(north.requestedRepresentativeCourseId,"missing-course-id");
 assert.equal(north.coverageStatus,"invalid-representative-course-id");
 assert.equal(result.countries.find(x=>x.code==="JP").readySubregionCount,1);
});


test("Japan official identity and address verification is recorded without enabling forecast coordinates",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const mainland=japan.subregions.filter(x=>!x.id.startsWith("JP-OKI-"));
 const verified=mainland.filter(x=>x.courseIdentityVerification?.verificationLevel);
 assert.equal(verified.length,13);
 for(const item of verified){
  assert.ok(item.courseIdentityVerification.officialSourceUrl.startsWith("https://"));
  assert.ok(item.courseIdentityVerification.officialAddress.length>15);
  assert.equal(item.representativeCourseId,null);
  assert.equal(item.coverageStatus,"planned");
 }
 const appi=mainland.find(x=>x.candidateCourseName==="Appi Kogen Golf Club");
 assert.match(appi.courseIdentityVerification.verificationLevel,/2026-season-confirmed/);
 const setouchi=mainland.find(x=>x.candidateCourseName==="Setouchi Golf Resort");
 assert.equal(setouchi.courseIdentityVerification.verificationLevel,"official-operator-identity-address-and-google-maps-link-confirmed");
 const stillPending=mainland.filter(x=>!x.courseIdentityVerification);
 assert.deepEqual(stillPending.map(x=>x.candidateCourseName).sort(),["Rifu Golf Club","Tokinodai Country Club","Tsu Country Club"].sort());
 assert.equal(japan.coordinateResearchSummary.forecastEnabled,false);
});
