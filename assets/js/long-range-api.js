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
  if(!payload.weekly?.time?.length && !payload.monthly?.time?.length)throw new Error(`${point.label} 未回傳週/月展望資料`);
  return {point,latitude:payload.latitude,longitude:payload.longitude,elevation:payload.elevation,timezone:payload.timezone,model:payload.model??"ECMWF seasonal seamless (EC46 + SEAS5)",fetchedAt:new Date().toISOString(),weekly:payload.weekly??null,monthly:payload.monthly??null};
 }));
 return {provider:"Open-Meteo Seasonal Forecast API",model:"ECMWF seasonal seamless (EC46 + SEAS5)",fetchedAt:new Date().toISOString(),timezone:"Asia/Tokyo",points};
}
