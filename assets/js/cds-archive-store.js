/**
 * Append-only CDS archive contract.
 *
 * This module prepares immutable batch manifests and deterministic record keys.
 * It does not write to a database, browser storage, or production forecast path.
 * A future backend can implement the same contract without changing consumers.
 */
import { normalizeCdsHindcastRecord } from "./cds-hindcast-adapter.js";

const requiredBatch = ["batchId", "retrievedAt", "dataset", "model", "modelVersion", "requestScope"];

export function cdsRecordKey(record) {
  const fields = [
    record.dataset, record.model, record.modelVersion, record.countryCode,
    record.courseId ?? "", record.initializationTime, record.validTime,
    record.leadHours, record.ensembleMember ?? "", record.variable,
    record.spatialMethod ?? "", record.nearestGridDistanceKm ?? ""
  ];
  return fields.map(value => String(value ?? "").trim()).join("|");
}

export function buildCdsArchiveBatch({ batch, records } = {}) {
  const missingBatchFields = requiredBatch.filter(key => {
    const value = batch?.[key];
    return value === undefined || value === null || value === "";
  });
  if (missingBatchFields.length) {
    return { status: "rejected", reason: "incomplete-batch-metadata", missing: missingBatchFields };
  }
  if (!Array.isArray(records) || records.length === 0) {
    return { status: "rejected", reason: "empty-batch", missing: [] };
  }

  const normalized = records.map(input => normalizeCdsHindcastRecord(input));
  const rejected = normalized.filter(item => !item.valid);
  if (rejected.length) {
    return {
      status: "rejected",
      reason: "records-failed-quality-gate",
      acceptedCount: normalized.length - rejected.length,
      rejectedCount: rejected.length,
      rejectedRecords: rejected.map(item => item.missing)
    };
  }

  const keys = normalized.map(item => cdsRecordKey(item.record));
  const uniqueKeys = new Set(keys);
  if (uniqueKeys.size !== keys.length) {
    return { status: "rejected", reason: "duplicate-record-keys", recordCount: records.length };
  }

  return {
    status: "staged-append-only",
    manifest: {
      schemaVersion: "1.0.0",
      batchId: String(batch.batchId),
      retrievedAt: String(batch.retrievedAt),
      dataset: String(batch.dataset),
      model: String(batch.model),
      modelVersion: String(batch.modelVersion),
      requestScope: batch.requestScope,
      rawArchive: batch.rawArchive ?? null,
      rawSha256: batch.rawSha256 ?? null,
      normalizedRecordCount: normalized.length,
      recordKeyAlgorithm: "ordered-fields-v1",
      writePolicy: "append-only-no-overwrite",
      productionForecastImpact: false
    },
    records: normalized.map(item => item.record)
  };
}

export function inspectCdsArchiveBatches(batches = []) {
  const ids = (Array.isArray(batches) ? batches : []).map(item => item?.manifest?.batchId).filter(Boolean);
  const seen = new Set();
  const duplicates = ids.filter(id => seen.has(id) || !seen.add(id));
  return {
    batchCount: ids.length,
    uniqueBatchCount: new Set(ids).size,
    duplicateBatchIds: [...new Set(duplicates)],
    appendOnlySafe: duplicates.length === 0
  };
}
