import test from "node:test";
import assert from "node:assert/strict";
import { WEATHERAPI_ZONES, fetchWeatherApiSnapshot } from "../assets/js/weatherapi-adapter.js";

const fixture = {
  location: { name: "Nago", localtime: "2026-11-26 10:00", tz_id: "Asia/Tokyo", lat: 26.59, lon: 127.97 },
  current: { temp_c: 22, feelslike_c: 23, humidity: 70, wind_kph: 10, gust_kph: 15, condition: { text: "晴" }, last_updated: "2026-11-26 10:00" },
  forecast: { forecastday: [{ date: "2026-11-26", day: { maxtemp_c: 25, mintemp_c: 19, totalprecip_mm: 1.2, daily_chance_of_rain: 30, daily_will_it_rain: 1, condition: { text: "小雨" } }, hour: [{ time: "2026-11-26 10:00", temp_c: 22, feelslike_c: 23, chance_of_rain: 40, will_it_rain: 1, precip_mm: 0.2, humidity: 70, wind_kph: 10, gust_kph: 15, condition: { text: "小雨" } }] }] }
};

test("WeatherAPI adapter requests three Okinawa zones and normalizes 3-day fields", async () => {
  const urls = [];
  const result = await fetchWeatherApiSnapshot({
    apiKey: "test-secret",
    now: () => "2026-11-26T02:00:00.000Z",
    fetchImpl: async url => { urls.push(new URL(url)); return { ok: true, json: async () => structuredClone(fixture) }; }
  });
  assert.equal(urls.length, 3);
  assert.deepEqual(result.zones.map(x => x.zone.id), ["north", "central", "south"]);
  assert.equal(result.forecastDaysRequested, 3);
  assert.equal(result.fetchedAt, "2026-11-26T02:00:00.000Z");
  for (const url of urls) {
    assert.equal(url.searchParams.get("key"), "test-secret");
    assert.equal(url.searchParams.get("days"), "3");
    assert.equal(url.searchParams.get("aqi"), "no");
    assert.equal(url.searchParams.get("alerts"), "no");
  }
  assert.equal(result.zones[0].forecastDays[0].hours[0].chanceOfRain, 40);
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("WeatherAPI adapter rejects missing secret and provider errors", async () => {
  await assert.rejects(fetchWeatherApiSnapshot({ apiKey: "" }), /WEATHERAPI_KEY 未設定/);
  await assert.rejects(fetchWeatherApiSnapshot({ apiKey: "x", fetchImpl: async () => ({ ok: false, status: 401 }) }), /HTTP 401/);
});

test("WeatherAPI adapter rejects incomplete forecast payloads", async () => {
  await assert.rejects(
    fetchWeatherApiSnapshot({ apiKey: "x", fetchImpl: async () => ({ ok: true, json: async () => ({ forecast: {} }) }) }),
    /未回傳逐日預報/
  );
  assert.equal(WEATHERAPI_ZONES.length, 3);
});
