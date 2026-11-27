import fs from "node:fs/promises";
import {fetchOkinawa16DayForecast} from "../assets/js/weather-api.js";
import {fetchOkinawaLongRange,fetchCourseHistoricalWeekNormals} from "../assets/js/long-range-api.js";
import {buildTripDateEngineInput} from "../assets/js/trip-date-source-adapters.js";
import {recommendGolfTripDates} from "../assets/js/trip-date-recommendation-engine.js";

const root=new URL("../",import.meta.url);
const today=()=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date());
const addDays=(date,n)=>{
  const d=new Date(date+"T12:00:00Z");
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const asOf=today();
const dates=Array.from({length:90},(_,i)=>addDays(asOf,i+1));
const courseIds=["southern-links","palm-hills","pgm-okinawa","kise","atta-terrace","chura-orchard"];
const representativeIds=["kise","pgm-okinawa","southern-links"];
const courses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8"))
  .filter(x=>courseIds.includes(x.id));
if(courses.length!==6)throw new Error("Expected exactly six configured Okinawa courses");

const [forecast,longRange]=await Promise.all([
  fetchOkinawa16DayForecast(),
  fetchOkinawaLongRange()
]);
const history=[];
for(const course of courses){
  const result=await fetchCourseHistoricalWeekNormals(course,dates);
  history.push(result);
  await pause(350);
}
const input=buildTripDateEngineInput({
  asOf,
  forecastZones:forecast.zones,
  longRangePoints:longRange.points,
  historicalCourseResults:history,
  stabilitySnapshots:[]
});
const result=recommendGolfTripDates(input);
const report={
  generatedAt:new Date().toISOString(),
  timezone:"Asia/Tokyo",
  scope:{
    country:"JP",destination:"Okinawa",courseIds,
    regions:["north","central","south"],
    tripLengthDays:5,nights:4,golfRounds:3,
    golfDays:"middle three consecutive days; first and fifth days are travel days"
  },
  sources:{
    shortForecast:{provider:forecast.provider,days:forecast.forecastDays,regions:forecast.zones.length},
    ec46Seas5:{provider:longRange.provider,model:longRange.model,regions:longRange.points.length},
    historical:{provider:"Open-Meteo Historical Weather API",model:"ERA5 reanalysis",representativeCourseCount:history.length,representativeCourseIds:representativeIds,period:history[0]?{startYear:history[0].startYear,endYear:history[0].endYear}:null},
    forecastDirectionStability:{status:"not-available",snapshotCount:0,handling:"not fabricated; missing evidence is penalized in score and confidence"}
  },
  sourceAvailability:input.sourceAvailability,
  recommendation:result,
  qualityNotes:[
    "This run is a live data integration check. It does not claim backtested forecast skill or calibrated rain probabilities.",
    "EC46 weekly EFI and SEAS5 monthly precipitation anomalies are normalized into comparative rain-risk indices, not probabilities.",
    "ERA5 historical same-calendar-day wet-day frequency and rainfall amount are climate references, not future weather.",
    "No forecast direction stability archive was supplied; its absence lowers evidence coverage and prevents a high-confidence label.",
    "Each Okinawa region uses exactly one representative course for historical climate context: north=Kise, central=PGM Okinawa, south=Southern Links. Other same-region courses inherit the representative regional assessment.",
    "No data is imputed. Missing source fields remain absent and reduce eligibility."
  ]
};
await fs.mkdir(new URL("../artifacts/trip-date-recommendations/",import.meta.url),{recursive:true});
await fs.writeFile(new URL("../artifacts/trip-date-recommendations/recommendations.json",import.meta.url),JSON.stringify(report,null,2));
const format=x=>x==null?"資料不足":Number(x).toFixed(1);
const renderWindow=(x,i)=>[
  "### "+(x.rank||i+1)+". "+x.startDate+" ～ "+x.endDate,
  "- 排序分數："+format(x.score)+"（越低越好）",
  "- 三個固定打球日："+x.recommendedGolfDates.map(d=>d.date+"（"+format(d.riskScore)+"）").join("、"),
  "- 三場降雨風險："+format(x.golfRiskScore)+"/100",
  "- 資料覆蓋率："+Math.round(x.dataCoverage*100)+"%；完整資料日："+x.completeDays+"/5；完整打球日："+x.completeGolfDays+"/3",
  "- 信心："+x.confidence,
  ...x.reasons.map(reason=>"- "+reason)
].join("
");
const lines=[
  "# Okinawa 5D4N / 3-round trip-date recommendations",
  "",
  "Generated: "+report.generatedAt,
  "As of: "+asOf+" (Asia/Tokyo)",
  "",
  "## Live source coverage",
  "- 16-day forecast regions: "+forecast.zones.length+"/3",
  "- EC46/SEAS5 regions: "+longRange.points.length+"/3",
  "- ERA5 historical course datasets: "+history.length+"/6",
  "- Forecast stability snapshots: 0 (not fabricated; confidence reduced)",
  "",
  "## Top 3 recommendations",
  ...(result.topThree.length?result.topThree.map(renderWindow):["No window had at least three valid daily assessments."]),
  "",
  "## Alternates",
  ...(result.alternates.length?result.alternates.map(renderWindow):["No alternates available."]),
  "",
  "## Data-quality notes",
  ...report.qualityNotes.map(x=>"- "+x)
];
await fs.writeFile(new URL("../artifacts/trip-date-recommendations/recommendations.md",import.meta.url),lines.join("
"));
console.log(lines.join("
"));
