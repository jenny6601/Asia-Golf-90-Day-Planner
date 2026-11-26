/**
 * Guarded calibration primitives. Fit only on an earlier training period;
 * evaluate only on a later untouched holdout. No global correction is applied
 * when sample support is insufficient.
 */
import { validatePairedForecastSample } from "./shared-forecast-verification.js";

export function splitByValidTime(samples, cutoff) {
  const t = Date.parse(cutoff);
  if (!Number.isFinite(t)) throw new TypeError("A valid ISO holdout cutoff is required");
  const rows = Array.isArray(samples) ? samples.filter(s => validatePairedForecastSample(s).valid) : [];
  return {
    training: rows.filter(s => Date.parse(s.validTime) < t),
    holdout: rows.filter(s => Date.parse(s.validTime) >= t)
  };
}

export function fitAdditiveBiasCorrection(trainingSamples, { minSamples = 100 } = {}) {
  const rows = (Array.isArray(trainingSamples) ? trainingSamples : [])
    .filter(s => validatePairedForecastSample(s).valid);
  if (rows.length < minSamples) return {
    status: "insufficient-training-data", sampleCount: rows.length,
    requiredSamples: minSamples, correction: null
  };
  const errors = rows.map(s => s.verificationValue - s.forecastValue);
  const correction = errors.reduce((a, b) => a + b, 0) / errors.length;
  return { status: "fitted", sampleCount: rows.length, correction };
}

export function applyAdditiveBiasCorrection(forecastValue, fittedModel) {
  if (!Number.isFinite(forecastValue) || fittedModel?.status !== "fitted" ||
      !Number.isFinite(fittedModel.correction)) return null;
  return forecastValue + fittedModel.correction;
}

/** Compare only later holdout rows. Correction is accepted only if MAE improves. */
export function evaluateCorrectionOnHoldout(holdoutSamples, fittedModel) {
  const rows = (Array.isArray(holdoutSamples) ? holdoutSamples : [])
    .filter(s => validatePairedForecastSample(s).valid);
  if (fittedModel?.status !== "fitted" || !rows.length) return {
    status: "not-evaluable", sampleCount: rows.length, rawMae: null,
    correctedMae: null, improvement: null, adopt: false
  };
  let raw = 0, corrected = 0;
  for (const s of rows) {
    raw += Math.abs(s.forecastValue - s.verificationValue);
    corrected += Math.abs(applyAdditiveBiasCorrection(s.forecastValue, fittedModel) - s.verificationValue);
  }
  const rawMae = raw / rows.length, correctedMae = corrected / rows.length;
  return {
    status: "evaluated", sampleCount: rows.length, rawMae, correctedMae,
    improvement: rawMae - correctedMae, adopt: correctedMae < rawMae
  };
}
