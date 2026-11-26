import { writeFile } from "node:fs/promises";

const point = {
  id: "southern-links",
  latitude: 26.118019,
  longitude: 127.738385,
  coordinateStatus: "provisional",
  timezone: "Asia/Tokyo"
};
const models = [
  "ecmwf_ec46",
  "ecmwf_seas5",
  "ecmwf_seasonal_seamless"
];
const dailyVars = [
  "temperature_2m_mean",
  "temperature_2m_min",
  "temperature_2m_max",
  "precipitation_sum",
  "rain_sum",
  "cloud_cover_mean",
  "wind_speed_10m_mean"
];
const hourlyVars = [
  "temperature_2m",
  "precipitation",
  "rain",
  "cloud_cover",
  "wind_speed_10m"
];

function summarizeArray(values) {
  if (!Array.isArray(values)) return { present: false, count: 0, nonNull: 0 };
  return {
    present: true,
    count: values.length,
    nonNull: values.filter(v => v !== null && v !== undefined).length,
    first: values[0] ?? null,
    last: values.at(-1) ?? null
  };
}

async function probe(model) {
  const url = new URL("https://seasonal-api.open-meteo.com/v1/seasonal");
  url.search = new URLSearchParams({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    timezone: point.timezone,
    forecast_days: "90",
    models: model,
    daily: dailyVars.join(","),
    hourly: hourlyVars.join(","),
    cell_selection: "land"
  }).toString();

  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const bodyText = await response.text();
    let body;
    try { body = JSON.parse(bodyText); } catch { body = null; }
    if (!response.ok) {
      return { model, checkedAt, httpStatus: response.status, ok: false,
        error: body?.reason || body?.error || bodyText.slice(0, 500), requestUrl: url.toString() };
    }
    const daily = body?.daily || {};
    const hourly = body?.hourly || {};
    const dailyTimes = Array.isArray(daily.time) ? daily.time : [];
    const hourlyTimes = Array.isArray(hourly.time) ? hourly.time : [];
    const series = {};
    for (const [key, value] of Object.entries(daily)) {
      if (key !== "time") series[key] = summarizeArray(value);
    }
    const hourlyKeys = Object.keys(hourly).filter(k => k !== "time");
    const memberLikeKeys = [...Object.keys(daily), ...Object.keys(hourly)]
      .filter(k => /member|\d{2,}/i.test(k));
    return {
      model, checkedAt, httpStatus: response.status, ok: true,
      point, requestedForecastDays: 90,
      response: {
        latitude: body.latitude, longitude: body.longitude,
        timezone: body.timezone, elevation: body.elevation,
        generationtime_ms: body.generationtime_ms,
        dailyStart: dailyTimes[0] || null,
        dailyEnd: dailyTimes.at(-1) || null,
        dailyDateCount: dailyTimes.length,
        dailyFields: series,
        hourlyStart: hourlyTimes[0] || null,
        hourlyEnd: hourlyTimes.at(-1) || null,
        hourlyTimeCount: hourlyTimes.length,
        hourlyFields: hourlyKeys,
        memberLikeKeys
      },
      requestUrl: url.toString()
    };
  } catch (error) {
    return { model, checkedAt, ok: false, error: String(error), requestUrl: url.toString() };
  }
}

const results = [];
for (const model of models) results.push(await probe(model));
const report = {
  reportType: "EC46_SEAS5_SEASONAL_API_AUDIT",
  generatedAt: new Date().toISOString(),
  source: "Open-Meteo Seasonal Forecast API",
  point,
  constraints: [
    "This is a live API availability/schema probe, not a forecast verification.",
    "No daily precipitation probability is inferred from precipitation amount.",
    "Course coordinates are provisional and require independent validation.",
    "No historical/reanalysis data is substituted for future forecast data."
  ],
  results
};
await writeFile("seasonal-api-audit.json", JSON.stringify(report, null, 2) + "\n");
for (const r of results) {
  console.log(JSON.stringify({
    model: r.model, ok: r.ok, httpStatus: r.httpStatus,
    dailyDateCount: r.response?.dailyDateCount,
    dailyStart: r.response?.dailyStart, dailyEnd: r.response?.dailyEnd,
    hourlyTimeCount: r.response?.hourlyTimeCount, error: r.error
  }));
}
if (results.every(r => !r.ok)) process.exitCode = 1;
