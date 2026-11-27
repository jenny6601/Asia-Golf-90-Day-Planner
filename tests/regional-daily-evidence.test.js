import test from "node:test";
import assert from "node:assert/strict";
import { buildRegionalDailyEvidence } from "../assets/js/regional-daily-evidence.js";

const base = {
  subregionId: "JP-KNT-NORTH",
  timezone: "Asia/Tokyo",
  representativePoint: { latitude: 36.7, longitude: 140.0 },
  today: "2026-11-27"
};

test("creates one regional record with traceable geography and maturity", () => {
  const row = buildRegionalDailyEvidence({
    ...base,
    date: "2026-12-02",
    forecastDaily: {
      rainProbabilityPct: 35, rainfallAmountMm: 0.8,
      temperatureHighC: 17, temperatureLowC: 9, weatherCode: 2
    },
    provenance: { forecast: { sourceId: "OPEN_METEO_FORECAST", retrievedAt: "2026-11-27T01:00:00Z" } }
  });
  assert.equal(row.recordType, "regional-daily-climate-evidence");
  assert.equal(row.geography.subregionId, "JP-KNT-NORTH");
  assert.equal(row.geography.representativePoint.purpose, "regional-climate-representative-point");
  assert.equal(row.forecastMaturity.band, "D01-D16");
  assert.equal(row.weatherMetrics.rainProbabilityPct, 35);
  assert.equal(row.weatherMetrics.wetDayFrequencyEstimatePct, null);
  assert.equal(row.provenance.forecast.sourceId, "OPEN_METEO_FORECAST");
  assert.equal(row.decisionPolicy.rankingInputEligible, false);
});

test("does not substitute historical climate when short-range forecast is missing", () => {
  const row = buildRegionalDailyEvidence({
    ...base,
    date: "2026-12-05",
    historical: { rainFrequency: 65, rainMean: 4, sampleYears: 20 }
  });
  assert.equal(row.forecastMaturity.band, "D01-D16");
  assert.equal(row.forecastMaturity.status, "insufficient-data");
  assert.equal(row.weatherMetrics.rainProbabilityPct, null);
  assert.equal(row.evidence.historicalClimate, null);
  assert.equal(row.quality.hasDailyForecast, false);
});

test("transition band exposes weekly trend only", () => {
  const row = buildRegionalDailyEvidence({
    ...base,
    date: "2026-12-14",
    weeklyTrend: { precipitationEfi: 0.5, wetAnomalyChance: 65 }
  });
  assert.equal(row.forecastMaturity.band, "D17-D18");
  assert.equal(row.evidence.dailyForecast, null);
  assert.deepEqual(row.evidence.weeklyTrend, { precipitationEfi: 0.5, wetAnomalyChance: 65 });
  assert.equal(row.weatherMetrics.rainProbabilityPct, null);
  assert.equal(row.weatherMetrics.wetDayFrequencyEstimatePct, null);
});

test("long-range records keep wet-day frequency distinct from daily rain probability", () => {
  const row = buildRegionalDailyEvidence({
    ...base,
    date: "2026-12-20",
    seasonalOutlook: { rainChanceEstimate: 48, rainEstimate: 2.2, highEstimate: 19, lowEstimate: 12, confidenceScore: 42, confidence: "偏低" },
    historical: { rainFrequency: 40, rainMean: 1.8, highMean: 18, lowMean: 11, sampleYears: 24 }
  });
  assert.equal(row.forecastMaturity.band, "D19-D46");
  assert.equal(row.weatherMetrics.rainProbabilityPct, null);
  assert.equal(row.weatherMetrics.wetDayFrequencyEstimatePct, 48);
  assert.match(row.weatherMetrics.wetDayFrequencyMeaning, /不是該日降雨機率/);
  assert.equal(row.weatherMetrics.rainfallAmountEstimateMm, 2.2);
  assert.equal(row.confidence, "偏低");
  assert.equal(row.quality.historicalFrequencyIsNotDailyRainProbability, true);
  assert.equal(row.decisionPolicy.rankingInputEligible, false);
});

test("D47-D90 remains a climate outlook and preserves null metrics", () => {
  const row = buildRegionalDailyEvidence({
    ...base,
    date: "2027-02-10",
    historical: { rainFrequency: 32, sampleYears: 28 }
  });
  assert.equal(row.forecastMaturity.band, "D47-D90");
  assert.equal(row.weatherMetrics.wetDayFrequencyEstimatePct, 32);
  assert.equal(row.weatherMetrics.rainfallAmountEstimateMm, null);
  assert.equal(row.weatherMetrics.temperatureHighC, null);
  assert.equal(row.weatherMetrics.rainProbabilityPct, null);
  assert.equal(row.quality.missingValuesRemainNull, true);
});

test("rejects missing region identity, invalid representative point, and malformed dates", () => {
  assert.throws(() => buildRegionalDailyEvidence({ ...base, subregionId: "", date: "2026-12-01" }), /subregionId/);
  assert.throws(() => buildRegionalDailyEvidence({ ...base, representativePoint: { latitude: 100, longitude: 140 }, date: "2026-12-01" }), /representativePoint/);
  assert.throws(() => buildRegionalDailyEvidence({ ...base, date: "not-a-date" }), /valid YYYY-MM-DD/);
  assert.throws(() => buildRegionalDailyEvidence({ ...base, date: "2026-02-31" }), /valid YYYY-MM-DD/);
});
