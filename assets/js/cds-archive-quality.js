/**
 * Read-only CDS archive quality and coverage reporting.
 * Consumes staged/saved batch envelopes; performs no storage writes.
 */
import { cdsRecordKey } from "./cds-archive-store.js";

export const CDS_QUALITY_STATUSES = Object.freeze([
  "unverified", "ready-for-pairing", "rejected"
]);

export function cdsLeadBucket(leadHours) {
  if (!Number.isFinite(leadHours) || leadHours < 0) return "unknown";
  const days = leadHours / 24;
  if (days >= 17 && days <= 30) return "D17-D30";
  if (days >= 31 && days <= 46) return "D31-D46";
  if (days >= 47 && days <= 60) return "D47-D60";
  if (days >= 61 && days <= 90) return "D61-D90";
  return days < 17 ? "D0-D16" : "D90+";
}

function isDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

export function inspectCdsArchiveQuality(batches = []) {
  const safeBatches = Array.isArray(batches) ? batches : [];
  const batchIds = new Set();
  const recordKeys = new Set();
  const duplicateBatchIds = [];
  const duplicateRecordKeys = [];
  const coverage = {};
  const findings = [];
  let totalRecords = 0;
  let rejectedRecords = 0;
  let missingSpatialDistance = 0;
  let unknownTemporalSemantics = 0;
  let invalidTimePairs = 0;
  let missingVerificationSource = 0;

  for (const batch of safeBatches) {
    const manifest = batch?.manifest ?? {};
    const id = manifest.batchId;
    if (!id) findings.push({ code: "missing-batch-id", severity: "error" });
    else if (batchIds.has(id)) duplicateBatchIds.push(id);
    else batchIds.add(id);

    if (!Array.isArray(batch?.records)) {
      findings.push({ code: "invalid-record-array", severity: "error", batchId: id ?? null });
      continue;
    }
    if (Number.isFinite(manifest.normalizedRecordCount) &&
        manifest.normalizedRecordCount !== batch.records.length) {
      findings.push({ code: "manifest-record-count-mismatch", severity: "error", batchId: id });
    }

    for (const record of batch.records) {
      totalRecords++;
      const key = cdsRecordKey(record);
      if (recordKeys.has(key)) duplicateRecordKeys.push(key);
      else recordKeys.add(key);

      if (record.temporalSemantics === "unknown" || !record.temporalSemantics) unknownTemporalSemantics++;
      if (!isDate(record.initializationTime) || !isDate(record.validTime) ||
          (isDate(record.initializationTime) && isDate(record.validTime) &&
           Date.parse(record.initializationTime) > Date.parse(record.validTime))) invalidTimePairs++;
      if (record.nearestGridDistanceKm === null || record.nearestGridDistanceKm === undefined) missingSpatialDistance++;
      if (!record.verificationSource) missingVerificationSource++;
      if (record.qualityStatus === "rejected") rejectedRecords++;

      const country = record.countryCode ?? "UNKNOWN";
      const variable = record.variable ?? "UNKNOWN";
      const lead = cdsLeadBucket(Number(record.leadHours));
      const keyCoverage = [country, variable, lead].join("|");
      if (!coverage[keyCoverage]) {
        coverage[keyCoverage] = { countryCode: country, variable, leadBucket: lead, records: 0, batches: new Set() };
      }
      coverage[keyCoverage].records++;
      if (id) coverage[keyCoverage].batches.add(id);
    }
  }

  if (duplicateBatchIds.length) findings.push({ code: "duplicate-batch-id", severity: "error", count: duplicateBatchIds.length });
  if (duplicateRecordKeys.length) findings.push({ code: "duplicate-record-key", severity: "error", count: duplicateRecordKeys.length });
  if (unknownTemporalSemantics) findings.push({ code: "unknown-temporal-semantics", severity: "error", count: unknownTemporalSemantics });
  if (invalidTimePairs) findings.push({ code: "invalid-time-pair", severity: "error", count: invalidTimePairs });
  if (missingSpatialDistance) findings.push({ code: "missing-spatial-distance", severity: "warning", count: missingSpatialDistance });
  if (missingVerificationSource) findings.push({ code: "missing-verification-source", severity: "warning", count: missingVerificationSource });

  const coverageRows = Object.values(coverage)
    .map(item => ({ ...item, batches: item.batches.size }))
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode) ||
      a.variable.localeCompare(b.variable) || a.leadBucket.localeCompare(b.leadBucket));

  const hardErrors = findings.filter(item => item.severity === "error").length;
  return {
    summary: {
      batchCount: safeBatches.length,
      uniqueBatchCount: batchIds.size,
      totalRecords,
      uniqueRecordCount: recordKeys.size,
      duplicateBatchCount: new Set(duplicateBatchIds).size,
      duplicateRecordCount: new Set(duplicateRecordKeys).size,
      rejectedRecords,
      missingSpatialDistance,
      unknownTemporalSemantics,
      invalidTimePairs,
      missingVerificationSource,
      coverageGroupCount: coverageRows.length,
      status: hardErrors ? "quality-review-required" : "structurally-valid-unverified"
    },
    coverage: coverageRows,
    findings
  };
}
