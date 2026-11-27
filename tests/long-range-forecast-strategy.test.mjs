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

test("D17-D18 are a daily-estimate transition band, not a trend-only gap", () => {
  const transition = spec.horizons.find(x => x.id === "D17_D18");
  assert.deepEqual(transition.leadDays, [17,18]);
  assert.equal(transition.primarySource, "ECMWF_IFS_SUBSEASONAL");
  assert.equal(transition.secondarySource, "ERA5_LAND_CLIMATOLOGY");
  assert.match(transition.dailyOutput, /each local date D17 and D18/);
  assert.equal(spec.operations.d17D18DailyOutputRequired, true);
  assert.match(spec.operations.d17D18Source, /no D16 carry-forward/);
});

test("daily estimated weather records are required for every D17-D90 date", () => {
  assert.equal(spec.operations.dailyOutputRequired, true);
  assert.equal(spec.dailyOutputContract.granularity, "one record per local calendar date per regional representative point");
  assert.ok(spec.dailyOutputContract.requiredDailyFields.includes("precipitationAmountEstimateMm"));
  assert.ok(spec.dailyOutputContract.requiredDailyFields.includes("temperatureMinEstimateC"));
  assert.ok(spec.dailyOutputContract.requiredDailyFields.includes("dailyGolfConditionsAdvisory"));
});

test("daily estimates preserve sequence coherence and uncertainty", () => {
  assert.match(spec.dailyOutputContract.dailyVsPeriodSignalRule, /not get copied as identical values/);
  assert.ok(spec.dailyOutputContract.generationMethod.some(x => x.includes("multi-day weather persistence")));
  assert.ok(spec.dailyOutputContract.generationMethod.some(x => x.includes("D17-D18")));
  assert.ok(spec.dailyOutputContract.validation.requiredLeadBands.includes("D17-D18"));
  assert.ok(spec.dailyOutputContract.generationMethod.some(x => x.includes("prediction intervals")));
});

test("the App recommendation is advisory and the user makes the final choice", () => {
  assert.equal(spec.dailyOutputContract.userDecisionPolicy.advisoryOnly, true);
  assert.equal(spec.dailyOutputContract.userDecisionPolicy.automaticDateSelection, false);
  assert.equal(spec.dailyOutputContract.userDecisionPolicy.automaticBooking, false);
  assert.equal(spec.dailyOutputContract.userDecisionPolicy.rankingMustNotHideDailyRecords, true);
});

test("daily numeric probabilities require hindcast calibration", () => {
  assert.match(spec.dailyOutputContract.numericProbabilityPolicy, /only after date-level hindcast calibration/);
  assert.equal(spec.decisionMethod.calibration.noArbitraryNumericWeights, true);
  assert.equal(spec.decisionMethod.calibration.noConfidenceUpgradeWithoutHindcastEvidence, true);
});

test("trip context is seven days and three golf rounds", () => {
  assert.equal(spec.decisionMethod.unit, "one daily record per date, plus rolling seven-day trip-window analysis");
  assert.equal(spec.decisionMethod.tripPattern, "five days four nights with three golf rounds");
});
