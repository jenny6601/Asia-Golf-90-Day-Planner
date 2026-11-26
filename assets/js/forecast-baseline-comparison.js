import { validatePairedForecastSample } from "./shared-forecast-verification.js";
const mae = (rows, valueKey) => rows.length
  ? rows.reduce((sum, row) => sum + Math.abs(row[valueKey] - row.verificationValue), 0) / rows.length
  : null;

/**
 * Holdout-only three-way comparison. Each row must carry an independently
 * generated climatologyValue; missing baseline values are excluded consistently.
 */
export function compareForecastBaselines(holdoutRows, correctionModel) {
  const rows = (Array.isArray(holdoutRows) ? holdoutRows : []).filter(row =>
    validatePairedForecastSample(row).valid && Number.isFinite(row.climatologyValue));
  if (!rows.length) return {
    status: "no-comparable-holdout-data", n: 0,
    rawMae: null, correctedMae: null, climatologyMae: null, best: null
  };
  const scored = rows.map(row => ({
    ...row,
    correctedValue: correctionModel?.status === "fitted" &&
      Number.isFinite(correctionModel.correction)
      ? row.forecastValue + correctionModel.correction : null
  }));
  const rawMae = mae(scored, "forecastValue");
  const correctedRows = scored.filter(row => Number.isFinite(row.correctedValue));
  const correctedMae = correctedRows.length === scored.length ? mae(scored, "correctedValue") : null;
  const climatologyMae = mae(scored, "climatologyValue");
  const candidates = [{ name: "raw", score: rawMae }, { name: "climatology", score: climatologyMae }];
  if (correctedMae !== null) candidates.push({ name: "corrected", score: correctedMae });
  candidates.sort((a, b) => a.score - b.score);
  return {
    status: "evaluated", n: scored.length, rawMae, correctedMae,
    climatologyMae, best: candidates[0].name,
    correctionBeatsRaw: correctedMae !== null && correctedMae < rawMae,
    correctionBeatsClimatology: correctedMae !== null && correctedMae < climatologyMae
  };
}
