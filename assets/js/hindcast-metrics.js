/**
 * Forecast verification metrics for Okinawa golf-weather hindcasts.
 * Inputs are paired forecast/verification samples for the SAME valid time.
 */
const finite = x => typeof x === "number" && Number.isFinite(x);
export function pairedNumericSamples(samples, forecastKey, observedKey) {
  return (Array.isArray(samples) ? samples : []).filter(s => finite(s?.[forecastKey]) && finite(s?.[observedKey]));
}
export function regressionMetrics(samples, forecastKey, observedKey) {
  const pairs = pairedNumericSamples(samples, forecastKey, observedKey);
  if (!pairs.length) return { n: 0, mae: null, bias: null, rmse: null };
  let abs = 0, bias = 0, sq = 0;
  for (const s of pairs) { const e = s[forecastKey] - s[observedKey]; abs += Math.abs(e); bias += e; sq += e * e; }
  return { n: pairs.length, mae: abs / pairs.length, bias: bias / pairs.length, rmse: Math.sqrt(sq / pairs.length) };
}
export function brierScore(samples, probabilityKey, observedEventKey) {
  const pairs = (Array.isArray(samples) ? samples : []).filter(s => finite(s?.[probabilityKey]) && s[probabilityKey] >= 0 && s[probabilityKey] <= 100 && typeof s?.[observedEventKey] === "boolean");
  if (!pairs.length) return { n: 0, score: null };
  return { n: pairs.length, score: pairs.reduce((a, s) => a + (s[probabilityKey] / 100 - (s[observedEventKey] ? 1 : 0)) ** 2, 0) / pairs.length };
}
export function categoricalRainMetrics(samples, forecastEventKey, observedEventKey) {
  const pairs = (Array.isArray(samples) ? samples : []).filter(s => typeof s?.[forecastEventKey] === "boolean" && typeof s?.[observedEventKey] === "boolean");
  let hit = 0, miss = 0, falseAlarm = 0, correctNegative = 0;
  for (const s of pairs) { const f = s[forecastEventKey], o = s[observedEventKey]; if (f && o) hit++; else if (!f && o) miss++; else if (f && !o) falseAlarm++; else correctNegative++; }
  const div = (a, b) => b ? a / b : null;
  return { n: pairs.length, hit, miss, falseAlarm, correctNegative, pod: div(hit, hit + miss), far: div(falseAlarm, hit + falseAlarm), csi: div(hit, hit + miss + falseAlarm) };
}
export function leadTimeBand(hours) {
  if (!finite(hours) || hours < 0) return "unknown";
  if (hours <= 72) return "1–3天";
  if (hours <= 168) return "4–7天";
  if (hours <= 384) return "8–16天";
  return ">16天";
}
export function groupByLeadTime(samples) {
  const groups = {};
  for (const sample of Array.isArray(samples) ? samples : []) { const band = leadTimeBand(sample?.leadHours); (groups[band] ??= []).push(sample); }
  return groups;
}
