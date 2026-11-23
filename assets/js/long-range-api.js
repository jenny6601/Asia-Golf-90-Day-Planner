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
const MONTHLY=[
 "precipitation_mean","precipitation_anomaly","wind_speed_10m_mean","wind_speed_10m_anomaly",
 "temperature_2m_mean","temperature_2m_anomaly","cloud_cover_mean","cloud_cover_anomaly",
 "sunshine_duration_mean","sunshine_duration_anomaly"
].join(",");
function validateSeries(series,requiredFields,zoneLabel,seriesLabel){
 if(!series||!Array.isArray(series.time)||series.time.length===0)
  throw new Error(zoneLabel+" 缺少有效的"+seriesLabel+"日期序列");
 const invalidDates=series.time.filter(x=>typeof x!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x));
 if(invalidDates.length)throw new Error(zoneLabel+" "+seriesLabel+"日期格式錯誤");
 const fields={};
 for(const key of requiredFields){
  const values=series[key];
  const valid=Array.isArray(values)&&values.length===series.time.length&&values.every(v=>v===null||(typeof v==="number"&&Number.isFinite(v)));
  const validCount=valid?values.filter(v=>typeof v==="number"&&Number.isFinite(v)).length:0;
  fields[key]={available:valid&&validCount>0,complete:valid&&validCount===series.time.length,validCount,coverage:series.time.length?Number((validCount/series.time.length).toFixed(3)):0};
 }
 return {count:series.time.length,start:series.time[0],end:series.time.at(-1),fields};
}
export async function fetchOkinawaLongRange(fetchImpl=fetch){
 const points=await Promise.all(OKINAWA_LONG_RANGE_POINTS.map(async point=>{
  const params=new URLSearchParams({
   latitude:String(point.latitude),longitude:String(point.longitude),
   weekly:WEEKLY,monthly:MONTHLY,
   forecast_days:"90",timezone:"Asia/Tokyo",
   wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius",
   models:"ecmwf_seasonal_seamless"
  });
  const response=await fetchImpl(`${ENDPOINT}?${params}`);
  if(!response.ok)throw new Error(`${point.label} 長期展望 API HTTP ${response.status}`);
  const payload=await response.json();
  if(!payload.weekly?.time?.length && !payload.monthly?.time?.length)throw new Error(point.label+" 未回傳週/月展望資料");
  const weeklyAudit=payload.weekly?.time?.length?validateSeries(payload.weekly,["precipitation_efi","precipitation_mean","precipitation_anomaly"],point.label,"週展望"):null;
  const monthlyAudit=payload.monthly?.time?.length?validateSeries(payload.monthly,["precipitation_mean","precipitation_anomaly"],point.label,"月展望"):null;
  const warnings=[];
  if(!weeklyAudit?.fields.precipitation_efi.available)warnings.push("週展望缺少有效 precipitation_efi，17–46天可能無法評分");
  if(!monthlyAudit?.fields.precipitation_mean.available||!monthlyAudit?.fields.precipitation_anomaly.available)warnings.push("月展望缺少有效雨量平均值／距平，47–90天可能無法評分");
  if(payload.timezone&&payload.timezone!=="Asia/Tokyo")warnings.push("供應商回傳時區為 "+payload.timezone+"，預期 Asia/Tokyo");
  return {point,latitude:payload.latitude,longitude:payload.longitude,elevation:payload.elevation,timezone:payload.timezone,model:payload.model??"ECMWF seasonal seamless (EC46 + SEAS5)",fetchedAt:new Date().toISOString(),weekly:payload.weekly??null,monthly:payload.monthly??null,dataQuality:{weekly:weeklyAudit,monthly:monthlyAudit,warnings}};
 }));
 const warnings=[];
 const gridKey=x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)?x.latitude.toFixed(4)+","+x.longitude.toFixed(4):"unknown:"+x.point.id;
 const uniqueGridCells=new Set(points.map(gridKey));
 const uniqueGridCellCount=uniqueGridCells.size;
 if(uniqueGridCellCount<points.length)warnings.push("空間解析度限制：三個代表區域僅落在 "+uniqueGridCellCount+" 個不同預報網格，不能視為三份獨立區域證據");
 return {provider:"Open-Meteo Seasonal Forecast API",model:"ECMWF seasonal seamless (EC46 + SEAS5)",fetchedAt:new Date().toISOString(),timezone:"Asia/Tokyo",points,dataQuality:{zoneCount:points.length,uniqueGridCellCount,spatiallyDistinct:uniqueGridCellCount===points.length,completeZoneCount:points.filter(x=>x.weekly?.time?.length&&x.monthly?.time?.length).length,warnings,readyForWeeklyScoring:points.every(x=>x.dataQuality.weekly?.fields.precipitation_efi.available),weeklyCoverageComplete:points.every(x=>x.dataQuality.weekly?.fields.precipitation_efi.complete),readyForMonthlyScoring:points.every(x=>x.dataQuality.monthly?.fields.precipitation_mean.available&&x.dataQuality.monthly?.fields.precipitation_anomaly.available),monthlyCoverageComplete:points.every(x=>x.dataQuality.monthly?.fields.precipitation_mean.complete&&x.dataQuality.monthly?.fields.precipitation_anomaly.complete)}};
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
