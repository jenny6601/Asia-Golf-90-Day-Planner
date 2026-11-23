const endpoint = "https://seasonal-api.open-meteo.com/v1/seasonal";
const zones = [
  { id: "north", label: "北部／名護市", latitude: 26.5916, longitude: 127.9774 },
  { id: "central", label: "中部／沖繩市", latitude: 26.3344, longitude: 127.8056 },
  { id: "south", label: "南部／那霸市", latitude: 26.2123, longitude: 127.6792 }
];
const weeklyFields = ["precipitation_mean", "precipitation_anomaly", "precipitation_efi"];
const monthlyFields = ["precipitation_mean", "precipitation_anomaly"];
const isDate = value => typeof value === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(value);

function auditSeries(series, fields, label) {
  if (!series || !Array.isArray(series.time) || !series.time.length) {
    return { available: false, count: 0, fields: {}, warning: label + " 日期序列缺失" };
  }
  const invalidDates = series.time.filter(value => !isDate(value));
  const result = { available: invalidDates.length === 0, count: series.time.length,
    start: series.time[0], end: series.time.at(-1), fields: {} };
  for (const field of fields) {
    const values = series[field];
    const aligned = Array.isArray(values) && values.length === series.time.length &&
      values.every(value => value === null || (typeof value === "number" && Number.isFinite(value)));
    const validCount = aligned ? values.filter(value => typeof value === "number" && Number.isFinite(value)).length : 0;
    result.fields[field] = { aligned, validCount, usable: aligned && validCount > 0 };
  }
  if (invalidDates.length) result.warning = label + " 日期格式錯誤";
  return result;
}

const results = await Promise.all(zones.map(async zone => {
  const params = new URLSearchParams({
    latitude: String(zone.latitude), longitude: String(zone.longitude),
    weekly: weeklyFields.join(","), monthly: [
      "precipitation_mean", "precipitation_anomaly", "wind_speed_10m_mean",
      "wind_speed_10m_anomaly", "temperature_2m_mean", "temperature_2m_anomaly",
      "cloud_cover_mean", "cloud_cover_anomaly", "sunshine_duration_mean",
      "sunshine_duration_anomaly"
    ].join(","),
    forecast_days: "90", timezone: "Asia/Tokyo", wind_speed_unit: "ms",
    precipitation_unit: "mm", temperature_unit: "celsius",
    models: "ecmwf_seasonal_seamless"
  });
  const response = await fetch(endpoint + "?" + params);
  if (!response.ok) throw new Error(zone.label + " HTTP " + response.status);
  const payload = await response.json();
  const weekly = auditSeries(payload.weekly, weeklyFields, "週展望");
  const monthly = auditSeries(payload.monthly, monthlyFields, "月展望");
  const warnings = [];
  if (!weekly.available || !weekly.fields.precipitation_efi?.usable) warnings.push("週 EFI 不可用");
  if (!monthly.available || !monthly.fields.precipitation_mean?.usable ||
      !monthly.fields.precipitation_anomaly?.usable) warnings.push("月雨量平均／距平不可用");
  if (payload.timezone && payload.timezone !== "Asia/Tokyo") warnings.push("時區不符：" + payload.timezone);
  return {
    zone: zone.id, label: zone.label, httpStatus: response.status,
    returnedCoordinates: { latitude: payload.latitude, longitude: payload.longitude },
    timezone: payload.timezone ?? null, model: payload.model ?? null,
    weekly, monthly, warnings
  };
}));

const report = {
  checkedAt: new Date().toISOString(),
  provider: "Open-Meteo Seasonal Forecast API",
  endpoint,
  modelRequested: "ecmwf_seasonal_seamless",
  zones: results,
  readiness: {
    zoneCount: results.length,
    weeklyEfiAllZones: results.every(item => item.weekly.available && item.weekly.fields.precipitation_efi?.usable),
    monthlyRainAllZones: results.every(item => item.monthly.available &&
      item.monthly.fields.precipitation_mean?.usable && item.monthly.fields.precipitation_anomaly?.usable)
  }
};
console.log(JSON.stringify(report, null, 2));
if (results.some(item => item.httpStatus !== 200 || !item.weekly.available && !item.monthly.available)) {
  process.exitCode = 1;
}
