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
const SNAPSHOT_DIR=new URL("../data/okinawa-forecast-snapshots/",import.meta.url);
const asOf=today();
const dates=Array.from({length:90},(_,i)=>addDays(asOf,i+1));
const courseIds=["southern-links","palm-hills","pgm-okinawa","kise","atta-terrace","chura-orchard"];
const representativeIds=["kise","pgm-okinawa","southern-links"];
const courses=JSON.parse(await fs.readFile(new URL("../config/global/courses.json",import.meta.url),"utf8"))
  .filter(x=>representativeIds.includes(x.id));
if(courses.length!==3)throw new Error("Expected exactly three representative Okinawa courses");

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
// Archive one forecast run per Okinawa-local calendar day. Re-runs replace that
// day's snapshot instead of creating artificial same-day stability evidence.
const snapshotRisk=(probability,amount)=>{
  const p=typeof probability==="number"&&Number.isFinite(probability)&&probability>=0&&probability<=100?probability:null;
  const a=typeof amount==="number"&&Number.isFinite(amount)&&amount>=0?Math.min(100,amount*10):null;
  if(p===null&&a===null)return null;
  const pw=p===null?0:0.65,aw=a===null?0:0.35;
  return {riskScore:( (p??0)*pw+(a??0)*aw )/(pw+aw),coverage:(Number(p!==null)+Number(a!==null))/2,probability:p,rainMm:typeof amount==="number"&&Number.isFinite(amount)?amount:null};
};
const currentSnapshot={
  fetchedAt:forecast.fetchedAt||new Date().toISOString(),
  localDate:asOf,
  provider:forecast.provider,
  seasonalProvider:longRange.provider,
  seasonalModel:longRange.model,
  // Preserve raw source values and valid-time labels so EC46 weekly and SEAS5
  // monthly forecasts can be verified only after their target periods finish.
  seasonal:Object.fromEntries(longRange.points.map(item=>[item.point.id,{
    place:item.point.place,
    weekly:{
      time:item.weekly?.time||[],
      precipitation_mean:item.weekly?.precipitation_mean||[],
      precipitation_anomaly:item.weekly?.precipitation_anomaly||[],
      precipitation_efi:item.weekly?.precipitation_efi||[]
    },
    monthly:{
      time:item.monthly?.time||[],
      precipitation_mean:item.monthly?.precipitation_mean||[],
      precipitation_anomaly:item.monthly?.precipitation_anomaly||[]
    }
  }])),
  regions:Object.fromEntries(forecast.zones.map(zone=>[zone.zone.id,
    (zone.daily?.time||[]).map((date,i)=>{
      const signal=snapshotRisk(zone.daily.precipitation_probability_max?.[i],zone.daily.precipitation_sum?.[i]);
      return signal?{date,...signal}:null;
    }).filter(Boolean)
  ]))
};
await fs.mkdir(SNAPSHOT_DIR,{recursive:true});
const snapshotFiles=(await fs.readdir(SNAPSHOT_DIR)).filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
const stabilitySnapshots=[];
for(const name of snapshotFiles){
  try{
    const item=JSON.parse(await fs.readFile(new URL(name,SNAPSHOT_DIR),"utf8"));
    if(item.localDate!==asOf)stabilitySnapshots.push(item);
  }catch(error){
    console.warn("Skipping unreadable forecast snapshot",name,error.message);
  }
}
stabilitySnapshots.push(currentSnapshot);
await fs.writeFile(new URL(asOf+".json",SNAPSHOT_DIR),JSON.stringify(currentSnapshot,null,2));
const input=buildTripDateEngineInput({
  asOf,
  forecastZones:forecast.zones,
  longRangePoints:longRange.points,
  historicalCourseResults:history,
  stabilitySnapshots
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
    forecastDirectionStability:{status:stabilitySnapshots.length>=2?"building":"collecting",snapshotCount:stabilitySnapshots.length,latestSnapshot:currentSnapshot.fetchedAt,archive:"data/okinawa-forecast-snapshots/YYYY-MM-DD.json",handling:"computed only from actual forecast runs for the same target date; one snapshot per Okinawa-local date"},
    seasonalForecastArchive:{weeklyPeriods:longRange.points.reduce((n,p)=>n+(p.weekly?.time?.length||0),0),monthlyPeriods:longRange.points.reduce((n,p)=>n+(p.monthly?.time?.length||0),0),regions:longRange.points.length,archive:"data/okinawa-forecast-snapshots/YYYY-MM-DD.json",verification:"periods are eligible only after their valid week/month has ended"}
  },
  sourceAvailability:input.sourceAvailability,
  recommendation:result,
  qualityNotes:[
    "This run is a live data integration check. It does not claim backtested forecast skill or calibrated rain probabilities.",
    "EC46 weekly EFI and SEAS5 monthly precipitation anomalies are normalized into comparative rain-risk indices, not probabilities.",
    "ERA5 historical same-calendar-day wet-day frequency and rainfall amount are climate references, not future weather.",
    "Forecast direction stability is calculated only where at least two distinct daily forecast snapshots overlap the same target date; it is an uncertainty penalty, not rainfall probability.",
    "Each Okinawa region uses exactly one representative course for historical climate context: north=Kise, central=PGM Okinawa, south=Southern Links. Other same-region courses inherit the representative regional assessment.",
    "One forecast snapshot per Okinawa-local date is retained in data/okinawa-forecast-snapshots; same-day reruns replace rather than inflate the archive.",
    "Each snapshot also preserves raw EC46 weekly and SEAS5 monthly precipitation forecasts with valid-time labels for later independent source verification.",
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
].join("\n");
const lines=[
  "# Okinawa 5D4N / 3-round trip-date recommendations",
  "",
  "Generated: "+report.generatedAt,
  "As of: "+asOf+" (Asia/Tokyo)",
  "",
  "## Live source coverage",
  "- 16-day forecast regions: "+forecast.zones.length+"/3",
  "- EC46/SEAS5 regions: "+longRange.points.length+"/3",
  "- ERA5 representative-course datasets: "+history.length+"/3",
  "- Forecast stability snapshots: "+stabilitySnapshots.length+" (distinct daily runs)",
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
await fs.writeFile(new URL("../artifacts/trip-date-recommendations/recommendations.md",import.meta.url),lines.join("\n"));
console.log(lines.join("\n"));
