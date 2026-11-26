import test from "node:test";
import assert from "node:assert/strict";
import { compareHourlySnapshots } from "../assets/js/weather-comparison.js";

const zone = { id: "north", label: "北部", place: "名護市" };

test("pairs same-zone same-time future forecasts and calculates absolute differences", () => {
  const weatherApi = { zones: [{ zone, forecastDays: [{ hours: [
    { time: "2026-11-26 10:00", chanceOfRain: 60, precipMm: 1, tempC: 20, feelsLikeC: 19, windKph: 18, gustKph: 27 },
    { time: "2026-11-26 11:00", chanceOfRain: 40, precipMm: 0, tempC: 21, feelsLikeC: 20, windKph: 18, gustKph: 27 }
  ] }] }] };
  const openMeteo = { zones: [{ zone, hourly: {
    time: ["2026-11-26T10:00", "2026-11-26T11:00"],
    precipitation_probability: [50, 50], precipitation: [0.5, 0.2],
    temperature_2m: [21, 22], apparent_temperature: [20, 21],
    wind_speed_10m: [5, 5], wind_gusts_10m: [7.5, 7.5]
  } }] };
  const result = compareHourlySnapshots(weatherApi, openMeteo, "2026-11-26 10:00");
  assert.equal(result.zones[0].comparedHours, 2);
  assert.equal(result.zones[0].metrics.chanceOfRain.meanAbsoluteDifference, 10);
  assert.equal(result.zones[0].metrics.precipMm.meanAbsoluteDifference, 0.35);
  assert.equal(result.zones[0].metrics.windKph.meanAbsoluteDifference, 0);
  assert.equal(result.purpose, "provider_agreement_not_accuracy");
});

test("excludes past hours and rejects missing zones", () => {
  const weatherApi = { zones: [{ zone, forecastDays: [{ hours: [{ time: "2026-11-26 09:00", chanceOfRain: 10 }] }] }] };
  const openMeteo = { zones: [{ zone, hourly: { time: ["2026-11-26T09:00"], precipitation_probability: [20] } }] };
  assert.equal(compareHourlySnapshots(weatherApi, openMeteo, "2026-11-26 10:00").zones[0].comparedHours, 0);
  assert.throws(() => compareHourlySnapshots(weatherApi, { zones: [] }, "2026-11-26 08:00"), /缺少區域/);
});
