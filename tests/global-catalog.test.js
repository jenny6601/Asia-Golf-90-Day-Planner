import test from "node:test";
import assert from "node:assert/strict";
import {groupCoursesByWeatherRegion} from "../assets/js/regional-weather.js";
import fs from "node:fs/promises";

const root = new URL("../config/global/", import.meta.url);
const countries = JSON.parse(await fs.readFile(new URL("countries.json", root), "utf8"));
const courses = JSON.parse(await fs.readFile(new URL("courses.json", root), "utf8"));
const providerConfig = JSON.parse(await fs.readFile(new URL("providers.json", root), "utf8"));

test("global country registry contains the eight planned launch markets", () => {
  assert.deepEqual(countries.map(x => x.code), ["JP","KR","CN","VN","TH","MY","SG","ID"]);
});

test("global course catalog preserves all six Okinawa pilot courses", () => {
  assert.deepEqual(courses.map(x => x.id), ["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"]);
  assert.ok(courses.every(x => x.countryCode === "JP" && x.timezone === "Asia/Tokyo"));
});

test("pending course coordinates are explicitly unavailable, not fabricated", () => {
  const pgm = courses.find(x => x.id === "pgm-okinawa");
  assert.equal(pgm.coordinateStatus, "pending");
  assert.equal(pgm.latitude, null);
  assert.equal(pgm.longitude, null);
});

test("global forecast policy uses two providers for preliminary screening and separates strict comparison", () => {
  assert.equal(providerConfig.preliminaryMinimumCompleteProviders, 2);
  assert.deepEqual(providerConfig.strictComparisonProviders, ["openMeteo","visualCrossing","foreca"]);
  assert.equal(providerConfig.dateDecision.nights, 4);
  assert.equal(providerConfig.dateDecision.rounds, 3);
});

test("all current Okinawa courses are assigned to shared regional weather groups", () => {
  assert.ok(courses.every(course => typeof course.weatherRegionId === "string" && course.weatherRegionId.length > 0));
  const groups = groupCoursesByWeatherRegion(courses);
  assert.deepEqual(groups.map(x => x.weatherRegionId), ["JP-OKINAWA-CENTRAL","JP-OKINAWA-NORTH","JP-OKINAWA-SOUTH"]);
  assert.equal(groups.reduce((sum, group) => sum + group.courseCount, 0), courses.length);
  assert.equal(groups.find(x => x.weatherRegionId === "JP-OKINAWA-NORTH").courseCount, 3);
  assert.equal(groups.find(x => x.weatherRegionId === "JP-OKINAWA-SOUTH").courseCount, 2);
});
