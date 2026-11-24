const DAY=86400000;
const addDays=(date,n)=>new Date(Date.parse(date+"T00:00:00Z")+n*DAY).toISOString().slice(0,10);
const finite=x=>typeof x==="number"&&Number.isFinite(x);
function weeklySignal(point,date){
 const s=point.weekly;if(!s?.time?.length)return null;
 let i=-1;for(let n=0;n<s.time.length;n++)if(s.time[n]<=date)i=n;
 if(i<0||date>=addDays(s.time[i],7))return null;
 const efi=s.precipitation_efi?.[i];if(!finite(efi))return null;
 return {periodStart:s.time[i],efi,label:efi>=.8?"顯著偏濕":efi>=.5?"偏濕":efi<=-.8?"顯著偏乾":efi<=-.5?"偏乾":"接近基準"};
}
function monthlySignal(point,date){
 const s=point.monthly;if(!s?.time?.length)return null;
 const i=s.time.findIndex(x=>x.slice(0,7)===date.slice(0,7));if(i<0)return null;
 const mean=s.precipitation_mean?.[i],anomaly=s.precipitation_anomaly?.[i];
 if(!finite(mean)||!finite(anomaly)||mean<=0)return null;
 const ratio=anomaly/mean;
 return {period:s.time[i],meanMm:mean,anomalyMm:anomaly,anomalyRatio:ratio,label:ratio>=.2?"偏濕":ratio<=-.2?"偏乾":"接近基準"};
}
function dailyWeather(courses,date){
 const found=courses.map(c=>{
  const i=c.daily?.time?.indexOf(date)??-1;if(i<0)return null;const d=c.daily;
  return {courseName:c.course.name,precipitationProbabilityMax:d.precipitation_probability_max?.[i]??null,precipitationSumMm:d.precipitation_sum?.[i]??null,temperatureMinC:d.temperature_2m_min?.[i]??null,temperatureMaxC:d.temperature_2m_max?.[i]??null,windSpeedMaxMs:d.wind_speed_10m_max?.[i]??null,windGustMaxMs:d.wind_gusts_10m_max?.[i]??null};
 }).filter(Boolean);
 const max=k=>{const a=found.map(x=>x[k]).filter(finite);return a.length?Math.max(...a):null;};
 const min=k=>{const a=found.map(x=>x[k]).filter(finite);return a.length?Math.min(...a):null;};
 return {courseCount:found.length,courseCountExpected:courses.length,precipitationProbabilityMax:max("precipitationProbabilityMax"),precipitationSumMaxMm:max("precipitationSumMm"),temperatureMinC:min("temperatureMinC"),temperatureMaxC:max("temperatureMaxC"),windSpeedMaxMs:max("windSpeedMaxMs"),windGustMaxMs:max("windGustMaxMs"),byCourse:found};
}
/** 1-16d daily deterministic; 17-46d daily rows with weekly EFI; 47-90d seven-day blocks using monthly seasonal outlook only. */
export function build90DayDailyView({referenceDate,courses,points}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)||!Array.isArray(courses)||courses.length!==3||!Array.isArray(points)||points.length!==3)throw new TypeError("referenceDate, three course forecasts and three regional outlook points are required");
 const rows=[];
 for(let day=1;day<=46;day++){
  const date=addDays(referenceDate,day-1);
  if(day<=16){const weather=dailyWeather(courses,date);rows.push({date,leadDays:day,horizon:"forecast",label:"逐日預報",weather,status:weather.courseCount===3?"available":"incomplete"});}
  else{const signals=points.map(p=>({region:p.point?.label??p.point?.id??"區域",signal:weeklySignal(p,date)}));rows.push({date,leadDays:day,horizon:"weekly-trend",label:"週趨勢（此列為該週起始日）",signals,status:signals.every(x=>x.signal)?"available":"incomplete"});}
 }
 for(let start=47;start<=90;start+=7){
  const end=Math.min(start+6,90),startDate=addDays(referenceDate,start-1),endDate=addDays(referenceDate,end-1);
  const signals=points.map(p=>({region:p.point?.label??p.point?.id??"區域",signal:monthlySignal(p,startDate)}));
  rows.push({date:startDate,endDate,leadDays:start,leadEndDays:end,horizon:"weekly-seasonal",label:"逐週展望（SEAS5月尺度資料）",signals,status:signals.every(x=>x.signal)?"available":"incomplete"});
 }
 return rows;
}
