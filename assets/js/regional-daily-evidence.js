/**
 * Canonical regional daily evidence contract for Asia Golf Climate.
 *
 * This module is deliberately independent from app.js and all presentation
 * code. It normalizes evidence for downstream climate engines without
 * changing the existing App flow or V1 ranking weights.
 */
import { buildMaturityEvidence } from "./forecast-maturity.js";

const finite = value => typeof value === "number" && Number.isFinite(value);
const validPoint = point => point && finite(point.latitude) && finite(point.longitude) &&
  point.latitude >= -90 && point.latitude <= 90 &&
  point.longitude >= -180 && point.longitude <= 180;
const validDate = value => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T12:00:00Z"));
const pickFinite = (object, keys) => Object.fromEntries(
  keys.map(key => [key, finite(object?.[key]) ? object[key] : null])
);

const HISTORICAL_KEYS = [
  "sampleYears", "rainSampleYears", "temperatureSampleYears",
  "rainFrequency", "rainMean", "rainP10", "rainP90",
  "highMean", "lowMean", "highStd", "lowStd"
];
const SEASONAL_KEYS = [
  "rainChanceEstimate", "rainEstimate", "highEstimate", "lowEstimate",
  "confidenceScore", "precipitationEfi", "precipitationAnomaly",
  "temperatureAnomaly"
];

function normalizeHistorical(value) {
  if (!value || typeof value !== "object") return null;
  const metrics = pickFinite(value, HISTORICAL_KEYS);
  return Object.values(metrics).some(finite) ? metrics : null;
}
function normalizeSeasonal(value) {
  if (!value || typeof value !== "object") return null;
  const metrics = pickFinite(value, SEASONAL_KEYS);
  return Object.values(metrics).some(finite) ? metrics : null;
}
function normalizeWeekly(value) {
  if (!value || typeof value !== "object") return null;
  const metrics = Object.fromEntries(Object.entries(value).filter(([, v]) =>
    finite(v) || typeof v === "string" || typeof v === "boolean"));
  return Object.keys(metrics).length ? metrics : null;
}

/**
 * Build one normalized evidence record for one regional representative point
 * and one local calendar date. It never creates per-course weather records.
 */
export function buildRegionalDailyEvidence({
  subregionId,
  timezone = "Asia/Tokyo",
  representativePoint,
  date,
  today,
  forecastDaily = null,
  weeklyTrend = null,
  seasonalOutlook = null,
  historical = null,
  provenance = {}
} = {}) {
  if (typeof subregionId !== "string" || !subregionId.trim()) {
    throw new TypeError("subregionId is required");
  }
  if (typeof timezone !== "string" || !timezone.trim()) {
    throw new TypeError("timezone is required");
  }
  if (!validPoint(representativePoint)) {
    throw new TypeError("representativePoint must contain valid latitude and longitude");
  }
  if (!validDate(date) || !validDate(today)) {
    throw new TypeError("date and today must be valid YYYY-MM-DD dates");
  }
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    throw new TypeError("provenance must be an object");
  }

  const normalizedHistorical = normalizeHistorical(historical);
  const normalizedSeasonal = normalizeSeasonal(seasonalOutlook);
  const normalizedWeekly = normalizeWeekly(weeklyTrend);
  const maturity = buildMaturityEvidence({
    date,
    today,
    forecastDaily,
    weeklyTrend: normalizedWeekly,
    seasonalOutlook: normalizedSeasonal,
    historical: normalizedHistorical
  });

  const rain = maturity.weatherEvidence || {};
  const shortRange = maturity.band === "D01-D16";
  const transition = maturity.band === "D17-D18";
  const longRange = maturity.band === "D19-D46" || maturity.band === "D47-D90";

  return {
    schemaVersion: 1,
    recordType: "regional-daily-climate-evidence",
    geography: {
      subregionId: subregionId.trim(),
      timezone,
      representativePoint: {
        latitude: representativePoint.latitude,
        longitude: representativePoint.longitude,
        purpose: "regional-climate-representative-point"
      }
    },
    validDate: date,
    leadDaysAhead: maturity.leadDaysAhead,
    leadDay: maturity.leadDayNumber,
    forecastMaturity: {
      band: maturity.band,
      class: maturity.maturity,
      description: maturity.description,
      status: maturity.status
    },
    sourceType: maturity.sourceType,
    evidence: {
      dailyForecast: shortRange ? maturity.weatherEvidence : null,
      weeklyTrend: transition ? maturity.weeklyTrend : null,
      seasonalOutlook: longRange ? normalizedSeasonal : null,
      historicalClimate: longRange ? maturity.historicalReference : null
    },
    weatherMetrics: {
      rainProbabilityPct: shortRange && finite(rain.rainProbabilityPct) ? rain.rainProbabilityPct : null,
      wetDayFrequencyEstimatePct: longRange && finite(rain.wetDayFrequencyEstimatePct)
        ? rain.wetDayFrequencyEstimatePct : null,
      wetDayFrequencyMeaning: longRange ? rain.wetDayFrequencyLabel : null,
      rainfallAmountEstimateMm: longRange && finite(rain.rainfallAmountEstimateMm)
        ? rain.rainfallAmountEstimateMm : null,
      temperatureHighC: shortRange && finite(rain.temperatureHighC) ? rain.temperatureHighC :
        longRange && finite(rain.temperatureHighEstimateC) ? rain.temperatureHighEstimateC : null,
      temperatureLowC: shortRange && finite(rain.temperatureLowC) ? rain.temperatureLowC :
        longRange && finite(rain.temperatureLowEstimateC) ? rain.temperatureLowEstimateC : null
    },
    confidence: maturity.confidence,
    provenance: {
      forecast: provenance.forecast ?? null,
      weeklyTrend: provenance.weeklyTrend ?? null,
      seasonal: provenance.seasonal ?? null,
      historical: provenance.historical ?? null
    },
    quality: {
      hasDailyForecast: shortRange && maturity.status === "available",
      hasWeeklyTrend: transition && maturity.status === "trend-only",
      hasSeasonalSignal: longRange && !!normalizedSeasonal,
      hasHistoricalBaseline: longRange && !!normalizedHistorical,
      missingValuesRemainNull: true,
      historicalFrequencyIsNotDailyRainProbability: true
    },
    decisionPolicy: {
      rankingInputEligible: false,
      mayAlterFormalV1Weights: false,
      note: "Evidence contract only; downstream ranking activation requires independent validation."
    }
  };
}
