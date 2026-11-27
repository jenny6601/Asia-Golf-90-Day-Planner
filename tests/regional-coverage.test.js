import test from "node:test";
import assert from "node:assert/strict";
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
 assert.equal(japan.subregions.find(x=>x.area==="北部").representative.id,"north-a");
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
  {countryCode:"KR",subregions:[]}
 ];
 const result=buildRegionalCoverage(countries,courses,registry);
 const japan=result.countries.find(x=>x.code==="JP");
 assert.equal(japan.subregionCount,2);
 assert.equal(japan.subregions.find(x=>x.area==="北部").representative.id,"north-b");
 assert.equal(japan.subregions.find(x=>x.area==="北部").coverageStatus,"ready");
 assert.equal(result.countries.find(x=>x.code==="KR").registryStatus,"planned");
});
