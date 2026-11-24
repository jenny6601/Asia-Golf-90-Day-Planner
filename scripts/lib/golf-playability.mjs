const PROVIDERS=["openMeteo","visualCrossing","foreca"];
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const round=x=>finite(x)?Number(x.toFixed(2)):null;

function rows(provider,data){
 if(!data)return [];
 if(provider==="openMeteo")return data.hourly??[];
 if(provider==="visualCrossing")return (data.days??[]).flatMap(d=>d.hours??[]);
 return data.hourly?.forecast??[];
}
function key(value){
 if(typeof value!=="string"||value.length<13)return null;
 const p=value.slice(0,13);
 return /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(p)?p:null;
}
function localDate(k){return k.slice(0,10);}
function localHour(k){return Number(k.slice(11,13));}
function stats(values){
 const v=values.filter(finite);
 return {sampleCount:v.length,min:v.length?round(Math.min(...v)):null,max:v.length?round(Math.max(...v)):null,mean:v.length?round(v.reduce((a,b)=>a+b,0)/v.length):null};
}
function collectWindow(providerMap,date,startHour,endHour){
 const keys=Array.from({length:endHour-startHour+1},(_,i)=>date+"T"+String(startHour+i).padStart(2,"0"));
 return keys.map(k=>providerMap.get(k)??null);
}
function evaluateWindow(providerRows,date,startHour,endHour){
 const map=new Map(providerRows.map(r=>[key(r.time),r]).filter(([k])=>k));
 const expected=endHour-startHour+1;
 const selected=collectWindow(map,date,startHour,endHour);
 const present=selected.filter(Boolean);
 const values=field=>present.map(r=>r[field]);
 const rain=values("precipitationMm");
 const rainProbability=values("precipitationProbabilityPct");
 const wind=values("windSpeedMs");
 const gust=values("windGustMs");
 const humidex=present.map(r=>{
  const t=r.temperatureC,rh=r.relativeHumidityPct;
  if(!finite(t)||!finite(rh)||rh<=0||rh>100)return null;
  const a=17.625,b=243.04,g=Math.log(rh/100)+(a*t)/(b+t);
  const dp=b*g/(a-g);
  const vap=6.11*Math.exp(5417.753*(1/273.16-1/(dp+273.15)));
  return Number((t+(5/9)*(vap-10)).toFixed(2));
 });
 const rainHours=present.filter(r=>finite(r.precipitationMm)&&r.precipitationMm>0).length;
 return {
  date,startLocalTime:String(startHour).padStart(2,"0")+":00",
  endLocalTime:String(endHour).padStart(2,"0")+":00",
  elapsedHours:endHour-startHour,
  expectedHourlyPoints:expected,availableHourlyPoints:present.length,
  complete:present.length===expected,
  temperatureC:stats(values("temperatureC")),
  humidexC:stats(humidex),
  precipitationProbabilityPct:stats(rainProbability),
  precipitationMm:stats(rain),
  totalReportedPrecipitationMm:rain.length?round(rain.reduce((a,b)=>a+b,0)):null,
  hoursWithReportedRain:rainHours,
  windSpeedMs:stats(wind),windGustMs:stats(gust),
  maxWindGustMs:gust.length?round(Math.max(...gust)):null,
  openMeteoSolarRadiationWm2:stats(values("shortwaveRadiationWm2")),
  openMeteoUvIndex:stats(values("uvIndex")),
  hourly:keys.map((k,i)=>({time:k+":00",available:!!selected[i],temperatureC:selected[i]?.temperatureC??null,humidexC:humidex[i]??null,precipitationProbabilityPct:selected[i]?.precipitationProbabilityPct??null,precipitationMm:selected[i]?.precipitationMm??null,windSpeedMs:selected[i]?.windSpeedMs??null,windGustMs:selected[i]?.windGustMs??null,solarRadiationWm2:selected[i]?.shortwaveRadiationWm2??null,uvIndex:selected[i]?.uvIndex??null}))
 };
}

export function buildGolfPlayabilityReport(courses,{teeTime="10:00",durationHours=6}={}){
 const startHour=Number(teeTime.slice(0,2));
 const endHour=startHour+durationHours;
 const courseReports=courses.map(course=>{
  const maps={};
  for(const p of PROVIDERS)maps[p]=new Map(rows(p,course.providers?.[p]?.data).map(r=>[key(r.time),r]).filter(([k])=>k));
  const commonKeys=[...maps.openMeteo.keys()].filter(k=>maps.visualCrossing.has(k)&&maps.foreca.has(k)).sort();
  const dates=[...new Set(commonKeys.map(localDate))].filter(date=>{
   for(let h=startHour;h<=endHour;h++){
    const k=date+"T"+String(h).padStart(2,"0");
    if(!PROVIDERS.every(p=>maps[p].has(k)))return false;
   }
   return true;
  });
  const daily=dates.map(date=>{
   const byProvider={};
   for(const p of PROVIDERS)byProvider[p]=evaluateWindow(rows(p,course.providers?.[p]?.data),date,startHour,endHour);
   return {date,providers:byProvider};
  });
  return {
   courseId:course.id,courseName:course.name,coordinateStatus:course.coordinateStatus,
   operationalRankingEligible:course.coordinateStatus==="verified",
   rankingStatus:course.coordinateStatus==="verified"?"descriptive-only-no-calibrated-score":"blocked-unverified-course-coordinate",
   commonCompleteDays:dates.length,daily
  };
 });
 return {
  timezone:"Asia/Tokyo",teeTime,durationHours,window:{startLocalTime:teeTime,endLocalTime:String(endHour).padStart(2,"0")+":00",elapsedHours:durationHours,requiredHourlyEndpoints:durationHours+1},
  commonPeriodPolicy:"Only dates with all required hourly endpoints present from all three providers are included. The endpoint at 16:00 closes the six-hour 10:00–16:00 window; hourly samples include both endpoints.",
  metricsPolicy:"Keep rain probability, reported hourly precipitation, wind, gust, Humidex, solar radiation and UV separate. Do not combine into a weighted score before thresholds and observed outcomes are validated.",
  rankingPolicy:"No overall course ranking is generated. Provisional GPS courses are excluded from operational ranking; even verified points receive descriptive metrics only until score weights are validated.",
  courses:courseReports
 };
}
