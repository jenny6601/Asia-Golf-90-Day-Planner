import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const spec = JSON.parse(fs.readFileSync(new URL("../config/global/long-range-forecast-strategy.json", import.meta.url), "utf8"));

test("long-range engine covers eight countries and 80 regional points", () => {
  assert.deepEqual(spec.scope.countries, ["JP","KR","CN","VN","TH","MY","SG","ID"]);
  assert.equal(spec.scope.expectedSubregions, 80);
});

test("D01-D16 and App UI remain explicitly unchanged", () => {
  assert.equal(spec.scope.appBoundary.d01D16Unchanged, true);
  assert.equal(spec.scope.appBoundary.uiChangesAllowed, false);
  assert.equal(spec.scope.appBoundary.interactionChangesAllowed, false);
  assert.equal(spec.operations.realTimeObservationIngestion, false);
  assert.equal(spec.operations.stationCandidateDiscovery, false);
});

test("long-range horizons use weekly ECMWF and monthly C3S signals", () => {
  const d19 = spec.horizons.find(x => x.id === "D19_D46");
  const d47 = spec.horizons.find(x => x.id === "D47_D90");
  assert.deepEqual(d19.leadDays, [19,46]);
  assert.equal(d19.primarySource, "ECMWF_IFS_SUBSEASONAL");
  assert.equal(d19.temporalResolution, "weekly");
  assert.deepEqual(d47.leadDays, [47,90]);
  assert.equal(d47.primarySource, "C3S_SEASONAL_MULTI_SYSTEM");
  assert.equal(d47.temporalResolution, "monthly and seasonal aggregates");
});

test("daily numeric probabilities are blocked until hindcast calibration", () => {
  assert.match(spec.decisionMethod.probabilityPolicy, /until matching hindcast validation/);
  assert.equal(spec.decisionMethod.calibration.noArbitraryNumericWeights, true);
  assert.equal(spec.decisionMethod.calibration.noConfidenceUpgradeWithoutHindcastEvidence, true);
});

test("trip decision unit is a seven-day window with three rounds", () => {
  assert.equal(spec.decisionMethod.unit, "one rolling seven-day destination window");
  assert.equal(spec.decisionMethod.tripPattern, "five days four nights with three golf rounds");
});
