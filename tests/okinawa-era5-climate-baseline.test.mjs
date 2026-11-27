import test from "node:test";
import assert from "node:assert/strict";
import {buildMonthlyClimateBaseline} from "../scripts/okinawa-era5-climate-baseline.js";
test("monthly climate baseline excludes year-months below 90 percent daily coverage",()=>{
 const time=[],precipitation_sum=[];
 for(let d=1;d<=31;d++){time.push("2020-01-"+String(d).padStart(2,"0"));precipitation_sum.push(2);}
 for(let d=1;d<=20;d++){time.push("2021-01-"+String(d).padStart(2,"0"));precipitation_sum.push(3);}
 const result=buildMonthlyClimateBaseline({time,precipitation_sum},{startYear:2020,endYear:2021});
 const jan=result.months[0];
 assert.equal(jan.sampleYears,1);assert.equal(jan.monthlyPrecipitationMeanMm,62);assert.equal(jan.excludedYears[0].year,2021);
});
test("monthly baseline retains dry days as valid zero observations, not missing data",()=>{
 const time=Array.from({length:31},(_,i)=>"2020-01-"+String(i+1).padStart(2,"0"));
 const result=buildMonthlyClimateBaseline({time,precipitation_sum:Array(31).fill(0)},{startYear:2020,endYear:2020});
 assert.equal(result.months[0].sampleYears,1);assert.equal(result.months[0].monthlyPrecipitationMeanMm,0);assert.equal(result.months[0].rainDaysMean,0);
});
test("baseline rejects malformed daily payloads",()=>{
 assert.throws(()=>buildMonthlyClimateBaseline({}, {startYear:2020,endYear:2021}),/missing daily/);
});
