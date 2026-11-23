import fs from "node:fs/promises";

const zones = [
  { id: "north", label: "北部", latitude: 26.5916, longitude: 127.9774 },
  { id: "central", label: "中部", latitude: 26.3344, longitude: 127.8056 },
  { id: "south", label: "南部", latitude: 26.2123, longitude: 127.6792 }
];
const vars = ["temperature_2m", "apparent_temperature", "precipitation", "wind_speed_10m", "wind_gusts_10m"];
const runs = ["2025-08-01T00:00", "2026-05-01T00:00"];
const windows = [
  { start: "2025-08-01", end: "2025-08-07", label: "2025-08-summer" },
  { start: "2025-01-15", end: "2025-01-21", label: "2025-01-winter" }
];
const results = [];
async function probe(name, url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Asia-Golf-90-Day-Planner-hindcast-probe/1.0" } });
    const body = await response.json().catch(() => ({}));
    const hourly = body.hourly ?? {};
    const fields = Object.entries(hourly).filter(([k,v]) => k !== "time" && Array.isArray(v));
    const counts = Object.fromEntries(fields.map(([k,v]) => [k, v.filter(x => x !== null && x !== undefined).length]));
    const record = {
      name, ok: response.ok && fields.length > 0, httpStatus: response.status,
      timezone: body.timezone ?? null, latitude: body.latitude ?? null, longitude: body.longitude ?? null,
      elevation: body.elevation ?? null, timeCount: hourly.time?.length ?? 0,
      nonNullCounts: counts, generationTimeMs: body.generationtime_ms ?? null,
      error: body.reason ?? body.error ?? null, elapsedMs: Date.now() - started
    };
    results.push(record);
    return record;
  } catch (error) {
    const record = { name, ok: false, error: String(error), elapsedMs: Date.now() - started };
    results.push(record);
    return record;
  }
}
for (const zone of zones) {
  for (const window of windows) {
    const p = new URLSearchParams({
      latitude: String(zone.latitude), longitude: String(zone.longitude),
      start_date: window.start, end_date: window.end,
      hourly: vars.map(v => v + "_previous_day1").concat(["precipitation_previous_day3", "precipitation_previous_day7", "wind_speed_10m_previous_day3", "wind_speed_10m_previous_day7"]).join(","),
      models: "ecmwf_ifs", timezone: "Asia/Tokyo", wind_speed_unit: "ms", precipitation_unit: "mm"
    });
    await probe("previous-runs/" + zone.id + "/" + window.label,
      "https://previous-runs-api.open-meteo.com/v1/forecast?" + p);
  }
  for (const run of runs) {
    const p = new URLSearchParams({
      latitude: String(zone.latitude), longitude: String(zone.longitude),
      run, models: "ecmwf_ifs", forecast_days: "15", timezone: "GMT",
      hourly: vars.join(","), wind_speed_unit: "ms", precipitation_unit: "mm"
    });
    await probe("single-runs/" + zone.id + "/" + run,
      "https://single-runs-api.open-meteo.com/v1/forecast?" + p);
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  scope: "Okinawa Main Island north/central/south representative proxy coordinates",
  model: "ecmwf_ifs",
  note: "Availability probe only. Non-null counts do not prove forecast accuracy or observation verification.",
  results
};
await fs.mkdir("artifacts", { recursive: true });
await fs.writeFile("artifacts/hindcast-api-probe.json", JSON.stringify(report, null, 2));
const md = [
  "# Okinawa Hindcast API Availability Probe",
  "",
  "Generated: " + report.generatedAt,
  "",
  "| Probe | HTTP | Result | Hours | Non-null variable counts | Error |",
  "|---|---:|---|---:|---|---|",
  ...results.map(r => "| " + r.name + " | " + (r.httpStatus ?? "—") + " | " + (r.ok ? "data" : "unavailable") + " | " + (r.timeCount ?? 0) + " | " + Object.entries(r.nonNullCounts ?? {}).map(([k,v]) => k + ": " + v).join(", ") + " | " + (r.error ?? "") + " |"),
  "",
  "This report checks endpoint/data availability only; it is not a skill score."
].join("\n");
await fs.writeFile("artifacts/hindcast-api-probe.md", md);
console.log(md);
if (results.every(r => !r.ok)) process.exitCode = 1;
