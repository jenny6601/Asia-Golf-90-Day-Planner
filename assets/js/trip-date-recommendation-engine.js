/**
 * Five-day / three-round Okinawa golf-trip date recommendation engine.
 * Pure backend module; no network access and no UI dependencies.
 * Inputs are normalized source-audited regional rain-risk signals (0..100).
 * Missing signals are never imputed. Stability risk: 0=stable, 100=unstable.
 *
 * day = { date, regions: { north|central|south: {
 *   forecast?, ec46?, seas5?, historical?, stability?
 * } } }
 * Each signal = { riskScore: 0..100, coverage: 0..1, ...source metadata }
 */
const REGIONS = ["north", "central", "south"];
const SOURCE_WEIGHTS = Object.freeze({
  short: Object.freeze({ forecast: 0.62, historical: 0.23, stability: 0.15 }),
  ec46: Object.freeze({ ec46: 0.45, seas5: 0.15, historical: 0.25, stability: 0.15 }),
  seas5: Object.freeze({ seas5: 0.45, historical: 0.35, stability: 0.20 })
});
const MISSING_DATA_PENALTY = 25;
const WINDOW_DAYS = 5;
const GOLF_ROUNDS = 3;
const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const isIsoDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value + "T00:00:00Z"))
  && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const dayNumber = value => Date.parse(value + "T00:00:00Z") / 86400000;
const leadDays = (asOf, date) => Math.round(dayNumber(date) - dayNumber(asOf));
const horizonFor = lead => lead <= 16 ? "short" : lead <= 46 ? "ec46" : "seas5";

function validateSignal(signal, source, date) {
  if (signal == null) return null;
  if (!isFiniteNumber(signal.riskScore) || signal.riskScore < 0 || signal.riskScore > 100)
    throw new TypeError(source + " riskScore must be 0..100 (" + date + ")");
  if (!isFiniteNumber(signal.coverage) || signal.coverage < 0 || signal.coverage > 1)
    throw new TypeError(source + " coverage must be 0..1 (" + date + ")");
  if (source === "historical" && signal.sampleYears != null
      && (!Number.isInteger(signal.sampleYears) || signal.sampleYears < 0))
    throw new TypeError("historical sampleYears must be a non-negative integer (" + date + ")");
  return signal;
}

function weightedRegionSignal(regionData, weights, date) {
  let weightedRisk = 0, weightedCoverage = 0, availableWeight = 0;
  const usedSources = [], missingSources = [];
  for (const [source, weight] of Object.entries(weights)) {
    const signal = validateSignal(regionData?.[source], source, date);
    if (!signal || signal.coverage <= 0) { missingSources.push(source); continue; }
    weightedRisk += signal.riskScore * weight;
    weightedCoverage += signal.coverage * weight;
    availableWeight += weight;
    usedSources.push(source);
  }
  if (availableWeight === 0)
    return { riskScore: null, evidenceCoverage: 0, usedSources, missingSources };
  const rawRiskScore = weightedRisk / availableWeight;
  const evidenceCoverage = availableWeight * (weightedCoverage / availableWeight);
  return {
    riskScore: clamp(rawRiskScore + MISSING_DATA_PENALTY * (1 - evidenceCoverage)),
    rawRiskScore, evidenceCoverage, usedSources, missingSources
  };
}

function evaluateDay(day, asOf) {
  if (!isIsoDate(day?.date)) throw new TypeError("Invalid day date");
  const lead = leadDays(asOf, day.date), horizon = horizonFor(lead);
  const regionResults = REGIONS.map(region => ({
    region, ...weightedRegionSignal(day.regions?.[region], SOURCE_WEIGHTS[horizon], day.date)
  }));
  const available = regionResults.filter(x => x.riskScore !== null);
  if (!available.length) return {
    date: day.date, leadDays: lead, horizon, riskScore: null, evidenceCoverage: 0,
    regions: regionResults, golfEligible: false, reason: "三個區域均無有效降雨訊號"
  };
  const regionRisk = available.reduce((sum, x) => sum + x.riskScore, 0) / available.length;
  const regionCoverage = regionResults.reduce((sum, x) => sum + x.evidenceCoverage, 0) / REGIONS.length;
  const missingRegionCount = REGIONS.length - available.length;
  const riskScore = clamp(regionRisk * (available.length / REGIONS.length)
    + 100 * (missingRegionCount / REGIONS.length)
    + MISSING_DATA_PENALTY * (missingRegionCount / REGIONS.length) * 0.25);
  return {
    date: day.date, leadDays: lead, horizon, riskScore, evidenceCoverage: regionCoverage,
    availableRegions: available.length, regions: regionResults,
    golfEligible: available.length === REGIONS.length && regionCoverage >= 0.45,
    reason: available.length === REGIONS.length ? "三區均有有效訊號" : "區域資料不完整，推薦資格降低"
  };
}

function summarizeWindow(windowDays) {
  const usable = windowDays.filter(x => x.riskScore !== null);
  if (usable.length < GOLF_ROUNDS) return null;
  // Match the existing planner convention: arrival day, three consecutive golf
  // days in the middle, then departure day. Never move a golf round onto travel days.
  const golfDays = windowDays.slice(1, 4);
  const usableGolfDays = golfDays.filter(x => x.riskScore !== null);
  const golfRisk = usableGolfDays.length
    ? usableGolfDays.reduce((sum, x) => sum + x.riskScore, 0) / usableGolfDays.length
    : null;
  const allDayRisk = usable.reduce((sum, x) => sum + x.riskScore, 0) / usable.length;
  const dataCoverage = windowDays.reduce((sum, x) => sum + x.evidenceCoverage, 0) / WINDOW_DAYS;
  const completeDays = windowDays.filter(x => x.golfEligible).length;
  const completeGolfDays = golfDays.filter(x => x.golfEligible).length;
  const missingDays = WINDOW_DAYS - usable.length;
  const missingGolfDays = GOLF_ROUNDS - usableGolfDays.length;
  // Unknown golf-day weather is a ranking penalty only; its weather risk stays null.
  const rankingGolfRisk = golfRisk === null ? 100 : golfRisk;
  const finalScore = clamp(rankingGolfRisk * 0.85 + allDayRisk * 0.15
    + (1 - dataCoverage) * 20 + missingDays * 8 + missingGolfDays * 20
    + (GOLF_ROUNDS - completeGolfDays) * 3);
  const confidence = dataCoverage >= 0.85 && completeGolfDays === 3 && completeDays >= 4 ? "high"
    : dataCoverage >= 0.60 && completeGolfDays >= 2 ? "medium" : "low";
  return {
    startDate: windowDays[0].date, endDate: windowDays[WINDOW_DAYS - 1].date,
    score: Number(finalScore.toFixed(2)),
    golfRiskScore: golfRisk === null || missingGolfDays > 0 ? null : Number(golfRisk.toFixed(2)),
    knownGolfRiskScore: golfRisk === null ? null : Number(golfRisk.toFixed(2)),
    fiveDayRiskScore: Number(allDayRisk.toFixed(2)),
    dataCoverage: Number(dataCoverage.toFixed(3)), completeDays, completeGolfDays, confidence,
    recommendedGolfDates: golfDays.map(x => ({
      date: x.date, riskScore: x.riskScore === null ? null : Number(x.riskScore.toFixed(2)),
      evidenceCoverage: Number(x.evidenceCoverage.toFixed(3)),
      horizon: x.horizon, eligible: x.golfEligible
    })),
    reasons: [
      "三場固定打球日：" + golfDays.map(x => x.date).join("、"),
      missingGolfDays ? "其中 " + missingGolfDays + " 個打球日缺少有效降雨資料，已降低推薦資格" : "三個連續打球日均有有效降雨評估",
      golfRisk === null ? "三場降雨風險無法完整計算" : "已知打球日平均降雨風險指數 " + golfRisk.toFixed(1) + "/100",
      "五天資料覆蓋率 " + Math.round(dataCoverage * 100) + "%",
      "完整三區資料日 " + completeDays + "/5",
      confidence === "low" ? "資料不足，推薦順位下調" : "資料完整度：" + confidence
    ],
    daily: windowDays
  };
}

export function recommendGolfTripDates(input, options = {}) {
  const { asOf, days } = input || {};
  const horizonDays = options.horizonDays ?? input?.horizonDays ?? 90;
  const alternateCount = options.alternateCount ?? 5;
  if (!isIsoDate(asOf)) throw new TypeError("asOf must be YYYY-MM-DD");
  if (!Array.isArray(days)) throw new TypeError("days must be an array");
  if (!Number.isInteger(horizonDays) || horizonDays < 5 || horizonDays > 90)
    throw new RangeError("horizonDays must be 5..90");
  if (!Number.isInteger(alternateCount) || alternateCount < 0)
    throw new RangeError("alternateCount must be non-negative");
  const byDate = new Map();
  for (const day of days) {
    if (!isIsoDate(day?.date)) throw new TypeError("Every input day must have an ISO date");
    if (byDate.has(day.date)) throw new Error("Duplicate date: " + day.date);
    byDate.set(day.date, day);
  }
  const evaluated = [];
  for (let offset = 1; offset <= horizonDays; offset++) {
    const date = new Date((dayNumber(asOf) + offset) * 86400000).toISOString().slice(0, 10);
    const sourceDay = byDate.get(date);
    evaluated.push(sourceDay ? evaluateDay(sourceDay, asOf) : {
      date, leadDays: offset, horizon: horizonFor(offset), riskScore: null,
      evidenceCoverage: 0, golfEligible: false, reason: "缺少該日資料"
    });
  }
  const windows = [];
  for (let i = 0; i <= evaluated.length - WINDOW_DAYS; i++) {
    const summary = summarizeWindow(evaluated.slice(i, i + WINDOW_DAYS));
    if (summary) windows.push(summary);
  }
  windows.sort((a, b) => a.score - b.score
    || b.dataCoverage - a.dataCoverage || a.startDate.localeCompare(b.startDate));
  const ranked = windows.map((window, index) => ({ rank: index + 1, ...window }));
  return {
    model: "okinawa-five-day-three-round-v1", asOf, horizonDays,
    tripLengthDays: WINDOW_DAYS, golfRounds: GOLF_ROUNDS,
    priority: "minimize rainfall risk on three golf days",
    scoring: {
      lowerIsBetter: true, horizonWeights: SOURCE_WEIGHTS,
      missingDataPenalty: MISSING_DATA_PENALTY,
      windowFormula: "0.85 * mean(middle 3 golf-day risk) + 0.15 * mean(5 daily risk) + missing-data penalties"
    },
    evaluatedDays: evaluated.length, dailyAssessment: evaluated, validWindows: ranked.length,
    topThree: ranked.slice(0, 3), alternates: ranked.slice(3, 3 + alternateCount),
    excludedWindows: evaluated.length - WINDOW_DAYS + 1 - ranked.length,
    limitations: [
      "Risk scores must be normalized by audited source adapters; EFI, anomalies and historical observations are not treated as probabilities.",
      "EC46, SEAS5 and historical signals are used only when supplied with valid coverage; missing values are never imputed.",
      "North, central and south are treated as three regional signals, not six independent course observations.",
      "The middle three consecutive dates are the golf days; arrival and departure days are not counted as rounds. Booking availability is not evaluated."
    ]
  };
}

export const TRIP_DATE_ENGINE_CONFIG = Object.freeze({
  regions: REGIONS, sourceWeights: SOURCE_WEIGHTS,
  windowDays: WINDOW_DAYS, golfRounds: GOLF_ROUNDS,
  missingDataPenalty: MISSING_DATA_PENALTY
});
