/**
 * Long-range context adapter for ECMWF EC46 + SEAS5 via Open-Meteo.
 * These are weekly/monthly anomaly and ensemble diagnostics, NOT daily rain forecasts.
 */
export const OKINAWA_LONG_RANGE_POINTS = Object.freeze([
 {id:"north",label:"北部",place:"名護市",latitude:26.5916,longitude:127.9774},
 {id:"central",label:"中部",place:"沖繩市",latitude:26.3344,longitude:127.8056},
 {id:"south",label:"南部",place:"那霸市",latitude:26.2123,longitude:127.6792}
]);
const ENDPOINT="https://seasonal-api.open-meteo.com/v1/seasonal";
const WEEKLY=[
 "precipitation_mean","precipitation_anomaly","precipitation_efi",
 "precipitation_anomaly_gt0","precipitation_anomaly_gt10","precipitation_anomaly_gt20",
 "wind_speed_10m_mean","wind_speed_10m_anomaly","temperature_2m_mean","temperature_2m_anomaly"
].join(",");
const DAILY=["weather_code","temperature_2m_max","temperature_2m_min","temperature_2m_mean","wind_speed_10m_mean","cloud_cover_mean","sunshine_duration"].join(",");
const HOURLY=["precipitation","rain","showers","temperature_2m","apparent_temperature","weather_code","wind_speed_10m","wind_gusts_10m","cloud_cover","relative_humidity_2m"].join(",");
const MONTHLY=[
 "precipitation_mean","precipitation_anomaly","wind_speed_10m_mean","wind_speed_10m_anomaly",
 "temperature_2m_mean","temperature_2m_anomaly","temperature_min24h_2m_mean","temperature_max24h_2m_mean","cloud_cover_mean","cloud_cover_anomaly",
 "sunshine_duration_mean","sunshine_duration_anomaly"
].join(",");
export async function fetchOkinawaLongRange(fetchImpl=fetch){
 const points=await Promise.all(OKINAWA_LONG_RANGE_POINTS.map(async point=>{
  const params=new URLSearchParams({
   latitude:String(point.latitude),longitude:String(point.longitude),
   weekly:WEEKLY,monthly:MONTHLY,daily:DAILY,hourly:HOURLY,
   forecast_days:"90",timezone:"Asia/Tokyo",
   wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius",
   models:"ecmwf_seasonal_seamless"
  });
  const response=await fetchImpl(`${ENDPOINT}?${params}`);
  if(!response.ok)throw new Error(`${point.label} 長期展望 API HTTP ${response.status}`);
  const payload=await response.json();
  if(!payload.weekly?.time?.length && !payload.monthly?.time?.length)throw new Error(`${point.label} 未回傳週/月展望資料`);
  return {point,latitude:payload.latitude,longitude:payload.longitude,elevation:payload.elevation,timezone:payload.timezone,model:payload.model??"ECMWF seasonal seamless (EC46 + SEAS5)",fetchedAt:new Date().toISOString(),weekly:payload.weekly??null,monthly:payload.monthly??null,daily:payload.daily??null,hourly:payload.hourly??null};
 }));
 return {provider:"Open-Meteo Seasonal Forecast API",model:"ECMWF seasonal seamless (EC46 + SEAS5)",fetchedAt:new Date().toISOString(),timezone:"Asia/Tokyo",points};
}
/**
 * Convert precipitation EFI into a qualitative anomaly signal only.
 * EFI is relative to model climatology; this is not rainfall probability.
 */
export function interpretPrecipitationEfi(value){
 if(typeof value!=="number"||!Number.isFinite(value))return {label:"資料不足",tone:"unknown"};
 if(value>=0.8)return {label:"顯著偏濕訊號",tone:"wet"};
 if(value>=0.5)return {label:"偏濕訊號",tone:"wet"};
 if(value<=-0.8)return {label:"顯著偏乾訊號",tone:"dry"};
 if(value<=-0.5)return {label:"偏乾訊號",tone:"dry"};
 return {label:"接近模式氣候基準／訊號不明顯",tone:"neutral"};
}

export async function fetchCourseSeasonalForecast(course,fetchImpl=fetch){
 if(!course||!Number.isFinite(course.latitude)||!Number.isFinite(course.longitude))throw new TypeError("球場座標不足，無法讀取長期趨勢");
 const timezone=course.timezone||"Asia/Tokyo";
 const params=new URLSearchParams({latitude:String(course.latitude),longitude:String(course.longitude),weekly:WEEKLY,monthly:MONTHLY,daily:DAILY,hourly:HOURLY,forecast_days:"90",timezone,wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius",models:"ecmwf_seasonal_seamless"});
 const response=await fetchImpl(ENDPOINT+"?"+params);if(!response.ok)throw new Error("長期趨勢 API HTTP "+response.status);
 const payload=await response.json();if(!payload.weekly?.time?.length&&!payload.monthly?.time?.length)throw new Error("未回傳長期趨勢資料");
 return {course,provider:"Open-Meteo Seasonal Forecast API",model:payload.model??"ECMWF seasonal seamless",timezone:payload.timezone||timezone,fetchedAt:new Date().toISOString(),weekly:payload.weekly??null,monthly:payload.monthly??null,daily:payload.daily??null,hourly:payload.hourly??null};
}

// Share one ERA5 daily archive request between monthly and calendar-day climatology.
// The two views use the same coordinates, date range, timezone and variables; fetching
// them independently needlessly doubles traffic and can trigger upstream throttling.
const historicalArchiveCache=new WeakMap();
async function loadHistoricalDailyArchive(course,fetchImpl,now){
 if(typeof fetchImpl!=="function")throw new TypeError("fetchImpl must be a function");
 let cache=historicalArchiveCache.get(fetchImpl);
 if(!cache){cache=new Map();historicalArchiveCache.set(fetchImpl,cache)}
 const endYear=now.getUTCFullYear()-1,startYear=endYear-9,timezone=course.timezone||"Asia/Tokyo";
 const key=[course.latitude,course.longitude,startYear,endYear,timezone].join("|");
 if(!cache.has(key)){
  const request=(async()=>{
   const params=new URLSearchParams({latitude:String(course.latitude),longitude:String(course.longitude),
    start_date:startYear+"-01-01",end_date:endYear+"-12-31",
    daily:"temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone,temperature_unit:"celsius",precipitation_unit:"mm",models:"era5"});
   const response=await fetchImpl("https://archive-api.open-meteo.com/v1/archive?"+params);
   if(!response.ok)throw new Error("歷史逐日資料 API HTTP "+response.status);
   const payload=await response.json(),daily=payload.daily;
   if(!daily?.time?.length)throw new Error("歷史逐日資料 API 未回傳有效逐日樣本");
   return {daily,startYear,endYear};
  })();
  cache.set(key,request);
  request.catch(()=>{if(cache.get(key)===request)cache.delete(key)});
 }
 return cache.get(key);
}

/**
 * Ten-complete-year same-month climate baseline from ERA5 reanalysis.
 * Rain day threshold: daily precipitation >= 1.0 mm.
 * Maximum daily rainfall: maximum single-day total across the baseline years.
 */
export async function fetchCourseHistoricalMonthlyClimate(course, fetchImpl=fetch, now=new Date()){
 if(!course||!Number.isFinite(course.latitude)||!Number.isFinite(course.longitude))throw new TypeError("球場座標不足，無法讀取歷史氣候");
 const {daily,startYear,endYear}=await loadHistoricalDailyArchive(course,fetchImpl,now);
 const buckets=Array.from({length:12},()=>({years:new Set(),rainTotals:[],rainDays:[],dailyMax:0,low:[],high:[]}));
 const annual=new Map();
 for(let i=0;i<daily.time.length;i++){
  const date=daily.time[i],month=Number(date.slice(5,7))-1,year=Number(date.slice(0,4));
  const rain=daily.precipitation_sum?.[i],low=daily.temperature_2m_min?.[i],high=daily.temperature_2m_max?.[i];
  const key=year+"-"+month;
  if(!annual.has(key))annual.set(key,{month,rainTotal:0,rainDays:0,low:[],high:[],maxDaily:0,validRain:0});
  const y=annual.get(key);
  if(Number.isFinite(rain)){y.rainTotal+=rain;y.validRain++;if(rain>=1)y.rainDays++;y.maxDaily=Math.max(y.maxDaily,rain)}
  if(Number.isFinite(low))y.low.push(low);
  if(Number.isFinite(high))y.high.push(high);
 }
 for(const y of annual.values()){
  const b=buckets[y.month];b.years.add(y);if(y.validRain)b.rainTotals.push(y.rainTotal);
  b.rainDays.push(y.rainDays);if(y.validRain)b.dailyMax=Math.max(b.dailyMax,y.maxDaily);
  if(y.low.length)b.low.push(y.low.reduce((a,v)=>a+v,0)/y.low.length);
  if(y.high.length)b.high.push(y.high.reduce((a,v)=>a+v,0)/y.high.length);
 }
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 return {course,provider:"Open-Meteo Historical Weather API",model:"ERA5 reanalysis",startYear,endYear,rainDayThresholdMm:1,monthly:buckets.map((b,i)=>({
  month:i+1,years:b.years.size,rain:mean(b.rainTotals),rainDays:mean(b.rainDays),
  low:mean(b.low),high:mean(b.high),avgDailyRain:mean(b.rainTotals)/new Date(Date.UTC(2000,i+1,0)).getUTCDate(),
  maxDailyRain:b.years.size?b.dailyMax:null
 }))};
}


/**
 * Historical same-calendar-day normals for a selected seven-day window.
 * Rain frequency is the share of matching calendar dates with >=1 mm,
 * not a forecast probability.
 */
export async function fetchCourseHistoricalWeekNormals(course, dates, fetchImpl=fetch, now=new Date()){
 if(!course||!Number.isFinite(course.latitude)||!Number.isFinite(course.longitude))throw new TypeError("球場座標不足");
 const {daily,startYear,endYear}=await loadHistoricalDailyArchive(course,fetchImpl,now);
 return {course,startYear,endYear,days:dates.map(date=>{
  const md=date.slice(5),samples=[];
  for(let i=0;i<daily.time.length;i++)if(daily.time[i].slice(5)===md){
   const rain=daily.precipitation_sum?.[i],high=daily.temperature_2m_max?.[i],low=daily.temperature_2m_min?.[i];
   if(Number.isFinite(rain)||Number.isFinite(high)||Number.isFinite(low))samples.push({rain,high,low});
  }
  const vals=key=>samples.map(x=>x[key]).filter(Number.isFinite);
  const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const std=a=>{if(a.length<2)return null;const m=avg(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))};
  const quantile=(a,q)=>{if(!a.length)return null;const sorted=[...a].sort((x,y)=>x-y),p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo)};
  const rain=vals("rain"),high=vals("high"),low=vals("low");
  return {date,sampleYears:samples.length,rainSampleYears:rain.length,temperatureSampleYears:Math.min(high.length,low.length),
   rainFrequency:rain.length?rain.filter(v=>v>=1).length/rain.length*100:null,
   rainMean:avg(rain),rainMin:rain.length?Math.min(...rain):null,rainMax:rain.length?Math.max(...rain):null,
   rainP10:quantile(rain,.1),rainP50:quantile(rain,.5),rainP90:quantile(rain,.9),
   rainStd:std(rain),highMean:avg(high),lowMean:avg(low),highStd:std(high),lowStd:std(low),
   highMax:high.length?Math.max(...high):null,lowMin:low.length?Math.min(...low):null};
 })};
}
