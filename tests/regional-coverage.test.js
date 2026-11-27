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
 assert.equal(verified.length,16);
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
 assert.ok(mainland.every(x=>x.courseIdentityVerification?.officialSourceUrl?.startsWith("https://")));
 const rifu=mainland.find(x=>x.candidateCourseName==="Rifu Golf Club");
 assert.match(rifu.courseIdentityVerification.verificationLevel,/official-PGM-operator/);
 const tsu=mainland.find(x=>x.candidateCourseName==="Tsu Country Club");
 assert.match(tsu.courseIdentityVerification.verificationLevel,/official-operator/);
 const tokinodai=mainland.find(x=>x.candidateCourseName==="Tokinodai Country Club");
 assert.match(tokinodai.courseIdentityVerification.verificationLevel,/2026-calendar-confirmed/);
 assert.equal(japan.coordinateResearchSummary.forecastEnabled,false);
});


test("Japan mainland GPS candidates have evidence grades and all are accepted for regional climate assessment",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const mainland=japan.subregions.filter(x=>!x.id.startsWith("JP-OKI-"));
 const count=grade=>mainland.filter(x=>x.coordinateQuality?.grade===grade).length;
 assert.equal(count("A"),3);
 assert.equal(count("B"),12);
 assert.equal(count("C"),1);
 assert.ok(mainland.every(x=>x.coordinateQuality.weatherPointEligible===true&&x.coordinateQuality.regionalClimateEligible===true));
 assert.ok(mainland.every(x=>x.coordinateQuality.reviewStatus));
 const leograd=mainland.find(x=>x.candidateCourseName==="Leograd Golf Club");
 assert.equal(leograd.coordinateQuality.grade,"C");
 assert.equal(leograd.candidateCoordinates.latitude,33.9232299832);
 assert.match(leograd.candidateCoordinates.officialMapEmbedUrl,/google\.com\/maps\/embed/);
 const setouchi=mainland.find(x=>x.candidateCourseName==="Setouchi Golf Resort");
 assert.equal(setouchi.coordinateQuality.grade,"A");
 assert.equal(japan.coordinateResearchSummary.weatherPointEligible,16);
 assert.equal(japan.coordinateResearchSummary.forecastEnabled,false);
});


test("The North Country official map viewport center is stored as evidence, never as a course pin",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const north=japan.subregions.find(x=>x.candidateCourseName==="The North Country Golf Club");
 const map=north.coordinateQuality.officialMapReference;
 assert.equal(map.coordinateType,"map-viewport-center-not-pin");
 assert.equal(map.latitude,42.8171806);
 assert.equal(map.longitude,141.6011047);
 assert.equal(map.distanceFromCandidateKm,0.532);
 assert.equal(north.coordinateQuality.grade,"B");
 assert.equal(north.coordinateQuality.weatherPointEligible,true);
 assert.equal(north.candidateCoordinates.latitude,42.82058);
});


test("Japan official map cross-checks preserve pin versus viewport-center semantics",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const find=name=>japan.subregions.find(x=>x.candidateCourseName===name);
 const hokkaido=find("Hokkaido Country Club");
 assert.equal(hokkaido.candidateCoordinates.coordinateStatus,"official-operator-google-maps-place-pin");
 assert.equal(hokkaido.candidateCoordinates.latitude,41.9892895);
 assert.equal(hokkaido.candidateCoordinates.longitude,140.6549955);
 assert.equal(hokkaido.coordinateQuality.officialMapReference.coordinateType,"place-pin-coordinate");
 assert.equal(hokkaido.coordinateQuality.officialMapReference.distanceFromPreviousCandidateKm,0.583);
 const seven=find("Seven Hundred Club");
 assert.equal(seven.coordinateQuality.officialMapReference.coordinateType,"map-viewport-center-not-pin");
 assert.equal(seven.coordinateQuality.officialMapReference.distanceFromCandidateKm,0.001);
 const narita=find("Narita Hills Country Club");
 assert.equal(narita.coordinateQuality.officialMapReference.coordinateType,"map-viewport-center-not-pin");
 assert.equal(narita.coordinateQuality.officialMapReference.distanceFromCandidateKm,0.122);
 assert.ok([hokkaido,seven,narita].every(x=>x.coordinateQuality.weatherPointEligible===true));
});


test("Japan Kawaguchiko official place pin and low-zoom map centers are not conflated",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const find=name=>japan.subregions.find(x=>x.candidateCourseName===name);
 const kawaguchiko=find("Kawaguchiko Country Club");
 assert.equal(kawaguchiko.candidateCoordinates.coordinateStatus,"official-operator-google-maps-place-pin");
 assert.equal(kawaguchiko.candidateCoordinates.latitude,35.4682136);
 assert.equal(kawaguchiko.candidateCoordinates.longitude,138.7517012);
 assert.equal(kawaguchiko.coordinateQuality.officialMapReference.coordinateType,"place-pin-coordinate");
 assert.equal(kawaguchiko.coordinateQuality.officialMapReference.distanceFromPreviousCandidateKm,0.127);
 const toki=find("Tokinodai Country Club");
 assert.equal(toki.coordinateQuality.officialMapReference.coordinateType,"map-viewport-center-not-pin");
 assert.equal(toki.coordinateQuality.officialMapReference.mapZoomScale,"approximately-42km-map-width");
 assert.equal(toki.coordinateQuality.weatherPointEligible,true);
 const appi=find("Appi Kogen Golf Club");
 assert.equal(appi.coordinateQuality.officialMapReference.coordinateType,"no-official-pin-extracted");
 assert.equal(appi.coordinateQuality.weatherPointEligible,true);
});


test("Japan remaining five GPS reviews retain conservative official map evidence",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const find=name=>japan.subregions.find(x=>x.candidateCourseName===name);
 const rifu=find("Rifu Golf Club");
 assert.equal(rifu.coordinateQuality.officialMapReference.coordinateType,"no-official-pin-extracted");
 const tsu=find("Tsu Country Club");
 assert.equal(tsu.coordinateQuality.officialMapReference.coordinateType,"no-official-pin-extracted");
 const arima=find("Arima Royal Golf Club");
 assert.equal(arima.coordinateQuality.officialMapReference.coordinateType,"map-viewport-center-not-pin");
 assert.equal(arima.coordinateQuality.officialMapReference.distanceFromCandidateKm,1.724);
 const leo=find("Leograd Golf Club");
 assert.equal(leo.coordinateQuality.officialMapReference.coordinateType,"map-viewport-center-not-pin");
 assert.equal(leo.coordinateQuality.grade,"C");
 const daisen=find("Green Park Daisen Golf Club");
 assert.equal(daisen.coordinateQuality.officialMapReference.coordinateType,"map-pin-not-extracted");
 assert.ok([rifu,tsu,arima,leo,daisen].every(x=>x.coordinateQuality.weatherPointEligible===true));
});


test("Japan Setouchi official pin and Tosa/Phoenix evidence are recorded conservatively",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const find=name=>japan.subregions.find(x=>x.candidateCourseName===name);
 const setouchi=find("Setouchi Golf Resort");
 assert.equal(setouchi.candidateCoordinates.coordinateStatus,"official-operator-google-maps-place-pin");
 assert.equal(setouchi.coordinateQuality.officialMapReference.coordinateType,"place-pin-coordinate");
 assert.equal(setouchi.coordinateQuality.officialMapReference.googleMapsPlaceId,"0x355042079326d21b:0x3526427e5fc188a6");
 assert.equal(setouchi.coordinateQuality.weatherPointEligible,true);
 const tosa=find("Tosa Country Club");
 assert.equal(tosa.coordinateQuality.officialMapReference.coordinateType,"map-viewport-center-not-pin");
 assert.equal(tosa.coordinateQuality.officialMapReference.distanceFromCandidateKm,0.010);
 const phoenix=find("Phoenix Country Club");
 assert.equal(phoenix.coordinateQuality.officialMapReference.coordinateType,"no-official-pin-extracted");
 assert.equal(phoenix.coordinateQuality.weatherPointEligible,true);
});


test("Japan GPS decision matrix covers all 16 mainland subregions and accepts regional representative points without activating forecasts",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const matrix=JSON.parse(readFileSync(new URL("../config/global/japan-gps-quality-matrix.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(x=>x.countryCode==="JP");
 const mainland=japan.subregions.filter(x=>!x.id.startsWith("JP-OKI-"));
 assert.equal(matrix.schemaVersion,"1.0.0");
 assert.equal(matrix.entries.length,16);
 assert.equal(matrix.summary.mainlandSubregions,16);
 assert.equal(matrix.summary.officialPlacePins,3);
 assert.equal(matrix.summary.regionalClimateEligible,16);
 assert.equal(matrix.summary.officialMapViewportCenters,8);
 assert.equal(matrix.summary.officialAccessOrAddressReferences,5);
 assert.equal(matrix.summary.forecastEnabled,0);
 assert.deepEqual(matrix.summary.legacyGrades,{A:3,B:12,C:1});
 assert.equal(new Set(matrix.entries.map(x=>x.subregionId)).size,16);
 for(const entry of matrix.entries){
  const source=mainland.find(x=>x.id===entry.subregionId);
  assert.ok(source,entry.subregionId+" must exist in regional registry");
  assert.equal(entry.representativeCandidate,source.candidateCourseName);
  assert.equal(entry.candidateCoordinate.latitude,source.candidateCoordinates.latitude);
  assert.equal(entry.candidateCoordinate.longitude,source.candidateCoordinates.longitude);
  assert.equal(entry.weatherPointEligible,true);
  assert.equal(entry.regionalClimateEligible,true);
  assert.equal(source.coordinateQuality.weatherPointEligible,true);
 }
 const seven=matrix.entries.find(x=>x.representativeCandidate==="Seven Hundred Club");
 assert.equal(seven.legacyGrade,"B");
 assert.equal(seven.evidenceClass,"official-map-viewport-center-only");
 const classic=matrix.entries.find(x=>x.representativeCandidate==="The Classic Golf Club");
 assert.equal(classic.evidenceClass,"official-map-viewport-center-only");
 assert.equal(classic.offsetFromCandidateKm,0.202);
});
