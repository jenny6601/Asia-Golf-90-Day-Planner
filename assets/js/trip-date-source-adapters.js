/**
 * Adapters from the existing Okinawa data layer into the trip-date engine contract.
 * No fetches are performed here. Missing/invalid fields remain missing.
 *
 * historicalByRegion shape:
 * { north:[{date,courseNormals:[{rainFrequency,rainMean,rainSampleYears}]}], ... }
 * stabilitySnapshots shape:
 * [{fetchedAt,regions:{north:[{date,riskScore}],central:[...],south:[...]}}]
 */
const REGIONS = ["north","central","south"];
const REPRESENTATIVE_COURSE_BY_REGION = Object.freeze({
  north:"kise",
  central:"pgm-okinawa",
  south:"southern-links"
});
const finite = value => typeof value === "number" && Number.isFinite(value);
const clamp = (value,min=0,max=100) => Math.max(min,Math.min(max,value));
const addDays = (date,n) => new Date(Date.parse(date+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
const dateDiff = (a,b) => Math.round((Date.parse(a+"T00:00:00Z")-Date.parse(b+"T00:00:00Z"))/86400000);

function amountRisk(mm) {
  if (!finite(mm) || mm < 0) return null;
  return clamp(mm / 10 * 100);
}
function forecastSignal(zone,date) {
  const daily=zone?.daily||{}, index=(daily.time||[]).indexOf(date);
  if(index<0)return null;
  const probability=daily.precipitation_probability_max?.[index];
  const amount=daily.precipitation_sum?.[index];
  const p=finite(probability)&&probability>=0&&probability<=100?probability:null;
  const a=amountRisk(amount);
  if(p===null&&a===null)return null;
  const pWeight=p===null?0:0.65, aWeight=a===null?0:0.35;
  const score=((p??0)*pWeight+(a??0)*aWeight)/(pWeight+aWeight);
  const coverage=(Number(p!==null)+Number(a!==null))/2;
  return {riskScore:score,coverage,probability:p,rainMm:finite(amount)?amount:null,method:"daily-probability-and-amount-impact-index"};
}
function weeklyForDate(weekly,date) {
  const times=weekly?.time||[];
  let index=-1;
  for(let i=0;i<times.length;i++){
    const key=String(times[i]).slice(0,10);
    if(key<=date)index=i;else break;
  }
  if(index<0)return null;
  const signalDate=String(times[index]).slice(0,10);
  const age=dateDiff(date,signalDate);
  if(age<0||age>=7)return null;
  const get=key=>finite(weekly?.[key]?.[index])?weekly[key][index]:null;
  return {signalDate,efi:get("precipitation_efi"),mean:get("precipitation_mean"),anomaly:get("precipitation_anomaly")};
}
function ec46Signal(point,date) {
  const weekly=weeklyForDate(point?.weekly,date);
  if(!weekly)return null;
  const present=[weekly.efi,weekly.mean,weekly.anomaly].filter(finite).length;
  let risk=null,method=null;
  if(finite(weekly.efi)){
    risk=clamp(50+clamp(weekly.efi,-1,1)*50);
    method="weekly-precipitation-efi-relative-risk-index";
  }else if(finite(weekly.mean)&&finite(weekly.anomaly)){
    const baseline=weekly.mean-weekly.anomaly;
    if(baseline>0){
      const ratio=clamp(weekly.mean/baseline,0,2);
      risk=clamp(50+(ratio-1)*50);
      method="weekly-precipitation-anomaly-ratio-index";
    }
  }
  if(risk===null)return null;
  return {riskScore:risk,coverage:present/3,signalDate:weekly.signalDate,efi:weekly.efi,precipitationMean:weekly.mean,precipitationAnomaly:weekly.anomaly,method};
}
function seas5Signal(point,date) {
  const monthly=point?.monthly||{}, index=(monthly.time||[]).findIndex(x=>String(x).slice(0,7)===date.slice(0,7));
  if(index<0)return null;
  const mean=monthly.precipitation_mean?.[index], anomaly=monthly.precipitation_anomaly?.[index];
  if(!finite(mean)||!finite(anomaly))return null;
  const baseline=mean-anomaly;
  if(!(baseline>0))return null;
  const ratio=clamp(mean/baseline,0,2);
  return {
    riskScore:clamp(50+(ratio-1)*50),
    coverage:1,
    precipitationMean:mean,precipitationAnomaly:anomaly,baseline,ratio,
    method:"monthly-seas5-precipitation-anomaly-ratio-index"
  };
}
function historicalSignal(regionRows,date,region) {
  const row=(regionRows||[]).find(x=>x.date===date);
  const samples=Array.isArray(row?.courseNormals)?row.courseNormals:[];
  const valid=samples.filter(x=>finite(x.rainFrequency)&&finite(x.rainMean)&&x.rainMean>=0);
  if(!valid.length)return null;
  const average=key=>valid.reduce((sum,x)=>sum+x[key],0)/valid.length;
  const frequency=average("rainFrequency");
  const amount=average("rainMean");
  const risk=clamp(frequency*0.6+clamp(amount/5*100)*0.4);
  const sampleCoverage=valid.reduce((sum,x)=>sum+(finite(x.rainSampleYears)?clamp(x.rainSampleYears/10,0,1):0),0)/valid.length;
  const regionCoverage=sampleCoverage;
  return {
    riskScore:risk,coverage:clamp(regionCoverage,0,1),
    rainFrequency:frequency,rainMean:amount,validCourseCount:valid.length,
    representativeCourseId:valid[0].courseId??null,
    sampleYears:Math.min(...valid.map(x=>finite(x.rainSampleYears)?x.rainSampleYears:0)),
    method:"era5-same-calendar-day-wet-day-frequency-and-rain-amount-index"
  };
}

const COURSE_REGION = Object.freeze({
  "southern-links":"south","palm-hills":"south",
  "pgm-okinawa":"central",
  "kise":"north","atta-terrace":"north","chura-orchard":"north"
});

/** Use exactly one representative course per region; other same-region courses inherit its regional assessment. */
export function groupCourseHistoricalNormals(courseResults=[]) {
  if(!Array.isArray(courseResults))throw new TypeError("courseResults must be an array");
  const grouped={north:new Map(),central:new Map(),south:new Map()};
  for(const result of courseResults){
    const region=COURSE_REGION[result?.course?.id];
    if(!region || REPRESENTATIVE_COURSE_BY_REGION[region]!==result?.course?.id)continue;
    for(const day of result.days||[]){
      if(!day?.date)continue;
      if(!grouped[region].has(day.date))grouped[region].set(day.date,[]);
      grouped[region].get(day.date).push({
        courseId:result.course.id,
        rainFrequency:finite(day.rainFrequency)?day.rainFrequency:null,
        rainMean:finite(day.rainMean)?day.rainMean:null,
        rainSampleYears:finite(day.rainSampleYears)?day.rainSampleYears:0
      });
    }
  }
  return Object.fromEntries(REGIONS.map(region=>[
    region,[...grouped[region].entries()].map(([date,courseNormals])=>({date,courseNormals}))
  ]));
}

function stabilitySignal(snapshots,region,date) {
  const points=(snapshots||[]).map(snapshot=>{
    const rows=snapshot?.regions?.[region]||[];
    const row=rows.find(x=>x.date===date);
    return row&&finite(row.riskScore)&&row.riskScore>=0&&row.riskScore<=100
      ? {fetchedAt:snapshot.fetchedAt??null,riskScore:row.riskScore}:null;
  }).filter(Boolean).sort((a,b)=>String(a.fetchedAt).localeCompare(String(b.fetchedAt)));
  if(points.length<2)return null;
  const values=points.map(x=>x.riskScore);
  const spread=Math.max(...values)-Math.min(...values);
  const first=values[0],last=values[values.length-1];
  const direction=last-first>=10?"wetter":first-last>=10?"drier":"no-material-direction-change";
  return {
    riskScore:clamp(spread),coverage:Math.min(1,points.length/3),
    runCount:points.length,direction,firstRiskScore:first,lastRiskScore:last,
    method:"cross-run-rain-risk-spread"
  };
}

/**
 * Creates the normalized 90-day payload consumed by recommendGolfTripDates().
 * Regional data uses the established north/central/south weather zones.
 */
export function buildTripDateEngineInput({
  asOf,forecastZones=[],longRangePoints=[],historicalByRegion={},historicalCourseResults=[],stabilitySnapshots=[]
}={}) {
  if(typeof asOf!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)
    ||new Date(asOf+"T00:00:00Z").toISOString().slice(0,10)!==asOf)
    throw new TypeError("asOf must be a valid YYYY-MM-DD date");
  const regionalHistory=Object.keys(historicalByRegion).length?historicalByRegion:groupCourseHistoricalNormals(historicalCourseResults);
  const forecastByRegion=new Map(forecastZones.map(x=>[x.zone?.id||x.id,x]));
  const longRangeByRegion=new Map(longRangePoints.map(x=>[x.point?.id||x.id,x]));
  const days=Array.from({length:90},(_,i)=>{
    const date=addDays(asOf,i+1),lead=i+1,regions={};
    for(const region of REGIONS){
      const forecast=lead<=16?forecastSignal(forecastByRegion.get(region),date):null;
      const ec46=lead>=17&&lead<=46?ec46Signal(longRangeByRegion.get(region),date):null;
      const seas5=lead>=17?seas5Signal(longRangeByRegion.get(region),date):null;
      const historical=historicalSignal(regionalHistory[region],date,region);
      const stability=stabilitySignal(stabilitySnapshots,region,date);
      regions[region]={};
      if(forecast)regions[region].forecast=forecast;
      if(ec46)regions[region].ec46=ec46;
      if(seas5)regions[region].seas5=seas5;
      if(historical)regions[region].historical=historical;
      if(stability)regions[region].stability=stability;
    }
    return {date,regions};
  });
  return {
    asOf,horizonDays:90,days,
    sourceAvailability:{
      forecastZones:REGIONS.filter(x=>forecastByRegion.has(x)).length,
      longRangeRegions:REGIONS.filter(x=>longRangeByRegion.has(x)).length,
      historicalRegions:REGIONS.filter(x=>(regionalHistory[x]||[]).length>0).length,
      stabilityRuns:stabilitySnapshots.length
    }
  };
}

export const TRIP_DATE_SOURCE_ADAPTERS = Object.freeze({
  regions:REGIONS,representativeCourseByRegion:REPRESENTATIVE_COURSE_BY_REGION,
  sourceHorizon:{forecast:[1,16],ec46:[17,46],seas5:[47,90],historical:[1,90],stability:[1,90]}
});
