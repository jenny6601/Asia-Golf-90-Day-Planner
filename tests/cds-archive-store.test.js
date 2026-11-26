import test from "node:test";
import assert from "node:assert/strict";
import {
  cdsRecordKey,
  buildCdsArchiveBatch,
  inspectCdsArchiveBatches
} from "../assets/js/cds-archive-store.js";

const batch = {
  batchId: "cds-pilot-20160101-v1",
  retrievedAt: "2026-11-26T11:00:00Z",
  dataset: "seasonal-original-single-levels",
  model: "ECMWF-SEAS5.1",
  modelVersion: "System 51",
  requestScope: { initialization: "2016-01-01", leads: [408, 414, 420, 426] },
  rawArchive: "seas51-pilot.grib",
  rawSha256: "abc123"
};
const sample = {
  dataset: "seasonal-original-single-levels", countryCode: "JP",
  initializationTime: "2016-01-01T00:00:00Z", validTime: "2016-01-18T00:00:00Z",
  leadHours: 408, ensembleMember: 0, variable: "2t", value: 12.5,
  unit: "degC", temporalSemantics: "instantaneous", verificationSource: "ERA5-reanalysis-proxy",
  nearestGridDistanceKm: 42
};

test("archive batch requires complete provenance metadata", () => {
  assert.equal(buildCdsArchiveBatch({ batch: {}, records: [sample] }).reason, "incomplete-batch-metadata");
});

test("archive batch stages complete records append-only without production impact", () => {
  const result = buildCdsArchiveBatch({ batch, records: [sample] });
  assert.equal(result.status, "staged-append-only");
  assert.equal(result.manifest.writePolicy, "append-only-no-overwrite");
  assert.equal(result.manifest.productionForecastImpact, false);
  assert.equal(result.manifest.normalizedRecordCount, 1);
});

test("archive batch rejects unknown temporal semantics and does not store them", () => {
  const result = buildCdsArchiveBatch({ batch, records: [{ ...sample, variable: "tp", temporalSemantics: "unknown" }] });
  assert.equal(result.status, "rejected");
  assert.equal(result.reason, "records-failed-quality-gate");
});

test("archive batch rejects duplicate deterministic record keys", () => {
  const result = buildCdsArchiveBatch({ batch, records: [sample, sample] });
  assert.equal(result.status, "rejected");
  assert.equal(result.reason, "duplicate-record-keys");
  assert.equal(cdsRecordKey(sample), cdsRecordKey({ ...sample }));
});

test("archive inventory detects repeated batch identifiers", () => {
  const item = buildCdsArchiveBatch({ batch, records: [sample] });
  const result = inspectCdsArchiveBatches([item, item]);
  assert.equal(result.appendOnlySafe, false);
  assert.deepEqual(result.duplicateBatchIds, [batch.batchId]);
});

test("empty batch is not accepted", () => {
  assert.equal(buildCdsArchiveBatch({ batch, records: [] }).reason, "empty-batch");
});
