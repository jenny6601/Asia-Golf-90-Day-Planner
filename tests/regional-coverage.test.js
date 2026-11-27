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

test("all 80 subregions have one assigned representative course and regional climate point",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const catalog=JSON.parse(readFileSync(new URL("../config/global/courses.json",import.meta.url),"utf8"));
 const all=registry.countries.flatMap(g=>g.subregions.map(s=>({...s,countryCode:g.countryCode})));
 const byId=new Map(catalog.map(c=>[c.id,c]));
 assert.equal(all.length,80);
 assert.equal(new Set(all.map(s=>s.id)).size,80);
 assert.equal(registry.candidateCount,0);
 for(const s of all){
  const c=byId.get(s.representativeCourseId);
  assert.ok(c,s.id);
  assert.equal(c.countryCode,s.countryCode,s.id);
  assert.equal(c.subregionId,s.id,s.id);
  assert.equal(c.enabled,true,s.id);
  assert.equal(c.weatherEnabled,false,s.id);
  assert.ok(Number.isFinite(s.candidateCoordinates?.latitude),s.id);
  assert.ok(Number.isFinite(s.candidateCoordinates?.longitude),s.id);
  assert.ok(s.candidateCoordinates?.timezone,s.id);
  assert.equal(s.regionalClimateEligible,true,s.id);
  assert.equal(s.coordinateQuality?.regionalClimateEligible,true,s.id);
 }
});

test("eight-country representatives cover the expected subregion counts",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 assert.deepEqual(registry.countries.map(g=>[g.countryCode,g.subregions.length]),[["JP",37],["KR",6],["CN",7],["VN",6],["TH",7],["MY",8],["SG",1],["ID",8]]);
 const japan=registry.countries.find(g=>g.countryCode==="JP");
 assert.equal(japan.subregions.filter(s=>s.region==="北海道").length,4);
 assert.equal(japan.subregions.filter(s=>s.id.startsWith("JP-OKI-")).length,5);
});

test("regional representative approval preserves existing official coordinate evidence",()=>{
 const registry=JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8"));
 const japan=registry.countries.find(g=>g.countryCode==="JP");
 const find=name=>japan.subregions.find(s=>s.candidateCourseName===name);
 const sapporo=find("Sapporo Teine Golf Club");
 assert.equal(sapporo.coordinateQuality.coordinateCrossCheck.officialOperatorMap.mapCode,"493 385 165*66");
 const hakodate=find("Hokkaido Country Club");
 assert.equal(hakodate.coordinateQuality.officialMapReference.coordinateType,"place-pin-coordinate");
 const setouchi=find("Setouchi Golf Resort");
 assert.equal(setouchi.coordinateQuality.officialMapReference.coordinateType,"place-pin-coordinate");
 assert.equal(setouchi.courseIdentityVerification.verificationLevel,"official-operator-identity-address-and-google-maps-link-confirmed");
});
