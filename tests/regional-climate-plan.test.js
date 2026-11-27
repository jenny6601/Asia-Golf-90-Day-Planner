import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mapping = JSON.parse(readFileSync(new URL("../config/global/era5-land-grid-points-japan.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json", import.meta.url), "utf8"));
const japan = registry.countries.find(country => country.countryCode === "JP");
const mainland = japan.subregions.filter(item => !item.id.startsWith("JP-OKI-"));

test("ERA5-Land mapping contains exactly one expected grid point for each Japan mainland subregion", () => {
  assert.equal(mapping.subregionCount, 19);
  assert.equal(mapping.points.length, 19);
  const mappedMainland = mapping.points.filter(point => !point.subregionId.startsWith("JP-OKI-"));
  const mappedOkinawa = mapping.points.filter(point => point.subregionId.startsWith("JP-OKI-"));
  assert.deepEqual(mappedMainland.map(point => point.subregionId).sort(), mainland.map(item => item.id).sort());
  assert.equal(mappedOkinawa.length, 3);
  assert.equal(new Set(mapping.points.map(point => point.subregionId)).size, 19);
});

test("mapped points preserve canonical representative coordinates and use nearest 0.1 degree grid", () => {
  for (const point of mapping.points) {
    const source = japan.subregions.find(item => item.id === point.subregionId);
    const sourceCoordinates = source.candidateCoordinates ?? point.representativePoint;
    assert.equal(point.representativePoint.latitude, sourceCoordinates.latitude);
    assert.equal(point.representativePoint.longitude, sourceCoordinates.longitude);
    assert.equal(point.era5LandGridPoint.latitude, Math.round(sourceCoordinates.latitude * 10) / 10);
    assert.equal(point.era5LandGridPoint.longitude, Math.round(sourceCoordinates.longitude * 10) / 10);
    assert.ok(point.gridDistanceKm >= 0 && point.gridDistanceKm < 8, point.subregionId);
    assert.equal(point.timezone, "Asia/Tokyo");
  }
});

test("grid mapping is explicitly provisional until actual CDS coordinates are read back", () => {
  assert.equal(mapping.status, "expected-grid-mapping-for-19-japan-subregions-not-yet-verified-by-CDS-download");
  assert.match(mapping.caveat, /actual latitude\/longitude coordinates/);
  assert.equal(mapping.gridResolutionDegrees, 0.1);
});

test("ERA5-Land daily aggregation uses Japan local dates and documented units", () => {
  const plan = JSON.parse(readFileSync(new URL("../config/global/regional-climate-data-plan.json", import.meta.url), "utf8"));
  assert.equal(plan.baseline.dailyBoundaryTimezone, "Asia/Tokyo");
  assert.match(plan.baseline.dailyAggregationRule, /Convert each hourly UTC valid_time to Asia\/Tokyo/);
  assert.match(plan.baseline.precipitationHandling, /de-accumulated hourly values/);
  assert.match(plan.baseline.precipitationHandling, /Convert each hourly value to millimetres/);
  assert.ok(plan.normalizedDailyRecord.requiredFields.includes("localDayTimezone"));
});
