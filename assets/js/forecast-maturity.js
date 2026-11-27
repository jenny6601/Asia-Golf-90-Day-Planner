/**
 * Forecast-maturity adapter for the 90-day planner.
 *
 * Keeps forecast evidence, historical climate priors, and confidence metadata
 * separate. It does not calculate or alter the formal V1 suitability weights.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const finite = value => typeof value === "number" && Number.isFinite(value);

function validDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function classifyLeadDay(leadDaysAhead) {
  if (!Number.isInteger(leadDaysAhead) || leadDaysAhead < 0) {
    throw new RangeError("leadDaysAhead must be a non-negative integer");
  }
  const leadDayNumber = leadDaysAhead + 1;
  if (leadDaysAhead <= 15) {
    return { leadDaysAhead, leadDayNumber, band: "D01-D16", maturity: "short-range-daily-forecast",
      dailyForecastEligible: true, description: "短期逐日預報" };
  }
  if (leadDaysAhead <= 17) {
    return { leadDaysAhead, leadDayNumber, band: "D17-D18", maturity: "transition-weekly-signal-only",
      dailyForecastEligible: false, description: "過渡期：僅接受週尺度訊號，不建立逐日降雨預報" };
  }
  if (leadDaysAhead <= 45) {
    return { leadDaysAhead, leadDayNumber, band: "D19-D46", maturity: "extended-range-seasonal-trend",
      dailyForecastEligible: false, description: "延伸期：歷史同期基準加季節趨勢估計，非確定性逐日預報" };
  }
  if (leadDaysAhead <= 89) {
    return { leadDaysAhead, leadDayNumber, band: "D47-D90", maturity: "seasonal-climatology-outlook",
      dailyForecastEligible: false, description: "季節期：季節機率與歷史氣候參考，不提供逐日降雨機率" };
  }
  return { leadDaysAhead, leadDayNumber, band: "OUT-OF-RANGE", maturity: "outside-planning-horizon",
    dailyForecastEligible: false, description: "超出90天規劃範圍" };
}

function dateDifference(date, today) {
  return Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000);
}

function forecastEvidence(row) {
  if (!row || typeof row !== "object") return null;
  const values = {
    weatherCode: finite(row.weatherCode) ? row.weatherCode : finite(row.weather_code) ? row.weather_code : null,
    rainProbabilityPct: finite(row.rainProbabilityPct) ? row.rainProbabilityPct :
      finite(row.precipitation_probability_max) ? row.precipitation_probability_max : null,
    rainfallAmountMm: finite(row.rainfallAmountMm) ? row.rainfallAmountMm :
      finite(row.precipitation_sum) ? row.precipitation_sum : null,
    temperatureHighC: finite(row.temperatureHighC) ? row.temperatureHighC :
      finite(row.temperature_2m_max) ? row.temperature_2m_max : null,
    temperatureLowC: finite(row.temperatureLowC) ? row.temperatureLowC :
      finite(row.temperature_2m_min) ? row.temperature_2m_min : null
  };
  const present = Object.values(values).filter(finite).length;
  return present ? { ...values, fieldCoverage: present / Object.keys(values).length } : null;
}

export function buildMaturityEvidence({ date, today, forecastDaily = null, weeklyTrend = null,
  seasonalOutlook = null, historical = null } = {}) {
  if (!validDate(date) || !validDate(today)) throw new TypeError("date and today must be valid YYYY-MM-DD dates");
  const leadDaysAhead = dateDifference(date, today);
  if (leadDaysAhead < 0) throw new RangeError("date must not precede today");
  const maturity = classifyLeadDay(leadDaysAhead);
  const forecast = forecastEvidence(forecastDaily);

  if (maturity.band === "D01-D16") {
    return {
      date, ...maturity,
      sourceType: forecast ? "short-range-daily-forecast" : "missing-short-range-forecast",
      status: forecast ? "available" : "insufficient-data",
      weatherEvidence: forecast,
      confidence: { type: "forecast-field-coverage", value: forecast ? forecast.fieldCoverage : null },
      historicalReference: null,
      rankingInputEligible: false
    };
  }

  if (maturity.band === "D17-D18") {
    const available = weeklyTrend && typeof weeklyTrend === "object" &&
      Object.values(weeklyTrend).some(value => finite(value));
    return {
      date, ...maturity,
      sourceType: available ? "weekly-trend-only" : "transition-data-unavailable",
      status: available ? "trend-only" : "insufficient-data",
      weatherEvidence: null,
      weeklyTrend: available ? { ...weeklyTrend } : null,
      confidence: { type: "trend-source-availability", value: available ? "available-not-daily-confidence" : null },
      historicalReference: null,
      rankingInputEligible: false
    };
  }

  const outlook = seasonalOutlook && typeof seasonalOutlook === "object" ? seasonalOutlook : null;
  const hist = historical && typeof historical === "object" ? historical : null;
  const hasOutlook = !!outlook && Object.values(outlook).some(value => finite(value));
  const hasHistory = !!hist && Object.values(hist).some(value => finite(value));
  const sourceType = hasOutlook && hasHistory ? "seasonal-plus-historical-climate-estimate" :
    hasOutlook ? "seasonal-signal-without-daily-baseline" :
    hasHistory ? "historical-climate-reference-only" : "insufficient-long-range-data";
  const wetFrequency = hasOutlook && finite(outlook.rainChanceEstimate) ? outlook.rainChanceEstimate :
    hasHistory && finite(hist.rainFrequency) ? hist.rainFrequency : null;
  const rainAmount = hasOutlook && finite(outlook.rainEstimate) ? outlook.rainEstimate :
    hasHistory && finite(hist.rainMean) ? hist.rainMean : null;
  const confidence = hasOutlook && outlook.confidence != null ? outlook.confidence :
    hasHistory && finite(hist.sampleYears) ? { sampleYears: hist.sampleYears, label: "historical-sample-coverage" } : null;
  return {
    date, ...maturity,
    sourceType,
    status: sourceType === "insufficient-long-range-data" ? "insufficient-data" : "climate-estimate-only",
    weatherEvidence: {
      wetDayFrequencyEstimatePct: wetFrequency,
      wetDayFrequencyLabel: "歷史雨日頻率或經季節訊號調整的估計；不是該日降雨機率",
      rainfallAmountEstimateMm: rainAmount,
      temperatureHighEstimateC: hasOutlook && finite(outlook.highEstimate) ? outlook.highEstimate :
        hasHistory && finite(hist.highMean) ? hist.highMean : null,
      temperatureLowEstimateC: hasOutlook && finite(outlook.lowEstimate) ? outlook.lowEstimate :
        hasHistory && finite(hist.lowMean) ? hist.lowMean : null,
      rainProbabilityPct: null
    },
    confidence,
    historicalReference: hasHistory ? {
      sampleYears: finite(hist.sampleYears) ? hist.sampleYears : null,
      rainFrequencyPct: finite(hist.rainFrequency) ? hist.rainFrequency : null,
      rainMeanMm: finite(hist.rainMean) ? hist.rainMean : null
    } : null,
    rankingInputEligible: false
  };
}
