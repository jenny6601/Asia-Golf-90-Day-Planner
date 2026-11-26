/**
 * Isolated CDS hindcast adapter.
 *
 * This module is deliberately not imported by app.js or the live forecast path.
 * It normalizes archived CDS records for later verification only.
 */
export const CDS_INTEGRATION_DEFAULTS = Object.freeze({
  enabled: false,
  role: "historical-verification-only",
  affectsLiveForecast: false,
  mayApplyBiasCorrection: false
});

const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);

export function cdsIntegrationEnabled(config = {}) {
  return config.enabled === true &&
    config.affectsLiveForecast === false &&
    config.mayApplyBiasCorrection === false;
}

export function normalizeCdsHindcastRecord(record = {}) {
  const normalized = {
    source: "CDS",
    dataset: record.dataset ?? null,
    model: record.model ?? "ECMWF-SEAS5.1",
    modelVersion: record.modelVersion ?? "System 51",
    countryCode: record.countryCode ?? null,
    courseId: record.courseId ?? null,
    initializationTime: record.initializationTime ?? null,
    validTime: record.validTime ?? null,
    leadHours: isFiniteNumber(record.leadHours) ? record.leadHours : null,
    ensembleMember: Number.isInteger(record.ensembleMember) ? record.ensembleMember : null,
    variable: record.variable ?? null,
    value: isFiniteNumber(record.value) ? record.value : null,
    unit: record.unit ?? null,
    temporalSemantics: record.temporalSemantics ?? "unknown",
    verificationSource: record.verificationSource ?? null,
    spatialMethod: record.spatialMethod ?? "nearest-grid-point",
    nearestGridDistanceKm: isFiniteNumber(record.nearestGridDistanceKm) ? record.nearestGridDistanceKm : null,
    qualityStatus: "unverified"
  };
  const required = ["dataset","countryCode","initializationTime","validTime","leadHours","variable","value","unit"];
  const missing = required.filter(key => normalized[key] === null || normalized[key] === "");
  if (normalized.initializationTime && normalized.validTime &&
      Date.parse(normalized.initializationTime) > Date.parse(normalized.validTime)) missing.push("time_order");
  if (normalized.temporalSemantics === "unknown") missing.push("temporalSemantics");
  return { record: normalized, valid: missing.length === 0, missing };
}

export function cdsRecordsForVerification(records, config = {}) {
  if (!cdsIntegrationEnabled(config)) {
    return { status: "disabled", records: [], accepted: 0, rejected: 0 };
  }
  const results = (Array.isArray(records) ? records : []).map(normalizeCdsHindcastRecord);
  return {
    status: "staging-only",
    records: results.filter(item => item.valid).map(item => item.record),
    accepted: results.filter(item => item.valid).length,
    rejected: results.filter(item => !item.valid).length
  };
}
