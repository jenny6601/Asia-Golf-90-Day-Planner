import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plan = JSON.parse(readFileSync(new URL("../config/global/regional-climate-data-plan.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../config/global/weather-subregions.json", import.meta.url), "utf8"));
const japan = registry.countries.find(country => country.countryCode === "JP");

test("Japan regional climate plan targets exactly the 16 mainland subregions", () => {
  const mainland = japan.subregions.filter(item => !item.id.startsWith("JP-OKI-"));
  assert.equal(mainland.length, 16);
  assert.deepEqual([...plan.geography.mainlandSubregionIds].sort(), mainland.map(item => item.id).sort());
});

test("each mainland subregion has one eligible regional climate point and no per-course expansion", () => {
  const mainland = japan.subregions.filter(item => plan.geography.mainlandSubregionIds.includes(item.id));
  assert.equal(mainland.length, 16);
  for (const item of mainland) {
    assert.equal(item.coordinateQuality.regionalClimateEligible, true, item.id);
    assert.equal(item.coordinateQuality.weatherPointEligible, true, item.id);
    assert.ok(Number.isFinite(item.candidateCoordinates.latitude), item.id);
    assert.ok(Number.isFinite(item.candidateCoordinates.longitude), item.id);
    assert.equal(item.candidateCoordinates.timezone, "Asia/Tokyo", item.id);
  }
  assert.match(plan.geography.pointPolicy, /Do not create per-course weather records/);
});

test("baseline uses a defined 1991-2020 daily climate reference and explicit completeness gates", () => {
  assert.equal(plan.baseline.startDate, "1991-01-01");
  assert.equal(plan.baseline.endDate, "2020-12-31");
  assert.equal(plan.baseline.temporalResolution, "daily");
  assert.equal(plan.baseline.minimumValidYears, 24);
  assert.equal(plan.baseline.minimumDailyCompleteness, 0.9);
  assert.match(plan.baseline.missingDataPolicy, /never convert missing precipitation to zero/);
});

test("ERA5 reanalysis and JMA observations remain separate source classes", () => {
  const era5 = plan.sourceStrategy.find(source => source.sourceId === "ERA5_HOURLY_SINGLE_LEVELS");
  const jma = plan.sourceStrategy.find(source => source.sourceId === "JMA_STATION_OBSERVATIONS");
  assert.ok(era5 && jma);
  assert.equal(era5.role, "primary-gridded-historical-baseline");
  assert.equal(era5.dataset, "reanalysis-era5-land");
  assert.equal(era5.spatialResolutionDegrees, 0.1);
  assert.ok(era5.documentationUrl.startsWith("https://"));
  assert.equal(jma.role, "independent-observation-cross-check");
  assert.ok(plan.sourceStrategy.some(source => source.sourceId === "JMA_CLIMATE_NORMALS_1991_2020"));
  assert.match(era5.limitations, /not an independent rain-gauge observation/);
  assert.equal(plan.activationPolicy.climateBaselineEnabled, false);
  assert.equal(plan.activationPolicy.forecastEnabled, false);
});

test("derived metrics preserve wet-day threshold, heavy-rain thresholds and nullable data", () => {
  assert.equal(plan.derivedMetrics.precipitation.wetDayThresholdMm, 1);
  assert.deepEqual(plan.derivedMetrics.precipitation.heavyRainFrequencyThresholdsMm, [10, 30]);
  assert.equal(plan.normalizedDailyRecord.nullableMetrics, true);
  assert.ok(plan.normalizedDailyRecord.requiredFields.includes("sourceId"));
  assert.ok(plan.normalizedDailyRecord.requiredFields.includes("gridDistanceKm"));
});
