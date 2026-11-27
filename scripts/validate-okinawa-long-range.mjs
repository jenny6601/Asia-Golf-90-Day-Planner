import fs from "node:fs/promises";
import {fetchCourseSeasonalForecast,fetchCourseHistoricalWeekNormals} from "../assets/js/long-range-api.js";
import {buildDailyClimateOutlook} from "../assets/js/daily-climate-outlook.js";

const root=new URL("../",import.meta.url);
const courses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8")).filter(x=>x.countryCode==="JP"&&x.region==="Okinawa"&&x.enabled);
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const add=(date,n)=>new Date(Date.parse(date+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
const referenceDate=today();
const dates=Array.from({length:72},(_,i)=>add(referenceDate,18+i));
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const results=[];
for(const course of courses){
 const result={courseId:course.id,name:course.name,coordinate:{latitude:course.latitude,longitude:course.longitude},referenceDate,horizon:{start:dates[0],end:dates.at(-1),days:72}};
 try{
  const [seasonal,history]=await Promise.all([fetchCourseSeasonalForecast(course),fetchCourseHistoricalWeekNormals(course,dates)]);
  const estimates=buildDailyClimateOutlook(seasonal,history.days,referenceDate,90);
  const byLead=leads=>estimates.filter(x=>leads.includes(x.band));
  const summarize=rows=>({days:rows.length,completeCombined:rows.filter(x=>x.sourceType==="seasonal-plus-historical-estimate").length,historyOnly:rows.filter(x=>x.sourceType==="historical-climate-reference").length,seasonalOnly:rows.filter(x=>x.sourceType==="seasonal-signal-without-daily-baseline").length,insufficient:rows.filter(x=>x.sourceType==="insufficient-data").length,missingHigh:rows.filter(x=>!finite(x.highEstimate)).length,missingLow:rows.filter(x=>!finite(x.lowEstimate)).length,missingRainAmount:rows.filter(x=>!finite(x.rainEstimate)).length,missingRainFrequencyEstimate:rows.filter(x=>!finite(x.rainChanceEstimate)).length,missingWind:rows.filter(x=>!finite(x.windMeanEstimate)).length,minHistoryRainYears:Math.min(...rows.map(x=>x.historicalRainSampleYears)),minHistoryTemperatureYears:Math.min(...rows.map(x=>x.historicalTemperatureSampleYears)),minSeasonalEvidence:Math.min(...rows.map(x=>x.seasonalEvidenceCount))});
  const ec=seasonal.weekly||{},sm=seasonal.monthly||{};
  const weeklyFields=["precipitation_efi","precipitation_mean","precipitation_anomaly","temperature_2m_anomaly","wind_speed_10m_mean"];
  const monthlyFields=["precipitation_mean","precipitation_anomaly","temperature_2m_anomaly","wind_speed_10m_mean"];
  const coverage=(section,fields)=>Object.fromEntries(fields.map(k=>{const a=section?.[k]||[];const valid=a.filter(finite).length;return [k,{valid,expected:section?.time?.length||0,coverage:section?.time?.length?valid/section.time.length:0}]}));
  const early=estimates.filter(x=>x.lead>=19&&x.lead<=46),late=estimates.filter(x=>x.lead>=47&&x.lead<=90);
  result.seasonal={provider:seasonal.provider,model:seasonal.model,timezone:seasonal.timezone,weeklyPeriods:ec.time?.length||0,monthlyPeriods:sm.time?.length||0,weeklyCoverage:coverage(ec,weeklyFields),monthlyCoverage:coverage(sm,monthlyFields)};
  result.historical={provider:history.provider||"Open-Meteo Historical Weather API",startYear:history.startYear,endYear:history.endYear,requestedDays:dates.length,returnedDays:history.days?.length||0,rainThresholdMm:1};
  result.earlyBand=summarize(early);result.lateBand=summarize(late);result.total=summarize(estimates);
  result.pass=estimates.length===72&&new Set(estimates.map(x=>x.date)).size===72&&estimates[0]?.lead===19&&estimates.at(-1)?.lead===90&&estimates.every(x=>x.sourceType==="seasonal-plus-historical-estimate"&&finite(x.highEstimate)&&finite(x.lowEstimate)&&finite(x.rainEstimate)&&finite(x.rainChanceEstimate)&&finite(x.windMeanEstimate)&&x.historicalRainSampleYears>=8&&x.historicalTemperatureSampleYears>=8);
 }catch(error){result.error=String(error);result.pass=false;}
 results.push(result);
 await new Promise(resolve=>setTimeout(resolve,500));
}
const report={generatedAt:new Date().toISOString(),referenceDate,horizon:"D19-D90 inclusive (72 dates)",scope:"All six Okinawa course GPS points",interpretation:"Historical same-calendar-day ERA5 wet-day frequency adjusted by weekly/monthly ECMWF seasonal anomaly signals. The rainChanceEstimate is an adjusted climatological frequency estimate, not calibrated daily precipitation probability.",results,allSixPass:results.length===6&&results.every(x=>x.pass),limitations:["ERA5 historical data are reanalysis, not on-course observations.","ECMWF EC46 and SEAS5 signals are weekly/monthly anomaly context, not deterministic daily forecasts.","No daily precipitation probability is produced; rainChanceEstimate is explicitly an adjusted historical wet-day frequency estimate.","No gust forecast is inferred for D19-D90 where the engine does not provide a validated gust field.","Confidence remains low or very low for long-range estimates and must not be interpreted as forecast skill."]};
await fs.mkdir("artifacts/okinawa-acceptance",{recursive:true});
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-long-range-validation.json",JSON.stringify(report,null,2));
const lines=["# Okinawa D19-D90 Course-Level Seasonal + Historical Validation","",`Generated: ${report.generatedAt}`,`Reference date (Asia/Taipei): ${referenceDate}`,"","Scope: six course GPS points; 72 daily estimates per course; D19-D90.","",`**All six course gate:** ${report.allSixPass?"PASS":"FAIL"}`,"","| Course | Seasonal model | D19-D46 combined / 28 | D47-D90 combined / 44 | Missing estimate fields | Min history years | Result |","|---|---|---:|---:|---:|---:|---|",...results.map(x=>{const t=x.total||{};const miss=(t.missingHigh||0)+(t.missingLow||0)+(t.missingRainAmount||0)+(t.missingRainFrequencyEstimate||0)+(t.missingWind||0);return `| ${x.name} | ${x.seasonal?.model||"—"} | ${x.earlyBand?.completeCombined??0}/28 | ${x.lateBand?.completeCombined??0}/44 | ${miss} | ${Math.min(t.minHistoryRainYears??0,t.minHistoryTemperatureYears??0)} | ${x.pass?"PASS":"FAIL"} |`;}),"","## Detailed results","",...results.map(x=>`### ${x.name}\n- Seasonal: ${JSON.stringify(x.seasonal||x.error)}\n- Historical: ${JSON.stringify(x.historical||{})}\n- D19-D46: ${JSON.stringify(x.earlyBand||{})}\n- D47-D90: ${JSON.stringify(x.lateBand||{})}\n- Total: ${JSON.stringify(x.total||{})}`),"","## Interpretation guardrails",...report.limitations.map(x=>"- "+x)];
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-long-range-validation.md",lines.join("\n"));
console.log(lines.join("\n"));
if(!report.allSixPass)process.exitCode=1;