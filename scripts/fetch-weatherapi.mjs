import { mkdir, writeFile } from "node:fs/promises";
import { fetchWeatherApiSnapshot } from "../assets/js/weatherapi-adapter.js";

const apiKey = process.env.WEATHERAPI_KEY;
if (!apiKey) throw new Error("WEATHERAPI_KEY secret is missing");
const snapshot = await fetchWeatherApiSnapshot({ apiKey });
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/weatherapi-3day.json", JSON.stringify(snapshot, null, 2) + "\n", "utf8");
process.stdout.write(`WeatherAPI snapshot created: ${snapshot.zones.length} zones; ${snapshot.zones.reduce((n,z)=>n+z.forecastDays.length,0)} zone-days. API key was not written to output.\n`);
