import test from "node:test";
import assert from "node:assert/strict";
import {buildProviderConsistencyReport,localHourKey} from "../scripts/lib/provider-consistency.mjs";

const row=(time,temp,feels)=>({time,temperatureC:temp,feelsLikeC:feels,precipitationProbabilityPct:10,precipitationMm:0.2,windSpeedMs:4,windGustMs:6});
const course={
 id:"test-course",name:"Test Course",coordinateStatus:"verified",
 providers:{
  openMeteo:{status:"available",data:{hourly:[row("2026-11-25T10:00",20,18),row("2026-11-25T11:00",21,19)]}},
  visualCrossing:{status:"available",data:{days:[{datetime:"2026-11-25",hours:[row("2026-11-25T10:00:00",20.5,20.5),row("2026-11-25T11:00:00",21.5,21.5)]}]}},
  foreca:{status:"available",data:{hourly:{forecast:[row("2026-11-25T10:00+09:00",20.2,20.2),row("2026-11-25T11:00+09:00",21.2,21.2)]}}}
 }
};

test("local hour alignment preserves Japan wall-clock hour across timestamp formats",()=>{
 assert.equal(localHourKey("2026-11-25T10:00"),"2026-11-25T10");
 assert.equal(localHourKey("2026-11-25T10:00:00"),"2026-11-25T10");
 assert.equal(localHourKey("2026-11-25T10:00+09:00"),"2026-11-25T10");
 assert.equal(localHourKey("invalid"),null);
});

test("consistency report compares only common 10:00–16:00 local hours",()=>{
 const report=buildProviderConsistencyReport([course]);
 const result=report.courses[0];
 assert.equal(result.totalSharedLocalHours,2);
 assert.equal(result.days[0].matchedCommonHours,2);
 assert.equal(result.days[0].providers.openMeteo.feelsLikeVsAirTemperature.equalCount,0);
 assert.equal(result.days[0].providers.visualCrossing.feelsLikeVsAirTemperature.equalCount,2);
 assert.equal(result.days[0].providers.foreca.feelsLikeVsAirTemperature.equalCount,2);
 assert.equal(result.days[0].pairwise.openMeteo__visualCrossing.feelsLikeC.meanAbsoluteDifference,2.5);
 assert.equal(result.days[0].pairwise.visualCrossing__foreca.temperatureC.meanAbsoluteDifference,0.3);
});

test("missing provider records do not get fabricated or counted as shared hours",()=>{
 const partial={...course,providers:{...course.providers,foreca:{status:"unavailable"}}};
 const report=buildProviderConsistencyReport([partial]);
 assert.equal(report.courses[0].totalSharedLocalHours,0);
 assert.equal(report.courses[0].days.length,0);
});
