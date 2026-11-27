import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mapping = JSON.parse(readFileSync(new URL("../config/global/era5-land-grid-points-japan.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json", import.meta.url), "utf8"));
const japan = registry.countries.find(country => country.countryCode === "JP");
const mainland = japan.subregions.filter(item => !item.id.startsWith("JP-OKI-"));

test("ERA5-Land mapping contains exactly one expected grid point for each Japan mainland subregion", () => {
  assert.equal(mapping.subregionCount, 16);
  assert.equal(mapping.points.length, 16);
  assert.deepEqual(mapping.points.map(point => point.subregionId).sort(), mainland.map(item => item.id).sort());
  assert.equal(new Set(mapping.points.map(point => point.subregionId)).size, 16);
});

test("mapped points preserve canonical representative coordinates and use nearest 0.1 degree grid", () => {
  for (const point of mapping.points) {
    const source = mainland.find(item => item.id === point.subregionId);
    assert.equal(point.representativePoint.latitude, source.candidateCoordinates.latitude);
    assert.equal(point.representativePoint.longitude, source.candidateCoordinates.longitude);
    assert.equal(point.era5LandGridPoint.latitude, Math.round(source.candidateCoordinates.latitude * 10) / 10);
    assert.equal(point.era5LandGridPoint.longitude, Math.round(source.candidateCoordinates.longitude * 10) / 10);
    assert.ok(point.gridDistanceKm >= 0 && point.gridDistanceKm < 8, point.subregionId);
    assert.equal(point.timezone, "Asia/Tokyo");
  }
});

test("grid mapping is explicitly provisional until actual CDS coordinates are read back", () => {
  assert.equal(mapping.status, "grid-point-mapping-only-not-data-download");
  assert.match(mapping.caveat, /actual latitude\/longitude coordinates/);
  assert.equal(mapping.gridResolutionDegrees, 0.1);
});

test("ERA5-Land daily aggregation uses Japan local dates and documented units", () => {
  const plan = JSON.parse(readFileSync(new URL("../config/global/regional-climate-data-plan.json", import.meta.url), "utf8"));
  assert.equal(plan.baseline.dailyBoundaryTimezone, "Asia/Tokyo");
  assert.match(plan.baseline.dailyAggregationRule, /Convert each hourly valid_time from UTC to Asia\/Tokyo first/);
  assert.match(plan.baseline.precipitationHandling, /de-accumulated hourly values/);
  assert.match(plan.baseline.precipitationHandling, /Convert each hourly value to millimetres/);
  assert.ok(plan.normalizedDailyRecord.requiredFields.includes("localDayTimezone"));
});
