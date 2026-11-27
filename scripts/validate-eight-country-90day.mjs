import fs from "node:fs/promises";
import {fetchCourseSeasonalForecast,fetchCourseHistoricalWeekNormals} from "../assets/js/long-range-api.js";
import {buildDailyClimateOutlook} from "../assets/js/daily-climate-outlook.js";
import {classifyMonthlyDay,summarizeMonthlyWeather,firstAvailableMetric} from "../assets/js/monthly-weather-summary.js";

const countryOrder=["JP","KR","CN","VN","TH","MY","SG","ID"];
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const add=(date,n)=>new Date(Date.parse(date+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const referenceDate=today();
const dates=Array.from({length:74},(_,i)=>add(referenceDate,16+i)); // D17-D90
const fetchWithTimeout=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(60000)});
const [countries,courses,registry]=await Promise.all([
 fs.readFile(new URL("../config/global/countries.json",import.meta.url),"utf8").then(JSON.parse),
 fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8").then(JSON.parse),
 fs.readFile(new URL("../config/global/weather-subregions.json",import.meta.url),"utf8").then(JSON.parse)
]);
const subregions=registry.countries.flatMap(group=>(group.subregions||[]).map(s=>({...s,countryCode:group.countryCode,countryNameZh:group.countryNameZh})))
 .sort((a,b)=>countryOrder.indexOf(a.countryCode)-countryOrder.indexOf(b.countryCode)||a.id.localeCompare(b.id));
const byCourse=new Map(courses.map(course=>[course.id,course]));
for(const s of subregions){
 const c=byCourse.get(s.representativeCourseId);
 if(!c||c.countryCode!==s.countryCode||c.subregionId!==s.id||!Number.isFinite(s.candidateCoordinates?.latitude)||!Number.isFinite(s.candidateCoordinates?.longitude)||!s.candidateCoordinates?.timezone){
  throw new Error("Invalid regional representative configuration: "+s.id);
 }
 c.regionalClimate={representativePoint:{latitude:s.candidateCoordinates.latitude,longitude:s.candidateCoordinates.longitude},timezone:s.candidateCoordinates.timezone};
}
if(countries.length!==8||subregions.length!==80)throw new Error("Expected eight countries and 80 subregions");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
for(const subregion of subregions){
 const course=byCourse.get(subregion.representativeCourseId);
 const result={countryCode:subregion.countryCode,countryNameZh:subregion.countryNameZh,subregionId:subregion.id,subregion:subregion.label||subregion.subregion,representativeCourseId:course?.id||null,representativeCourseName:course?.name||null,referenceDate};
 try{
  if(!course)throw new Error("Representative course missing from directory");
  const [seasonal,history]=await Promise.all([
   fetchCourseSeasonalForecast(course,fetchWithTimeout),
   fetchCourseHistoricalWeekNormals(course,dates,fetchWithTimeout)
  ]);
  const estimates=buildDailyClimateOutlook(seasonal,history.days,referenceDate,90);
  const summarize=rows=>({
   days:rows.length,
   combined:rows.filter(x=>x.sourceType==="seasonal-plus-historical-estimate").length,
   historyOnly:rows.filter(x=>x.sourceType==="historical-climate-reference").length,
   seasonalOnly:rows.filter(x=>x.sourceType==="seasonal-signal-without-daily-baseline").length,
   insufficient:rows.filter(x=>x.sourceType==="insufficient-data").length,
   missingHigh:rows.filter(x=>!finite(x.highEstimate)).length,
   missingLow:rows.filter(x=>!finite(x.lowEstimate)).length,
   missingRainAmount:rows.filter(x=>!finite(x.rainEstimate)).length,
   missingRainFrequency:rows.filter(x=>!finite(x.rainChanceEstimate)).length,
   minRainSampleYears:Math.min(...rows.map(x=>x.historicalRainSampleYears)),
   minTemperatureSampleYears:Math.min(...rows.map(x=>x.historicalTemperatureSampleYears))
  });
  const weekly=seasonal.weekly||{},monthly=seasonal.monthly||{};
  const coverage=(block,fields)=>Object.fromEntries(fields.map(k=>{
   const values=block?.[k]||[],expected=block?.time?.length||0,valid=values.filter(finite).length;
   return [k,{valid,expected,coverage:expected?valid/expected:0}];
  }));
  const early=estimates.filter(x=>x.lead>=17&&x.lead<=46),late=estimates.filter(x=>x.lead>=47&&x.lead<=90);
  result.seasonal={provider:seasonal.provider,model:seasonal.model,timezone:seasonal.timezone,weeklyCoverage:coverage(weekly,["precipitation_efi","precipitation_anomaly_gt0","precipitation_mean","precipitation_anomaly","temperature_2m_anomaly"]),monthlyCoverage:coverage(monthly,["precipitation_mean","precipitation_anomaly","temperature_2m_anomaly"])};
  result.historical={provider:history.provider||"Open-Meteo Historical Weather API",startYear:history.startYear,endYear:history.endYear,referencePeriod:history.referencePeriod,requestedDays:dates.length,returnedDays:history.days?.length||0};
  result.d17D46=summarize(early);result.d47D90=summarize(late);result.total=summarize(estimates);
  result.pass=estimates.length===74&&new Set(estimates.map(x=>x.date)).size===74&&estimates[0]?.lead===17&&estimates.at(-1)?.lead===90&&estimates.every(x=>["seasonal-plus-historical-estimate","historical-climate-reference"].includes(x.sourceType)&&finite(x.highEstimate)&&finite(x.lowEstimate)&&finite(x.rainEstimate)&&finite(x.rainChanceEstimate)&&x.historicalRainSampleYears>=8&&x.historicalTemperatureSampleYears>=8);
  // Monthly-engine contract: assess future calendar dates with the exact same production classifier.
  const monthlyChecks=[];
  for(let monthOffset=0;monthOffset<3;monthOffset++){
   const monthDate=add(referenceDate,monthOffset*30),month=monthDate.slice(0,7);
   const monthDates=Array.from({length:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate()},(_,i)=>month+"-"+String(i+1).padStart(2,"0"));
   const dayRows=monthDates.map(date=>{
    const lead=Math.round((Date.parse(date+"T12:00:00Z")-Date.parse(referenceDate+"T12:00:00Z"))/86400000);
    const e=estimates.find(x=>x.date===date);
    if(lead>=16&&lead<=89&&e){
     const classification=classifyMonthlyDay({rainFrequency:e.rainChanceEstimate,rainAmount:e.rainEstimate,highTemp:e.highEstimate});
     return classification?{date,grade:classification.grade}:null;
    }
    const h=history.days.find(x=>x.date===date);
    if(h){
     const classification=classifyMonthlyDay({rainFrequency:h.rainFrequency,rainAmount:h.rainMean,highTemp:h.highMean});
     return classification?{date,grade:classification.grade}:null;
    }
    return null;
   }).filter(Boolean);
   const summary=summarizeMonthlyWeather(dayRows,referenceDate,monthDates);
   monthlyChecks.push({month,expectedDays:summary.expectedDays,validDays:summary.validDays,coverage:summary.coverage,label:summary.label,counts:summary.counts,pass:summary.label==="資料不足"||summary.validDays<=summary.expectedDays});
  }
  result.monthlyChecks=monthlyChecks;
 }catch(error){result.error=String(error);result.pass=false;}
 results.push(result);
 if(results.length%5===0)console.log("Validated subregions:",results.length,"/",subregions.length);
 await sleep(250);
}
const countries=countryOrder.map(code=>{
 const rows=results.filter(x=>x.countryCode===code);
 return {countryCode:code,countryNameZh:rows[0]?.countryNameZh||code,subregions:rows.length,passed:rows.filter(x=>x.pass).length,failed:rows.filter(x=>!x.pass).length,meanD17D46Coverage:rows.length?rows.reduce((s,x)=>s+(x.d17D46?.combined||0),0)/(rows.length*30):0,meanD47D90Coverage:rows.length?rows.reduce((s,x)=>s+(x.d47D90?.combined||0),0)/(rows.length*44):0};
});
const report={generatedAt:new Date().toISOString(),referenceDate,horizon:"D17-D90 (74 days)",scope:"All eight countries and all 80 regional representative climate points; equal per-subregion validation, Okinawa is included within Japan and is not a separate priority.",method:"For each representative point, compare weekly/monthly ECMWF seasonal signals with ERA5 1991-2020 same-calendar-day historical normals, then run the production D17-D90 estimator and production monthly classifier. This validates data completeness and rule consistency, not forecast skill.",countrySummary:countries,subregionResults:results,allPass:results.length===80&&results.every(x=>x.pass),limitations:["ERA5 is reanalysis, not on-course observations.","ECMWF seasonal weekly/monthly fields are anomaly context, not deterministic daily forecasts.","rainChanceEstimate is adjusted historical wet-day frequency, not calibrated daily precipitation probability.","A passing data-completeness gate does not establish forecast accuracy; archived forecast-versus-observation pairs are needed for skill verification.","Monthly sample checks use the same production classifier and do not alter UI or thresholds."]};
await fs.mkdir("artifacts/eight-country-validation",{recursive:true});
await fs.writeFile("artifacts/eight-country-validation/eight-country-90day-validation.json",JSON.stringify(report,null,2));
const lines=["# Eight-Country D17-D90 and Monthly Engine Validation","",`Generated: ${report.generatedAt}`,`Reference date (Asia/Taipei): ${referenceDate}`,"",`**All 80 regional points:** ${report.allPass?"PASS":"FAIL"}`,"","| Country | Subregions | Passed | Failed | D17-D46 combined coverage | D47-D90 combined coverage |","|---|---:|---:|---:|---:|---:|",...countries.map(x=>`| ${x.countryNameZh} | ${x.subregions} | ${x.passed} | ${x.failed} | ${(x.meanD17D46Coverage*100).toFixed(1)}% | ${(x.meanD47D90Coverage*100).toFixed(1)}% |`),"","## Per-subregion result","", "| Country | Subregion | Representative | D17-D46 | D47-D90 | Missing core fields | Result |","|---|---|---|---:|---:|---:|---|",...results.map(x=>`| ${x.countryNameZh||x.countryCode} | ${x.subregion||x.subregionId} | ${x.representativeCourseName||"—"} | ${x.d17D46?.combined??0}/30 | ${x.d47D90?.combined??0}/44 | ${(x.total?.missingHigh||0)+(x.total?.missingLow||0)+(x.total?.missingRainAmount||0)+(x.total?.missingRainFrequency||0)} | ${x.pass?"PASS":"FAIL"} |`),"","## Limitations",...report.limitations.map(x=>"- "+x)];
await fs.writeFile("artifacts/eight-country-validation/eight-country-90day-validation.md",lines.join("\n"));
console.log(lines.join("\n"));
if(!report.allPass)process.exitCode=1;
