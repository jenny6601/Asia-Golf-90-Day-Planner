import test from "node:test";
import assert from "node:assert/strict";
import { classifyLeadDay, buildMaturityEvidence } from "../assets/js/forecast-maturity.js";

test("lead-day boundaries follow the 1-16, 17-18, 19-46 and 47-90 policy", () => {
  assert.equal(classifyLeadDay(0).band, "D01-D16");
  assert.equal(classifyLeadDay(15).band, "D01-D16");
  assert.equal(classifyLeadDay(16).band, "D17-D18");
  assert.equal(classifyLeadDay(17).band, "D17-D18");
  assert.equal(classifyLeadDay(18).band, "D19-D46");
  assert.equal(classifyLeadDay(45).band, "D19-D46");
  assert.equal(classifyLeadDay(46).band, "D47-D90");
  assert.equal(classifyLeadDay(89).band, "D47-D90");
  assert.equal(classifyLeadDay(90).band, "OUT-OF-RANGE");
});

test("near-term missing forecast is not replaced by historical climate", () => {
  const result = buildMaturityEvidence({
    date: "2027-01-10", today: "2027-01-01",
    historical: { rainFrequency: 65, rainMean: 4, sampleYears: 10 }
  });
  assert.equal(result.sourceType, "short-range-daily-forecast");
  // Jan 10 is within the 16-day forecast band, so no actual daily forecast means unavailable.
  assert.equal(result.status, "insufficient-data");
  assert.equal(result.weatherEvidence, null);
  assert.equal(result.historicalReference, null);
});

test("short-range daily forecast keeps forecast values and field coverage", () => {
  const result = buildMaturityEvidence({
    date: "2027-01-05", today: "2027-01-01",
    forecastDaily: { precipitation_probability_max: 40, precipitation_sum: 1.2,
      temperature_2m_max: 22, temperature_2m_min: 16, weather_code: 2 }
  });
  assert.equal(result.status, "available");
  assert.equal(result.weatherEvidence.rainProbabilityPct, 40);
  assert.equal(result.confidence.value, 1);
  assert.equal(result.historicalReference, null);
});

test("transition days expose weekly trend only and no daily rain score", () => {
  const result = buildMaturityEvidence({
    date: "2027-01-18", today: "2027-01-01",
    weeklyTrend: { precipitationEfi: 0.4, wetAnomalyChance: 55 }
  });
  assert.equal(result.maturity, "transition-weekly-signal-only");
  assert.equal(result.status, "trend-only");
  assert.equal(result.weatherEvidence, null);
  assert.equal(result.rankingInputEligible, false);
});

test("long-range outlook does not label adjusted wet-day frequency as rain probability", () => {
  const result = buildMaturityEvidence({
    date: "2027-02-01", today: "2027-01-01",
    seasonalOutlook: { rainChanceEstimate: 48, rainEstimate: 2.3,
      highEstimate: 21, lowEstimate: 14, confidence: "偏低" },
    historical: { rainFrequency: 42, rainMean: 1.9, highMean: 20, lowMean: 13, sampleYears: 10 }
  });
  assert.equal(result.band, "D19-D46");
  assert.equal(result.sourceType, "seasonal-plus-historical-climate-estimate");
  assert.equal(result.weatherEvidence.rainProbabilityPct, null);
  assert.equal(result.weatherEvidence.wetDayFrequencyEstimatePct, 48);
  assert.match(result.weatherEvidence.wetDayFrequencyLabel, /不是該日降雨機率/);
  assert.equal(result.rankingInputEligible, false);
});

test("seasonal period keeps historical confidence separate from rainfall risk", () => {
  const result = buildMaturityEvidence({
    date: "2027-03-15", today: "2027-01-01",
    historical: { rainFrequency: 35, rainMean: 1.4, sampleYears: 28 }
  });
  assert.equal(result.band, "D47-D90");
  assert.equal(result.weatherEvidence.wetDayFrequencyEstimatePct, 35);
  assert.deepEqual(result.confidence, { sampleYears: 28, label: "historical-sample-coverage" });
});

test("rejects invalid dates and negative lead times", () => {
  assert.throws(() => classifyLeadDay(-1), RangeError);
  assert.throws(() => buildMaturityEvidence({ date: "bad", today: "2027-01-01" }), TypeError);
  assert.throws(() => buildMaturityEvidence({ date: "2026-12-31", today: "2027-01-01" }), RangeError);
});
