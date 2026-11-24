import test from "node:test";
import assert from "node:assert/strict";
import {buildRawFieldDiagnostics} from "../scripts/lib/raw-field-diagnostics.mjs";

test("raw diagnostics distinguish provider source equality from normalization preservation",()=>{
 const course={
  id:"sample",name:"Sample Course",coordinateStatus:"verified",
  providers:{
   visualCrossing:{status:"available",data:{
    rawFieldDiagnostics:[
     {time:"2026-11-25T10:00:00",temperatureRaw:20,feelsLikeRaw:20,humidityRaw:80,windSpeedRawKmh:12,windGustRawKmh:18,precipitationRawMm:0,precipitationProbabilityRawPct:5}
    ],
    days:[{hours:[{time:"2026-11-25T10:00:00",temperatureC:20,feelsLikeC:20}]}]
   }},
   foreca:{status:"available",data:{
    hourly:{
     rawFieldDiagnostics:[
      {time:"2026-11-25T10:00+09:00",temperatureRaw:20,feelsLikeRaw:18,humidityRaw:80,windSpeedRawMs:3,windGustRawMs:5,precipitationRawMm:0,precipitationProbabilityRawPct:5}
     ],
     forecast:[{time:"2026-11-25T10:00+09:00",temperatureC:20,feelsLikeC:18}]
    }
   }}
  }
 };
 const report=buildRawFieldDiagnostics([course]);
 const result=report.courses[0];
 assert.equal(result.visualCrossing.rawFeelsLikeEqualToTemperatureCount,1);
 assert.equal(result.foreca.rawFeelsLikeEqualToTemperatureCount,0);
 assert.equal(result.visualCrossing.normalizationPreservedAllFeelsLikeValues,true);
 assert.equal(result.foreca.normalizationPreservedAllFeelsLikeValues,true);
 assert.equal(result.foreca.samples[0].rawFeelsLikeMinusTemperatureC,-2);
});

test("unavailable provider is reported without fabricating raw values",()=>{
 const report=buildRawFieldDiagnostics([{id:"x",name:"X",providers:{visualCrossing:{status:"unavailable"}}}]);
 assert.equal(report.courses[0].visualCrossing.status,"unavailable");
 assert.equal(report.courses[0].foreca.status,"unavailable");
});
