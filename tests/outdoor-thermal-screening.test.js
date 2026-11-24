import test from "node:test";
import assert from "node:assert/strict";
import {calculateHumidexC,humidexCategory,buildOutdoorThermalScreening} from "../scripts/lib/outdoor-thermal-screening.mjs";

test("humidex derives from air temperature and relative humidity",()=>{
 const value=calculateHumidexC(30,70);
 assert.ok(value>40&&value<43);
 assert.equal(calculateHumidexC(25,null),null);
 assert.equal(calculateHumidexC(25,0),null);
 assert.equal(calculateHumidexC(25,101),null);
});

test("humidex categories use published Environment Canada ranges",()=>{
 assert.equal(humidexCategory(25),"little-discomfort");
 assert.equal(humidexCategory(35),"some-discomfort");
 assert.equal(humidexCategory(42),"great-discomfort");
 assert.equal(humidexCategory(45.01),"dangerous");
 assert.equal(humidexCategory(45),"great-discomfort");
 assert.equal(humidexCategory(null),"unavailable");
});

test("screening keeps source feels-like separate and retains solar and wind exposure",()=>{
 const course={id:"x",name:"Course",coordinateStatus:"verified",providers:{
  openMeteo:{status:"available",data:{hourly:[
   {time:"2026-11-25T10:00",temperatureC:30,feelsLikeC:29,relativeHumidityPct:70,windSpeedMs:3,windGustMs:5,shortwaveRadiationWm2:650,uvIndex:7}
  ]}},
  visualCrossing:{status:"available",data:{days:[{hours:[
   {time:"2026-11-25T10:00:00",temperatureC:30,feelsLikeC:30,relativeHumidityPct:70,windSpeedMs:3,windGustMs:5}
  ]}] }},
  foreca:{status:"available",data:{hourly:{forecast:[
   {time:"2026-11-25T10:00+09:00",temperatureC:30,feelsLikeC:30,relativeHumidityPct:70,windSpeedMs:3,windGustMs:5}
  ]}}}
 }};
 const report=buildOutdoorThermalScreening([course]);
 const result=report.courses[0];
 assert.equal(result.providers.openMeteo.hours[0].derivedHumidexC,calculateHumidexC(30,70));
 assert.equal(result.providers.openMeteo.hours[0].solarRadiationWm2,650);
 assert.equal(result.providers.openMeteo.hours[0].uvIndex,7);
 assert.equal(result.providers.visualCrossing.hours[0].derivedHumidexC,result.providers.foreca.hours[0].derivedHumidexC);
 assert.equal(result.providers.visualCrossing.hours[0].temperatureC,30);
 assert.equal(result.providers.visualCrossing.hours[0].humidexCategory,"great-discomfort");
});

test("unavailable provider remains unavailable without synthetic hours",()=>{
 const report=buildOutdoorThermalScreening([{id:"x",name:"X",providers:{openMeteo:{status:"unavailable"}}}]);
 assert.equal(report.courses[0].providers.openMeteo.status,"unavailable");
 assert.deepEqual(report.courses[0].providers.openMeteo.hours,[]);
});
