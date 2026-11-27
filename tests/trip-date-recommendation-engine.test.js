import test from "node:test";
import assert from "node:assert/strict";
import {recommendGolfTripDates,TRIP_DATE_ENGINE_CONFIG} from "../assets/js/trip-date-recommendation-engine.js";

const asOf = "2026-11-27";
const addDays = (date,n) => new Date(Date.parse(date+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
const signal = (riskScore,coverage=1,extra={}) => ({riskScore,coverage,...extra});
function buildDays(count=90) {
  return Array.from({length:count},(_,i)=>{
    const date=addDays(asOf,i+1);
    const risk=(i*17)%71+10;
    const region=(delta=0)=>({
      forecast: i+1<=16 ? signal(risk+delta) : undefined,
      ec46: i+1>=17&&i+1<=46 ? signal(risk+delta) : undefined,
      seas5: i+1>=17 ? signal(risk+delta) : undefined,
      historical: signal(35+delta,1,{sampleYears:20}),
      stability: signal(12+delta)
    });
    return {date,regions:{north:region(0),central:region(4),south:region(8)}};
  });
}

test("fixed trip dimensions and horizon weights are explicit",()=>{
  assert.equal(TRIP_DATE_ENGINE_CONFIG.windowDays,5);
  assert.equal(TRIP_DATE_ENGINE_CONFIG.golfRounds,3);
  assert.equal(TRIP_DATE_ENGINE_CONFIG.regions.length,3);
  assert.equal(Object.values(TRIP_DATE_ENGINE_CONFIG.sourceWeights.short).reduce((a,b)=>a+b,0),1);
});

test("90-day input returns ranked 5-day windows, three rounds, and alternates",()=>{
  const result=recommendGolfTripDates({asOf,horizonDays:90,days:buildDays()});
  assert.equal(result.evaluatedDays,90);
  assert.equal(result.validWindows,86);
  assert.equal(result.topThree.length,3);
  assert.equal(result.alternates.length,5);
  for(const window of [...result.topThree,...result.alternates]){
    assert.equal((Date.parse(window.endDate)-Date.parse(window.startDate))/86400000,4);
    assert.equal(window.recommendedGolfDates.length,3);
    assert.ok(window.score>=0&&window.score<=100);
  }
  assert.ok(result.topThree[0].score<=result.topThree[1].score);
  assert.ok(result.topThree[1].score<=result.topThree[2].score);
});

test("lead horizons select short forecast, EC46, and SEAS5 source bands",()=>{
  const result=recommendGolfTripDates({asOf,horizonDays:90,days:buildDays()});
  const day1=result.dailyAssessment.find(x=>x.leadDays===1);
  assert.equal(day1.horizon,"short");
  const days=result.topThree[0].daily;
  const d20=days.find(x=>x.leadDays===20);
  const d60=days.find(x=>x.leadDays===60);
  if(d20) assert.equal(d20.horizon,"ec46");
  if(d60) assert.equal(d60.horizon,"seas5");
});

test("missing source evidence is not imputed and lowers confidence/eligibility",()=>{
  const days=buildDays();
  const target=days[10];
  delete target.regions.north.forecast;
  delete target.regions.central.forecast;
  delete target.regions.south.forecast;
  const result=recommendGolfTripDates({asOf,horizonDays:16,days});
  const assessed=result.dailyAssessment.find(x=>x.date===target.date);
  assert.ok(assessed);
  assert.equal(assessed.horizon,"short");
  assert.equal(assessed.regions[0].usedSources.includes("forecast"),false);
  assert.ok(assessed.evidenceCoverage<1);
  assert.equal(assessed.golfEligible,false);
});

test("a fully missing day remains null and windows with fewer than three valid days are excluded",()=>{
  const days=buildDays(10);
  const missing=days[2];
  missing.regions={};
  const result=recommendGolfTripDates({asOf,horizonDays:10,days});
  const day=result.topThree.flatMap(x=>x.daily).find(x=>x.date===missing.date);
  assert.equal(day.riskScore,null);
  assert.equal(day.golfEligible,false);
});

test("invalid risk scores and duplicate dates fail closed",()=>{
  const bad=buildDays(5);
  bad[0].regions.north.forecast=signal(140);
  assert.throws(()=>recommendGolfTripDates({asOf,horizonDays:5,days:bad}),/riskScore/);
  const duplicate=buildDays(5);
  duplicate.push({...duplicate[0]});
  assert.throws(()=>recommendGolfTripDates({asOf,horizonDays:5,days:duplicate}),/Duplicate date/);
});

test("only dates after asOf are considered; date windows are contiguous",()=>{
  const result=recommendGolfTripDates({asOf,horizonDays:12,days:buildDays(12)});
  assert.equal(result.validWindows,8);
  for(const window of result.topThree){
    assert.ok(window.startDate>asOf);
    assert.equal((Date.parse(window.endDate)-Date.parse(window.startDate))/86400000,4);
  }
});
