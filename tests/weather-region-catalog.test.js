import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../config/global/", import.meta.url);
const countries = JSON.parse(await fs.readFile(new URL("countries.json", root), "utf8"));
const courses = JSON.parse(await fs.readFile(new URL("courses.json", root), "utf8"));
const regions = JSON.parse(await fs.readFile(new URL("weather-regions.json", root), "utf8"));

test("regional travel catalog keeps Okinawa active and Vietnam destinations planned", () => {
  const byId = new Map(regions.map(region => [region.id, region]));
  for (const id of ["JP-OKINAWA-NORTH","JP-OKINAWA-CENTRAL","JP-OKINAWA-SOUTH"]) {
    assert.equal(byId.get(id)?.status, "active");
  }
  for (const id of ["VN-HANOI","VN-HO-CHI-MINH-CITY","VN-DA-NANG"]) {
    assert.equal(byId.get(id)?.status, "planned");
    assert.equal(byId.get(id)?.countryCode, "VN");
    assert.equal(byId.get(id)?.weatherUnit, "regional");
  }
});

test("Hokkaido Tomakomai-Chitose is only a planned destination, not a fabricated course group", () => {
  const region = regions.find(item => item.id === "JP-HOKKAIDO-TOMAKOMAI-CHITOSE");
  assert.equal(region?.status, "planned");
  assert.equal(courses.some(course => course.weatherRegionId === region.id), false);
});

test("every current course references an active registered regional weather unit", () => {
  const byId = new Map(regions.map(region => [region.id, region]));
  for (const course of courses) {
    const region = byId.get(course.weatherRegionId);
    assert.ok(region, course.id + " missing weather region");
    assert.equal(region.status, "active");
    assert.equal(region.countryCode, course.countryCode);
  }
});

test("all regional entries belong to the eight-country registry", () => {
  const codes = new Set(countries.map(country => country.code));
  assert.ok(regions.every(region => codes.has(region.countryCode)));
});
