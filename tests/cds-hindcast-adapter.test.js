import test from "node:test";
import assert from "node:assert/strict";
import {
  CDS_INTEGRATION_DEFAULTS,
  cdsIntegrationEnabled,
  normalizeCdsHindcastRecord,
  cdsRecordsForVerification
} from "../assets/js/cds-hindcast-adapter.js";

test("CDS is disabled by default and cannot affect live forecast", () => {
  assert.equal(CDS_INTEGRATION_DEFAULTS.enabled, false);
  assert.equal(cdsIntegrationEnabled(CDS_INTEGRATION_DEFAULTS), false);
  assert.equal(cdsIntegrationEnabled({ enabled: true, affectsLiveForecast: true, mayApplyBiasCorrection: false }), false);
});

test("CDS adapter accepts complete, semantically labelled records for staging", () => {
  const result = normalizeCdsHindcastRecord({
    dataset: "seasonal-original-single-levels",
    countryCode: "JP",
    initializationTime: "2016-01-01T00:00:00Z",
    validTime: "2016-01-18T00:00:00Z",
    leadHours: 408,
    ensembleMember: 0,
    variable: "2t",
    value: 12.5,
    unit: "degC",
    temporalSemantics: "instantaneous",
    verificationSource: "ERA5-reanalysis-proxy",
    nearestGridDistanceKm: 42
  });
  assert.equal(result.valid, true);
  assert.equal(result.record.source, "CDS");
  assert.equal(result.record.qualityStatus, "unverified");
});

test("unknown precipitation semantics are rejected from verification staging", () => {
  const result = normalizeCdsHindcastRecord({
    dataset: "seasonal-original-single-levels",
    countryCode: "JP",
    initializationTime: "2016-01-01T00:00:00Z",
    validTime: "2016-01-18T00:00:00Z",
    leadHours: 408,
    variable: "tp",
    value: 0.001,
    unit: "m"
  });
  assert.equal(result.valid, false);
  assert.ok(result.missing.includes("temporalSemantics"));
});

test("disabled CDS integration returns no records and does not throw", () => {
  const result = cdsRecordsForVerification([{ value: 1 }]);
  assert.deepEqual(result, { status: "disabled", records: [], accepted: 0, rejected: 0 });
});

test("enabled CDS integration only stages valid records", () => {
  const config = { enabled: true, affectsLiveForecast: false, mayApplyBiasCorrection: false };
  const result = cdsRecordsForVerification([
    {
      dataset: "seasonal-original-single-levels", countryCode: "JP",
      initializationTime: "2016-01-01T00:00:00Z", validTime: "2016-01-18T00:00:00Z",
      leadHours: 408, variable: "2t", value: 12, unit: "degC",
      temporalSemantics: "instantaneous"
    },
    { value: 2 }
  ], config);
  assert.equal(result.status, "staging-only");
  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 1);
});
