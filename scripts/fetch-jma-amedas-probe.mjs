import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://www.jma.go.jp/bosai/amedas";
const STATIONS = [
  { zoneId: "north", zoneLabel: "沖繩北部", stationId: "91107", stationName: "名護", latitude: 26.593, longitude: 127.965, expectedElements: "precipitation,temp,wind" },
  { zoneId: "central", zoneLabel: "沖繩中部", stationId: "91161", stationName: "胡屋", latitude: 26.327, longitude: 127.805, expectedElements: "precipitation_only" },
  { zoneId: "south", zoneLabel: "沖繩南部", stationId: "91197", stationName: "那霸", latitude: 26.207, longitude: 127.687, expectedElements: "precipitation,temp,wind" }
];

async function getJson(url, label) {
  const response = await fetch(url, { headers: { "User-Agent": "Asia-Golf-90-Day-Planner observation audit" } });
  if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
  return response.json();
}

const latestText = await (await fetch(`${BASE}/data/latest_time.txt`)).text();
const latestTime = latestText.trim();
if (!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}[+\\-]\\d{2}:\\d{2}$/.test(latestTime)) {
  throw new Error(`Unexpected JMA latest_time format: ${latestTime}`);
}
const date = latestTime.slice(0, 10).replaceAll("-", "");
const hour = Number(latestTime.slice(11, 13));
const blockHour = String(Math.floor(hour / 3) * 3).padStart(2, "0");
const block = `${date}_${blockHour}`;

const [stationTable, observations] = await Promise.all([
  getJson(`${BASE}/const/amedastable.json`, "JMA station table"),
  Promise.all(STATIONS.map(async station => {
    const url = `${BASE}/data/point/${station.stationId}/${block}.json`;
    const payload = await getJson(url, `JMA station ${station.stationId}`);
    const times = Object.keys(payload).sort();
    if (!times.length) throw new Error(`JMA station ${station.stationId} returned no records`);
    return { ...station, sourceUrl: url, recordCount: times.length, firstRecordTime: times[0], lastRecordTime: times.at(-1), raw: payload };
  }))
]);

for (const station of STATIONS) {
  if (!stationTable[station.stationId]) throw new Error(`Station ${station.stationId} missing from JMA station table`);
}
const result = {
  schemaVersion: 1,
  source: "Japan Meteorological Agency AMeDAS website data",
  sourceType: "official_site_json_endpoint_not_formally_documented_api",
  capturedAt: new Date().toISOString(),
  latestObservationTime: latestTime,
  requestedThreeHourBlock: block,
  timezone: "Asia/Tokyo",
  stationMetadata: Object.fromEntries(STATIONS.map(s => [s.stationId, stationTable[s.stationId]])),
  stations: observations,
  interpretation: {
    status: "raw_observation_probe_only",
    note: "Raw payload is retained for schema inspection. No forecast verification scores are calculated until field units, quality flags, accumulation periods, and station representativeness are validated."
  }
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/jma-amedas-observation-probe.json", JSON.stringify(result, null, 2) + "\n");
process.stdout.write(`JMA AMeDAS raw probe saved: ${observations.map(s => `${s.stationId}=${s.recordCount}`).join(", ")} records; latest=${latestTime}.\n`);
