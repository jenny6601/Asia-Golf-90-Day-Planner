import {auditForecastPoint} from "./coordinate-audit.js";

export const OKINAWA_ZONES = Object.freeze([
  { id: "north", label: "北部", place: "名護市", latitude: 26.5916, longitude: 127.9774 },
  { id: "central", label: "中部", place: "沖繩市", latitude: 26.3344, longitude: 127.8056 },
  { id: "south", label: "南部", place: "那霸市", latitude: 26.2123, longitude: 127.6792 }
]);

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export async function fetchOkinawa16DayForecast(fetchImpl = fetch) {
  const results = await Promise.all(OKINAWA_ZONES.map(async zone => {
    const params = new URLSearchParams({
      latitude: String(zone.latitude),
      longitude: String(zone.longitude),
      hourly: [
        "temperature_2m", "apparent_temperature", "relative_humidity_2m",
        "precipitation_probability", "precipitation", "rain", "showers",
        "weather_code", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"
      ].join(","),
      daily: [
        "precipitation_sum", "precipitation_probability_max",
        "temperature_2m_min", "temperature_2m_max",
        "wind_speed_10m_max", "wind_gusts_10m_max"
      ].join(","),
      forecast_days: "16",
      timezone: "Asia/Tokyo",
      wind_speed_unit: "ms",
      precipitation_unit: "mm",
      temperature_unit: "celsius"
    });
    const response = await fetchImpl(`${ENDPOINT}?${params}`);
    if (!response.ok) throw new Error(`${zone.label} API HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.daily?.time?.length || !payload.hourly?.time?.length) {
      throw new Error(`${zone.label} 回傳資料欄位不完整`);
    }
    return {
      zone,
      fetchedAt: new Date().toISOString(),
      timezone: payload.timezone,
      generationTimeMs: payload.generationtime_ms,
      elevation: payload.elevation,
      hourlyUnits: payload.hourly_units,
      dailyUnits: payload.daily_units,
      latitude: payload.latitude,
      longitude: payload.longitude,
      daily: payload.daily,
      hourly: payload.hourly
    };
  }));
  return {
    provider: "Open-Meteo Forecast API",
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Tokyo",
    forecastDays: 16,
    zones: results
  };
}

export async function fetchCourseForecast(courses, fetchImpl = fetch) {
  if (!Array.isArray(courses) || courses.length < 1 || courses.length > 3) {
    throw new TypeError("請選擇1至3個球場");
  }
  const results = await Promise.all(courses.map(async course => {
    const timezone = course.timezone || "Asia/Tokyo";
    if (!Number.isFinite(course.latitude) || !Number.isFinite(course.longitude)) {
      throw new Error(`${course.name} 尚未完成 GPS 座標核實，暫不可查詢球場預報`);
    }
    const params = new URLSearchParams({
      latitude:String(course.latitude), longitude:String(course.longitude),
      hourly:"temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,uv_index",
      daily:"weather_code,precipitation_sum,precipitation_probability_max,temperature_2m_min,temperature_2m_max,apparent_temperature_min,apparent_temperature_max,wind_speed_10m_max,wind_gusts_10m_max",
      forecast_days:"16",timezone,wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius"
    });
    const response=await fetchImpl(`${ENDPOINT}?${params}`);
    if(!response.ok) throw new Error(`${course.name} API HTTP ${response.status}`);
    const payload=await response.json();
    if(!payload.daily?.time?.length || !payload.hourly?.time?.length) throw new Error(`${course.name} 回傳欄位不完整`);
    return {course,fetchedAt:new Date().toISOString(),timezone:payload.timezone||timezone,latitude:payload.latitude,longitude:payload.longitude,elevation:payload.elevation,coordinateAudit:auditForecastPoint(course,payload),daily:payload.daily,hourly:payload.hourly};
  }));
  return {provider:"Open-Meteo Forecast API",forecastDays:16,fetchedAt:new Date().toISOString(),timezone:results.length===1?results[0].timezone:null,courses:results};
}
