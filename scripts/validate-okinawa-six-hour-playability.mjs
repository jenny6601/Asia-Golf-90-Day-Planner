import fs from "node:fs/promises";
import {fetchCourseForecast} from "../assets/js/weather-api.js";
import {evaluateSixHourPlayability} from "../assets/js/six-hour-playability.js";

const root=new URL("../",import.meta.url);
const courses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8")).filter(x=>x.countryCode==="JP"&&x.region==="Okinawa"&&x.enabled);
const fields=["precipitation_probability","precipitation","temperature_2m","apparent_temperature","wind_speed_10m","wind_gusts_10m","weather_code"];
const teeHours=Array.from({length:8},(_,i)=>i+6);
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const fetchWithTimeout=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(45000)});
const nowParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
const part=k=>nowParts.find(x=>x.type===k)?.value;
const nowLocal=part("year")+"-"+part("month")+"-"+part("day")+"T"+part("hour")+":"+part("minute");
const coursesOut=[];
for(let i=0;i<courses.length;i+=3){
 const result=await fetchCourseForecast(courses.slice(i,i+3),fetchWithTimeout);
 for(const item of result.courses){
  const h=item.hourly,d=item.daily,coverage=Object.fromEntries(fields.map(k=>{const a=h[k]||[],n=a.filter(finite).length;return [k,{valid:n,expected:h.time.length,coverage:h.time.length?n/h.time.length:0}]}));
  const windows=[];let skippedPast=0;
  for(const date of d.time||[])for(const teeHour of teeHours){
   const start=date+"T"+String(teeHour).padStart(2,"0")+":00";if(start<=nowLocal){skippedPast++;continue;}
   const score=evaluateSixHourPlayability(h,date,teeHour,6);windows.push({date,teeHour,start,status:score.status,reason:score.reason||null,missingFields:score.missingFields||[],score:score.status==="scored"?score.playability.score:null,grade:score.status==="scored"?score.playability.grade:null,label:score.status==="scored"?score.playability.label:null,rainRisk:score.status==="scored"?score.rain.rainRisk:null,rainLabel:score.status==="scored"?score.rain.label:null,environmentSeverity:score.status==="scored"?score.environment.severity:null,environmentGrade:score.status==="scored"?score.environment.grade:null,inputs:score.status==="scored"?score.inputs:null,safety:score.status==="scored"?score.playability.safety:null});
  }
  const scored=windows.filter(x=>x.status==="scored"),gradeCounts=Object.fromEntries(["A","B","C","D","E"].map(g=>[g,scored.filter(x=>x.grade===g).length]));
  const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const scores=scored.map(x=>x.score),rain=scored.map(x=>x.rainRisk);
  const missingFields=windows.reduce((acc,x)=>{for(const f of x.missingFields||[])acc[f]=(acc[f]||0)+1;return acc;},{});
  const courseResult={courseId:item.course.id,name:item.course.name,requestedCoordinate:{latitude:item.course.latitude,longitude:item.course.longitude},forecastGrid:{latitude:item.latitude,longitude:item.longitude},gridAudit:item.coordinateAudit,timezone:item.timezone,dailyCount:d.time?.length||0,hourlyCount:h.time?.length||0,fieldCoverage:coverage,teeHours,nowLocal,expectedFutureWindows:windows.length,skippedPastWindows:skippedPast,scoredWindows:scored.length,incompleteWindows:windows.length-scored.length,gradeCounts,averageScore:mean(scores)===null?null:Number(mean(scores).toFixed(1)),scoreMin:scores.length?Math.min(...scores):null,scoreMax:scores.length?Math.max(...scores):null,averageRainRisk:mean(rain)===null?null:Number(mean(rain).toFixed(1)),safetyOverrideCount:scored.filter(x=>x.safety).length,thunderstormWindows:scored.filter(x=>x.inputs.thunderstormSignal).length,missingFields,pass:d.time?.length===16&&h.time?.length===384&&Object.values(coverage).every(x=>x.coverage===1)&&windows.length>0&&windows.every(x=>x.status==="scored")};
  courseResult.windows=windows;coursesOut.push(courseResult);
 }
}
const report={generatedAt:new Date().toISOString(),nowAsiaTokyo:nowLocal,scope:"Six Okinawa course GPS points",forecastDays:16,teeHours,windowDefinition:"Six hourly values from tee-off hour through tee-off +5h, inclusive; past tee-off windows on the current day are excluded.",requiredFields:fields,results:coursesOut,totalWindows:coursesOut.reduce((s,x)=>s+x.expectedFutureWindows,0),totalScored:coursesOut.reduce((s,x)=>s+x.scoredWindows,0),totalIncomplete:coursesOut.reduce((s,x)=>s+x.incompleteWindows,0),allSixPass:coursesOut.length===6&&coursesOut.every(x=>x.pass),limitations:["All seven required variables must be numeric for all six hours; no missing-hour interpolation or partial-field grade is permitted.","The A-E grade and rain-risk rubric are transparent prototype thresholds, not calibrated cancellation probabilities or a safety certification.","Apparent temperature is a model-derived field, not a direct JMA observation.","JMA AMeDAS gust is not an hourly ground-truth counterpart to the forecast six-hour peak gust; gust verification requires separate daily-extreme analysis.","Grid-point weather is not course-surface measurement; returned grid offsets are included for each course.","This validates data availability and scoring execution, not forecast accuracy or actual golfer outcomes."]};
await fs.mkdir("artifacts/okinawa-acceptance",{recursive:true});
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-six-hour-playability-validation.json",JSON.stringify(report,null,2));
const md=["# Okinawa Six-Hour Playability Validation","",`Generated: ${report.generatedAt}`,`Asia/Tokyo now: ${nowLocal}`,"",`**All six course scoring-data gate:** ${report.allSixPass?"PASS":"FAIL"}`,`Future windows: ${report.totalScored}/${report.totalWindows} scored; incomplete ${report.totalIncomplete}`,"","| Course | Grid offset | Daily | Hourly | Future 6h windows | Scored | Incomplete | A | B | C | D | E | Avg score | Result |","|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",...coursesOut.map(x=>`| ${x.name} | ${x.gridAudit?.gridOffsetKm??"—"} km | ${x.dailyCount} | ${x.hourlyCount} | ${x.expectedFutureWindows} | ${x.scoredWindows} | ${x.incompleteWindows} | ${x.gradeCounts.A} | ${x.gradeCounts.B} | ${x.gradeCounts.C} | ${x.gradeCounts.D} | ${x.gradeCounts.E} | ${x.averageScore??"—"} | ${x.pass?"PASS":"FAIL"} |`),"","## Required field coverage","","| Course | "+fields.join(" | ")+" |","|---|"+fields.map(()=>"---:").join("|")+"|",...coursesOut.map(x=>`| ${x.name} | ${fields.map(k=>Math.round((x.fieldCoverage[k]?.coverage||0)*100)+"%").join(" | ")} |`),"","## Limitations",...report.limitations.map(x=>"- "+x)];
await fs.writeFile("artifacts/okinawa-acceptance/okinawa-six-hour-playability-validation.md",md.join("\n"));
console.log(md.join("\n"));
if(!report.allSixPass)process.exitCode=1;