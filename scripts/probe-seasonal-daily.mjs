/**
 * Read-only probe for daily-scale ECMWF seasonal data.
 * Tests daily aggregates and 6-hourly fields at Okinawa regional proxy points.
 * This is a data-availability diagnostic only; it does not generate forecasts,
 * alter app data, or deploy the application.
 */
const ENDPOINT = "https://seasonal-api.open-meteo.com/v1/seasonal";
const POINTS = [
  { id: "north", label: "北部／名護", latitude: 26.5916, longitude: 127.9774 },
  { id: "central", label: "中部／沖繩市", latitude: 26.3344, longitude: 127.8056 },
  { id: "south", label: "南部／那霸", latitude: 26.2123, longitude: 127.6792 }
];
const HOURLY = [
  "precipitation", "rain", "showers", "temperature_2m",
  "apparent_temperature", "weather_code", "wind_speed_10m",
  "wind_gusts_10m", "cloud_cover", "relative_humidity_2m"
].join(",");
const DAILY = [
  "weather_code", "temperature_2m_max", "temperature_2m_min",
  "temperature_2m_mean", "wind_speed_10m_mean", "cloud_cover_mean",
  "sunshine_duration"
].join(",");

const finiteCount = values => Array.isArray(values)
  ? values.filter(value => typeof value === "number" && Number.isFinite(value)).length
  : 0;
const sample = (times, values, start, end) => {
  if (!Array.isArray(times) || !Array.isArray(values)) return { expected: 0, valid: 0 };
  const startDate = typeof start === "string" ? start.slice(0, 10) : start;
  const endDate = typeof end === "string" ? end.slice(0, 10) : end;
  const indexes = times.map((time, i) => ({ time, i }))
    .filter(x => x.time.slice(0, 10) >= startDate && x.time.slice(0, 10) <= endDate)
    .map(x => x.i);
  return { expected: indexes.length, valid: indexes.filter(i => Number.isFinite(values[i])).length };
};
const dayRange = (times, startLead, endLead) => {
  const dates = (times || []).filter(Boolean);
  const start = dates[startLead - 1]?.slice(0, 10);
  const end = dates[endLead - 1]?.slice(0, 10);
  return { start, end };
};

async function probe(point) {
  const params = new URLSearchParams({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    hourly: HOURLY,
    daily: DAILY,
    forecast_days: "90",
    timezone: "Asia/Tokyo",
    wind_speed_unit: "ms",
    precipitation_unit: "mm",
    temperature_unit: "celsius",
    models: "ecmwf_seasonal_seamless"
  });
  const response = await fetch(`${ENDPOINT}?${params}`);
  if (!response.ok) throw new Error(`${point.id}: HTTP ${response.status}`);
  const payload = await response.json();
  const hourlyTimes = payload.hourly?.time || [];
  const dailyTimes = payload.daily?.time || [];
  const fields = {};
  for (const key of HOURLY.split(",")) {
    const values = payload.hourly?.[key];
    fields[`hourly.${key}`] = {
      length: Array.isArray(values) ? values.length : 0,
      nonNull: finiteCount(values),
      d17_46: sample(hourlyTimes, values, dailyTimes[16], dailyTimes[45]),
      d47_90: sample(hourlyTimes, values, dailyTimes[46], dailyTimes[89])
    };
  }
  for (const key of DAILY.split(",")) {
    const values = payload.daily?.[key];
    fields[`daily.${key}`] = {
      length: Array.isArray(values) ? values.length : 0,
      nonNull: finiteCount(values),
      d17_46: sample(dailyTimes, values, dailyTimes[16], dailyTimes[45]),
      d47_90: sample(dailyTimes, values, dailyTimes[46], dailyTimes[89])
    };
  }
  return {
    point,
    returnedCoordinate: { latitude: payload.latitude, longitude: payload.longitude },
    timezone: payload.timezone,
    model: payload.model || "not-returned",
    generationTimeMs: payload.generationtime_ms,
    hourlyCount: hourlyTimes.length,
    dailyCount: dailyTimes.length,
    dailyRange: dayRange(dailyTimes, 1, 90),
    dailyLeadBands: {
      d17_46: dayRange(dailyTimes, 17, 46),
      d47_90: dayRange(dailyTimes, 47, 90)
    },
    fields
  };
}

const results = [];
for (const point of POINTS) results.push(await probe(point));
const report = {
  generatedAt: new Date().toISOString(),
  provider: "Open-Meteo Seasonal Forecast API",
  modelRequested: "ecmwf_seasonal_seamless",
  purpose: "daily and 6-hourly field availability probe; not a skill validation",
  results
};
console.log(JSON.stringify(report, null, 2));
const hasDailyCoverage = results.every(x => x.dailyCount >= 90);
if (!hasDailyCoverage) {
  console.error("FAIL: one or more points returned fewer than 90 daily dates.");
  process.exitCode = 1;
}
