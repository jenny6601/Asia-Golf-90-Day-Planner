import { mkdir, writeFile } from "node:fs/promises";
import { fetchWeatherApiSnapshot } from "../assets/js/weatherapi-adapter.js";
import { compareHourlySnapshots } from "../assets/js/weather-comparison.js";

const apiKey = process.env.WEATHERAPI_KEY;
if (!apiKey) throw new Error("WEATHERAPI_KEY secret is missing");
const fetchedAt = new Date().toISOString();
const localParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).formatToParts(new Date());
const part = type => localParts.find(x => x.type === type)?.value;
const cutoffLocal = `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;

const weatherApi = await fetchWeatherApiSnapshot({ apiKey });
const points = weatherApi.zones.map(x => x.zone);
const zones = await Promise.all(points.map(async zone => {
  const params = new URLSearchParams({
    latitude: String(zone.latitude), longitude: String(zone.longitude),
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m",
    daily: "precipitation_sum,precipitation_probability_max,temperature_2m_min,temperature_2m_max,wind_speed_10m_max,wind_gusts_10m_max",
    forecast_days: "16", timezone: "Asia/Tokyo",
    wind_speed_unit: "ms", precipitation_unit: "mm", temperature_unit: "celsius"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo ${zone.id} HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.hourly?.time?.length || !payload.daily?.time?.length) {
    throw new Error(`Open-Meteo ${zone.id} hourly/daily data missing`);
  }
  return {
    zone, provider: "Open-Meteo Forecast API", fetchedAt: new Date().toISOString(),
    timezone: payload.timezone, latitude: payload.latitude, longitude: payload.longitude,
    daily: payload.daily, hourly: payload.hourly
  };
}));
const openMeteo = { provider: "Open-Meteo Forecast API", fetchedAt: new Date().toISOString(), timezone: "Asia/Tokyo", forecastDays: 16, zones };
const comparison = compareHourlySnapshots(weatherApi, {
  zones: zones.map(({zone,hourly}) => ({zone,hourly}))
}, cutoffLocal);
for (const zone of comparison.zones) {
  if (zone.comparedHours === 0) throw new Error(`No overlapping future hourly data for ${zone.zone.id}`);
}
const snapshot = {
  schemaVersion: 2,
  capturedAt: fetchedAt,
  cutoffLocal,
  timezone: "Asia/Tokyo",
  coverage: {
    openMeteoForecastDays: 16,
    weatherApiForecastDays: 3,
    comparisonOverlapDays: 3,
    regions: ["north","central","south"]
  },
  weatherApi,
  openMeteo,
  comparison,
  interpretation: "Provider agreement is not forecast accuracy. The WeatherAPI key is never included."
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/paired-weather-audit.json", JSON.stringify(snapshot, null, 2) + "\n", "utf8");
process.stdout.write(`Forecast snapshot saved: Open-Meteo 16d; WeatherAPI 3d; overlap: ${comparison.zones.map(z => `${z.zone.id}=${z.comparedHours}h`).join(", ")}. API key excluded.\n`);
