import { writeFile } from "node:fs/promises";

const point = {
  id: "southern-links",
  latitude: 26.118019,
  longitude: 127.738385,
  coordinateStatus: "provisional",
  timezone: "Asia/Tokyo"
};
const models = ["ecmwf_ec46", "ecmwf_seas5", "ecmwf_seasonal_seamless"];
const dailyVars = [
  "temperature_2m_mean", "temperature_2m_min", "temperature_2m_max",
  "precipitation_sum", "rain_sum", "cloud_cover_mean", "wind_speed_10m_mean"
];
const hourlyVars = [
  "temperature_2m", "precipitation", "rain", "cloud_cover", "wind_speed_10m"
];

function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
}
function stats(values) {
  const valid = Array.isArray(values) ? values.filter(v => Number.isFinite(v)) : [];
  return {
    count: Array.isArray(values) ? values.length : 0,
    nonNull: valid.length,
    first: values?.[0] ?? null,
    last: values?.at(-1) ?? null,
    min: valid.length ? Math.min(...valid) : null,
    max: valid.length ? Math.max(...valid) : null
  };
}
function dayIndex(date, firstDate) {
  return Math.floor((Date.parse(date + "T00:00:00Z") - Date.parse(firstDate + "T00:00:00Z")) / 86400000) + 1;
}
function summarizeWindow(times, values, firstDate, minDay, maxDay) {
  const selected = times.map((t, i) => ({ day: dayIndex(t.slice(0, 10), firstDate), value: values?.[i] }))
    .filter(x => x.day >= minDay && x.day <= maxDay);
  const valid = selected.filter(x => Number.isFinite(x.value)).map(x => x.value);
  return { expectedSlots: selected.length, nonNullSlots: valid.length, coveragePct: selected.length ? +(100 * valid.length / selected.length).toFixed(1) : 0 };
}
function ensembleSummary(hourly, times, firstDate, minDay, maxDay) {
  const memberKeys = Array.from({ length: 50 }, (_, i) => `precipitation_member${String(i + 1).padStart(2, "0")}`);
  const slots = times.map((time, i) => {
    const day = dayIndex(time.slice(0, 10), firstDate);
    if (day < minDay || day > maxDay) return null;
    const values = memberKeys.map(k => hourly[k]?.[i]).filter(Number.isFinite);
    if (!values.length) return null;
    return {
      day, membersAvailable: values.length,
      q10: quantile(values, 0.1),
      median: quantile(values, 0.5),
      q90: quantile(values, 0.9),
      memberFractionAbove0_1mm: +(values.filter(v => v > 0.1).length / values.length).toFixed(3)
    };
  }).filter(Boolean);
  const validMemberCounts = slots.map(s => s.membersAvailable);
  return {
    slotsWithEnsembleData: slots.length,
    minMembersPerSlot: validMemberCounts.length ? Math.min(...validMemberCounts) : 0,
    maxMembersPerSlot: validMemberCounts.length ? Math.max(...validMemberCounts) : 0,
    sampleSlots: slots.filter((_, i) => i === 0 || i === Math.floor(slots.length / 2) || i === slots.length - 1)
  };
}
async function probe(model) {
  const url = new URL("https://seasonal-api.open-meteo.com/v1/seasonal");
  url.search = new URLSearchParams({
    latitude: String(point.latitude), longitude: String(point.longitude),
    timezone: point.timezone, forecast_days: "90", models,
    daily: dailyVars.join(","), hourly: hourlyVars.join(","), cell_selection: "land"
  }).toString();
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const bodyText = await response.text();
    let body;
    try { body = JSON.parse(bodyText); } catch { body = null; }
    if (!response.ok) return { model, checkedAt, httpStatus: response.status, ok: false,
      error: body?.reason || body?.error || bodyText.slice(0, 500), requestUrl: url.toString() };

    const daily = body?.daily || {}, hourly = body?.hourly || {};
    const dailyTimes = Array.isArray(daily.time) ? daily.time : [];
    const hourlyTimes = Array.isArray(hourly.time) ? hourly.time : [];
    const firstDate = dailyTimes[0] || hourlyTimes[0]?.slice(0, 10);
    const dailyFields = {};
    for (const [key, values] of Object.entries(daily)) {
      if (key === "time") continue;
      dailyFields[key] = {
        ...stats(values),
        leadDays1to16: summarizeWindow(dailyTimes, values, firstDate, 1, 16),
        leadDays17to46: summarizeWindow(dailyTimes, values, firstDate, 17, 46),
        leadDays47to90: summarizeWindow(dailyTimes, values, firstDate, 47, 90)
      };
    }
    const hourlyFields = {};
    for (const [key, values] of Object.entries(hourly)) {
      if (key === "time") continue;
      hourlyFields[key] = {
        ...stats(values),
        leadDays1to16: summarizeWindow(hourlyTimes, values, firstDate, 1, 16),
        leadDays17to46: summarizeWindow(hourlyTimes, values, firstDate, 17, 46),
        leadDays47to90: summarizeWindow(hourlyTimes, values, firstDate, 47, 90)
      };
    }
    const precipitationEnsemble = {
      leadDays17to46: ensembleSummary(hourly, hourlyTimes, firstDate, 17, 46),
      leadDays47to90: ensembleSummary(hourly, hourlyTimes, firstDate, 47, 90)
    };
    return {
      model, checkedAt, httpStatus: response.status, ok: true, point,
      requestedForecastDays: 90,
      response: {
        latitude: body.latitude, longitude: body.longitude, timezone: body.timezone,
        elevation: body.elevation, generationtime_ms: body.generationtime_ms,
        dailyStart: dailyTimes[0] || null, dailyEnd: dailyTimes.at(-1) || null,
        dailyDateCount: dailyTimes.length, dailyFields,
        hourlyStart: hourlyTimes[0] || null, hourlyEnd: hourlyTimes.at(-1) || null,
        hourlyTimeCount: hourlyTimes.length, hourlyFields, precipitationEnsemble
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
  reportType: "EC46_SEAS5_6HOURLY_DATA_QUALITY_AUDIT",
  generatedAt: new Date().toISOString(),
  source: "Open-Meteo Seasonal Forecast API",
  point,
  interpretation: {
    ensembleFraction: "Fraction of available ensemble members exceeding 0.1 mm at a 6-hour step; NOT a calibrated precipitation probability.",
    sixHourlyResolution: "Seasonal API hourly array uses 6-hourly time steps; time count alone does not establish valid data coverage.",
    forecastSkill: "This audit measures availability and ensemble spread only, not forecast skill or accuracy."
  },
  constraints: [
    "No daily precipitation probability is inferred from precipitation amount.",
    "Course coordinates are provisional and require independent validation.",
    "No historical/reanalysis data is substituted for future forecasts."
  ],
  results
};
await writeFile("seasonal-api-audit.json", JSON.stringify(report, null, 2) + "\n");
for (const r of results) {
  const h = r.response?.hourlyFields || {};
  console.log(JSON.stringify({
    model: r.model, ok: r.ok, httpStatus: r.httpStatus,
    dailyDateCount: r.response?.dailyDateCount,
    hourlyTimeCount: r.response?.hourlyTimeCount,
    precipitation6h: {
      lead17to46: h.precipitation?.leadDays17to46,
      lead47to90: h.precipitation?.leadDays47to90
    },
    ensemble17to46: r.response?.precipitationEnsemble?.leadDays17to46,
    ensemble47to90: r.response?.precipitationEnsemble?.leadDays47to90,
    error: r.error
  }));
}
if (results.every(r => !r.ok)) process.exitCode = 1;
