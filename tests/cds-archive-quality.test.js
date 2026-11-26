import test from "node:test";
import assert from "node:assert/strict";
import { cdsLeadBucket, inspectCdsArchiveQuality } from "../assets/js/cds-archive-quality.js";

const record = (overrides = {}) => ({
  source: "CDS", dataset: "seasonal-original-single-levels", model: "ECMWF-SEAS5.1",
  modelVersion: "System 51", countryCode: "JP", courseId: "okinawa-a",
  initializationTime: "2016-01-01T00:00:00Z", validTime: "2016-01-18T00:00:00Z",
  leadHours: 408, ensembleMember: 0, variable: "2t", value: 12,
  unit: "degC", temporalSemantics: "instantaneous",
  verificationSource: "ERA5-reanalysis-proxy", spatialMethod: "nearest-grid-point",
  nearestGridDistanceKm: 42, qualityStatus: "unverified", ...overrides
});
const batch = (batchId, records) => ({
  manifest: { batchId, normalizedRecordCount: records.length },
  records
});

test("lead buckets preserve the four long-range verification bands", () => {
  assert.equal(cdsLeadBucket(408), "D17-D30");
  assert.equal(cdsLeadBucket(744), "D31-D46");
  assert.equal(cdsLeadBucket(1128), "D47-D60");
  assert.equal(cdsLeadBucket(1464), "D61-D90");
  assert.equal(cdsLeadBucket(24), "D0-D16");
  assert.equal(cdsLeadBucket(2200), "D90+");
});

test("coverage groups records by country, variable and lead bucket", () => {
  const report = inspectCdsArchiveQuality([
    batch("a", [record(), record({ variable: "10u", leadHours: 744 })]),
    batch("b", [record({ countryCode: "KR", leadHours: 1128 })])
  ]);
  assert.equal(report.summary.totalRecords, 3);
  assert.equal(report.summary.coverageGroupCount, 3);
  assert.equal(report.coverage.find(x => x.countryCode === "KR").records, 1);
});

test("duplicate batches and records are surfaced as hard errors", () => {
  const item = batch("duplicate", [record()]);
  const report = inspectCdsArchiveQuality([item, item]);
  assert.equal(report.summary.status, "quality-review-required");
  assert.ok(report.findings.some(x => x.code === "duplicate-batch-id"));
  assert.ok(report.findings.some(x => x.code === "duplicate-record-key"));
});

test("unknown semantics and invalid time ordering are rejected in quality report", () => {
  const report = inspectCdsArchiveQuality([batch("bad", [
    record({ temporalSemantics: "unknown" }),
    record({ courseId: "later", initializationTime: "2016-02-01T00:00:00Z", validTime: "2016-01-01T00:00:00Z" })
  ])]);
  assert.equal(report.summary.unknownTemporalSemantics, 1);
  assert.equal(report.summary.invalidTimePairs, 1);
  assert.equal(report.summary.status, "quality-review-required");
});

test("missing provenance is a warning, not an invented verification pass", () => {
  const report = inspectCdsArchiveQuality([batch("warn", [
    record({ verificationSource: null, nearestGridDistanceKm: null })
  ])]);
  assert.equal(report.summary.status, "structurally-valid-unverified");
  assert.ok(report.findings.some(x => x.code === "missing-spatial-distance"));
  assert.ok(report.findings.some(x => x.code === "missing-verification-source"));
});

test("malformed batch record collection is reported", () => {
  const report = inspectCdsArchiveQuality([{ manifest: { batchId: "x" }, records: null }]);
  assert.ok(report.findings.some(x => x.code === "invalid-record-array"));
});
