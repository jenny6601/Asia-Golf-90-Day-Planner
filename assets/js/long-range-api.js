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
  return {point,latitude:payload.latitude,longitude:payload.longitude,elevation:payload.elevation,timezone:payload.timezone,model:payload.model??"ECMWF seasonal seamless (EC46 + SEAS5)",fetchedAt:new Date().toISOString(),weeklyUnits:payload.weekly_units??null,monthlyUnits:payload.monthly_units??null,weekly:payload.weekly??null,monthly:payload.monthly??null,daily:payload.daily??null,hourly:payload.hourly??null};
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
 const params=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),weekly:WEEKLY,monthly:MONTHLY,daily:DAILY,hourly:HOURLY,forecast_days:"90",timezone,wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius",models:"ecmwf_seasonal_seamless"});
 const response=await fetchImpl(ENDPOINT+"?"+params);if(!response.ok)throw new Error("長期趨勢 API HTTP "+response.status);
 const payload=await response.json();if(!payload.weekly?.time?.length&&!payload.monthly?.time?.length)throw new Error("未回傳長期趨勢資料");
 return {course,provider:"Open-Meteo Seasonal Forecast API",model:payload.model??"ECMWF seasonal seamless",timezone:payload.timezone||timezone,fetchedAt:new Date().toISOString(),weekly:payload.weekly??null,monthly:payload.monthly??null,daily:payload.daily??null,hourly:payload.hourly??null};
}

// Resolve every course to its subregion's single approved representative point.
function historicalLocation(course){
 const point=course?.regionalClimate?.representativePoint;
 const latitude=Number.isFinite(point?.latitude)?point.latitude:course?.latitude;
 const longitude=Number.isFinite(point?.longitude)?point.longitude:course?.longitude;
 const timezone=course?.regionalClimate?.timezone||course?.timezone||"Asia/Tokyo";
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))throw new TypeError("球場或分區代表座標不足");
 return {latitude,longitude,timezone};
}
// Share one ERA5 daily archive request between all courses in the same subregion.
const historicalArchiveCache=new WeakMap();
async function loadHistoricalDailyArchive(course,fetchImpl,now){
 if(typeof fetchImpl!=="function")throw new TypeError("fetchImpl must be a function");
 let cache=historicalArchiveCache.get(fetchImpl);
 if(!cache){cache=new Map();historicalArchiveCache.set(fetchImpl,cache)}
 const startYear=1991,endYear=2020,location=historicalLocation(course),{latitude,longitude,timezone}=location;
 const key=[latitude,longitude,startYear,endYear,timezone].join("|");
 if(!cache.has(key)){
  const request=(async()=>{
   const params=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),
    start_date:startYear+"-01-01",end_date:endYear+"-12-31",
    daily:"temperature_2m_max,temperature_2m_min,dew_point_2m_mean,relative_humidity_2m_mean,wind_speed_10m_mean,wind_speed_10m_max,precipitation_sum,precipitation_hours,weather_code",
    timezone,temperature_unit:"celsius",wind_speed_unit:"ms",precipitation_unit:"mm",models:"era5"});
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
 * Thirty-year monthly climate baseline from ERA5 reanalysis.
 * Rain day threshold: daily precipitation >= 1.0 mm.
 * Maximum daily rainfall: maximum single-day total across the baseline years.
 */
export async function fetchCourseHistoricalMonthlyClimate(course, fetchImpl=fetch, now=new Date()){
 if(!course)throw new TypeError("球場資料不足，無法讀取歷史氣候");
 historicalLocation(course);
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
function historicalApparentTemperatureC(airC,dewpointC,windMs){
 if(!Number.isFinite(airC)||!Number.isFinite(dewpointC)||!Number.isFinite(windMs)||windMs<0)return null;
 const saturation= t => 6.112*Math.exp((17.67*t)/(t+243.5));
 const vapor=Math.min(saturation(airC),saturation(dewpointC));
 const windKmh=windMs*3.6;
 if(airC<=10&&windKmh>=4.8){
  return 13.12+0.6215*airC-11.37*Math.pow(windKmh,0.16)+0.3965*airC*Math.pow(windKmh,0.16);
 }
 return airC+0.33*vapor-0.70*windMs-4.00;
}
const historicalQuantile=(values,q)=>{
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!sorted.length)return null;
 const p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo);
};
const historicalMean=values=>{
 const valid=values.filter(Number.isFinite);
 return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;
};
const historicalStd=values=>{
 const valid=values.filter(Number.isFinite);
 if(valid.length<2)return null;
 const avg=historicalMean(valid);
 return Math.sqrt(valid.reduce((sum,value)=>sum+(value-avg)**2,0)/(valid.length-1));
};
const historicalDayNumber=date=>{
 const month=Number(date.slice(5,7)),day=Number(date.slice(8,10));
 if(month===2&&day===29)return 59.5;
 return Math.floor((Date.UTC(2001,month-1,day)-Date.UTC(2001,0,1))/86400000)+1;
};
const historicalCircularDistance=(a,b)=>{
 const delta=Math.abs(a-b);
 return Math.min(delta,365-delta);
};

/**
 * Historical 31-day rolling climate normals around each target calendar date.
 * Uses ERA5 daily aggregates for 1991-2020 only; no seasonal model adjustment.
 */
export async function fetchCourseHistoricalWeekNormals(course,dates,fetchImpl=fetch,now=new Date()){
 if(!course)throw new TypeError("球場資料不足");
 historicalLocation(course);
 const {daily,startYear,endYear}=await loadHistoricalDailyArchive(course,fetchImpl,now);
 return {course,startYear,endYear,referencePeriod:"1991-2020",windowDays:31,source:"ERA5",days:dates.map(date=>{
  const targetDay=historicalDayNumber(date),byYear=new Map();
  for(let i=0;i<daily.time.length;i++){
   const sourceDate=daily.time[i];
   if(historicalCircularDistance(historicalDayNumber(sourceDate),targetDay)>15)continue;
   const actualYear=Number(sourceDate.slice(0,4)),sourceDay=historicalDayNumber(sourceDate);
   const year=targetDay<=15&&sourceDay>=350?actualYear+1:targetDay>=350&&sourceDay<=15?actualYear-1:actualYear;
   if(!byYear.has(year))byYear.set(year,[]);
   const dew=daily.dew_point_2m_mean?.[i],wind=daily.wind_speed_10m_mean?.[i];
   const low=daily.temperature_2m_min?.[i],high=daily.temperature_2m_max?.[i];
   byYear.get(year).push({
    rain:daily.precipitation_sum?.[i],low,high,
    humidity:daily.relative_humidity_2m_mean?.[i],wind,
    feelLow:historicalApparentTemperatureC(low,dew,wind),
    feelHigh:historicalApparentTemperatureC(high,dew,wind)
   });
  }
  const years=[...byYear.entries()];
  const validFor=key=>{
   const selected=[];
   for(const [year,rows] of years){
    const leap=year%4===0&&(year%100!==0||year%400===0);
    const includesLeapDay=leap&&targetDay>=44.5&&targetDay<=74.5;
    const expectedDays=31+(includesLeapDay?1:0);
    const valid=rows.filter(row=>Number.isFinite(row[key]));
    if(valid.length>=Math.ceil(expectedDays*0.9))selected.push({year,values:valid.map(row=>row[key])});
   }
   return selected;
  };
  const flatten=groups=>groups.flatMap(group=>group.values);
  const rainGroups=validFor("rain"),lowGroups=validFor("low"),highGroups=validFor("high");
  const feelLowGroups=validFor("feelLow"),feelHighGroups=validFor("feelHigh");
  const humidityGroups=validFor("humidity"),windGroups=validFor("wind");
  const rain=flatten(rainGroups),low=flatten(lowGroups),high=flatten(highGroups);
  const feelLow=flatten(feelLowGroups),feelHigh=flatten(feelHighGroups);
  const humidity=flatten(humidityGroups),wind=flatten(windGroups);
  const wetDays=rain.filter(value=>value>=1);
  return {
   date,sampleYears:Math.min(rainGroups.length,lowGroups.length,highGroups.length),
   rainSampleYears:rainGroups.length,temperatureSampleYears:Math.min(lowGroups.length,highGroups.length),
   feelsLikeSampleYears:Math.min(feelLowGroups.length,feelHighGroups.length),
   sampleDays:{rain:rain.length,temperature:Math.min(low.length,high.length),feelsLike:Math.min(feelLow.length,feelHigh.length)},
   rainFrequency:rain.length?wetDays.length/rain.length*100:null,
   rainMean:historicalMean(rain),rainMin:rain.length?Math.min(...rain):null,rainMax:rain.length?Math.max(...rain):null,
   rainP10:historicalQuantile(rain,.1),rainP50:historicalQuantile(rain,.5),rainP90:historicalQuantile(rain,.9),
   rainStd:historicalStd(rain),highMean:historicalMean(high),lowMean:historicalMean(low),
   highStd:historicalStd(high),lowStd:historicalStd(low),
   highMax:high.length?Math.max(...high):null,lowMin:low.length?Math.min(...low):null,
   humidityMean:historicalMean(humidity),windMean:historicalMean(wind),
   windMax:wind.length?Math.max(...wind):null,
   feelsLikeMinMeanC:historicalMean(feelLow),feelsLikeMaxMeanC:historicalMean(feelHigh),
   feelsLikeMinP10C:historicalQuantile(feelLow,.1),feelsLikeMinP90C:historicalQuantile(feelLow,.9),
   feelsLikeMaxP10C:historicalQuantile(feelHigh,.1),feelsLikeMaxP90C:historicalQuantile(feelHigh,.9),
   feelsLikeMethod:"daily apparent-temperature estimate from Tmin/Tmax, mean dewpoint and mean wind; inputs are daily aggregates and not time-paired",
   qualityFlags:["31-day rolling calendar window","feels-like uses daily aggregate inputs; no direct solar load"]
  };
 })};
}
