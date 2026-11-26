/**
 * Country- and provider-neutral verification utilities for D17-D90 forecasts.
 * Only forecasts paired to an independent verification value at the same valid
 * time are scored. ERA5/reanalysis must be labelled as a verification proxy,
 * never as an issued forecast or station observation.
 */
const finite = value => typeof value === "number" && Number.isFinite(value);
export const LONG_RANGE_LEAD_BANDS = Object.freeze([
  { id: "D17_30", label: "D17–30", minDay: 17, maxDay: 30 },
  { id: "D31_46", label: "D31–46", minDay: 31, maxDay: 46 },
  { id: "D47_60", label: "D47–60", minDay: 47, maxDay: 60 },
  { id: "D61_90", label: "D61–90", minDay: 61, maxDay: 90 }
]);
export function longRangeLeadBand(leadDays) {
  if (!finite(leadDays) || leadDays < 0) return "unknown";
  return LONG_RANGE_LEAD_BANDS.find(b => leadDays >= b.minDay && leadDays <= b.maxDay)?.id ?? (leadDays <= 16 ? "D1_16" : "OUT_OF_RANGE");
}
/**
 * Canonical sample shape:
 * {countryCode,courseId,provider,model,modelVersion,initializationTime,
 *  validTime,leadDays,variable,forecastValue,verificationValue,
 *  verificationSource,temporalResolution,unit}
 */
export function validatePairedForecastSample(sample) {
  const requiredStrings = ["countryCode","provider","model","initializationTime","validTime","variable","verificationSource","unit"];
  const missing = requiredStrings.filter(key => typeof sample?.[key] !== "string" || !sample[key].trim());
  if (!finite(sample?.leadDays) || sample.leadDays < 0) missing.push("leadDays");
  if (!finite(sample?.forecastValue)) missing.push("forecastValue");
  if (!finite(sample?.verificationValue)) missing.push("verificationValue");
  if (sample?.initializationTime && sample?.validTime &&
      Date.parse(sample.initializationTime) > Date.parse(sample.validTime)) missing.push("time_order");
  return { valid: missing.length === 0, missing };
}
export function pairedForecastMetrics(samples) {
  const usable = (Array.isArray(samples) ? samples : []).filter(s => validatePairedForecastSample(s).valid);
  if (!usable.length) return { n: 0, mae: null, bias: null, rmse: null, coverage: 0 };
  let abs=0,bias=0,sq=0;
  for (const s of usable) { const e=s.forecastValue-s.verificationValue; abs+=Math.abs(e); bias+=e; sq+=e*e; }
  return { n:usable.length, mae:abs/usable.length, bias:bias/usable.length, rmse:Math.sqrt(sq/usable.length), coverage:usable.length/(Array.isArray(samples)?samples.length:0) };
}
export function summarizeLongRangeVerification(samples, filters = {}) {
  const rows = (Array.isArray(samples) ? samples : []).filter(s =>
    (!filters.countryCode || s.countryCode === filters.countryCode) &&
    (!filters.variable || s.variable === filters.variable) &&
    (!filters.provider || s.provider === filters.provider));
  const result = {};
  for (const band of LONG_RANGE_LEAD_BANDS) {
    const group = rows.filter(s => longRangeLeadBand(s.leadDays) === band.id);
    result[band.id] = { label: band.label, ...pairedForecastMetrics(group) };
  }
  return { sampleCount: rows.length, bands: result };
}
/**
 * Brier score is only valid when probability is an explicitly calibrated
 * probability and the verification event is observed for the same valid time.
 * Ensemble member fraction must not be passed as calibrated probability.
 */
export function calibratedRainBrierScore(samples) {
  const usable = (Array.isArray(samples) ? samples : []).filter(s =>
    s?.probabilityType === "calibrated" &&
    finite(s.probability) && s.probability >= 0 && s.probability <= 1 &&
    typeof s.observedRainEvent === "boolean" &&
    typeof s.verificationSource === "string" && s.verificationSource.length > 0);
  if (!usable.length) return { n: 0, score: null, status: "no-calibrated-probabilities" };
  const score=usable.reduce((sum,s)=>sum+(s.probability-(s.observedRainEvent?1:0))**2,0)/usable.length;
  return { n:usable.length, score, status:"scored" };
}
export function ensembleSpreadSummary(samples) {
  const rows=(Array.isArray(samples)?samples:[]).filter(s=>Array.isArray(s.members)&&s.members.length>=2&&s.members.every(finite));
  if(!rows.length)return {n:0,meanSpread:null};
  const spreads=rows.map(s=>{
    const mean=s.members.reduce((a,b)=>a+b,0)/s.members.length;
    return Math.sqrt(s.members.reduce((a,b)=>a+(b-mean)**2,0)/s.members.length);
  });
  return {n:spreads.length,meanSpread:spreads.reduce((a,b)=>a+b,0)/spreads.length};
}
