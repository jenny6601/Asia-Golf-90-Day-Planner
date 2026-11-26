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
    forecast_days: "3", timezone: "Asia/Tokyo",
    wind_speed_unit: "ms", precipitation_unit: "mm", temperature_unit: "celsius"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo ${zone.id} HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.hourly?.time?.length) throw new Error(`Open-Meteo ${zone.id} hourly data missing`);
  return {
    zone, provider: "Open-Meteo Forecast API", fetchedAt: new Date().toISOString(),
    timezone: payload.timezone, latitude: payload.latitude, longitude: payload.longitude,
    hourly: payload.hourly
  };
}));
const openMeteo = { provider: "Open-Meteo Forecast API", fetchedAt: new Date().toISOString(), timezone: "Asia/Tokyo", zones };
const comparison = compareHourlySnapshots(weatherApi, openMeteo, cutoffLocal);
for (const zone of comparison.zones) {
  if (zone.comparedHours === 0) throw new Error(`No overlapping future hourly data for ${zone.zone.id}`);
}
const snapshot = { schemaVersion: 1, capturedAt: fetchedAt, cutoffLocal, timezone: "Asia/Tokyo", weatherApi, openMeteo, comparison };
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/paired-weather-audit.json", JSON.stringify(snapshot, null, 2) + "\n", "utf8");
process.stdout.write(`Paired snapshot saved: ${comparison.zones.map(z => `${z.zone.id}=${z.comparedHours}h`).join(", ")}. API key excluded.\n`);
