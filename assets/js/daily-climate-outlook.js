/**
 * Daily climate outlook engine for forecast days D17–D90 (day 1 is today).
 *
 * Combines ERA5 same-calendar-day normals with weekly/monthly seasonal anomalies.
 * It deliberately does not claim deterministic daily weather or calibrated rain
 * probabilities. The rainChanceEstimate is a climatological wet-day frequency
 * adjusted by a broad seasonal signal and is labelled as an estimate.
 */
const finite = v => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mean = values => {
  const xs = values.filter(finite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};
const dateLead = (date, today) =>
  Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000);
const addDays = (date, n) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monthKey = date => date.slice(0, 7);

function indexedSignal(section, date) {
  const times = section?.time || [];
  let index = -1;
  for (let i = 0; i < times.length; i++) {
    const key = String(times[i]).slice(0, 10);
    if (key <= date) index = i;
    else break;
  }
  if (index < 0) return null;
  const signalDate = String(times[index]).slice(0, 10);
  const age = Math.floor((Date.parse(date + "T12:00:00Z") - Date.parse(signalDate + "T12:00:00Z")) / 86400000);
  return age >= 0 && age < 7 ? { section, index, signalDate } : null;
}
function monthlySignal(monthly, date) {
  const i = (monthly?.time || []).findIndex(t => String(t).slice(0, 7) === monthKey(date));
  if (i < 0) return null;
  const get = key => finite(monthly?.[key]?.[i]) ? monthly[key][i] : null;
  return {
    precipitationMean: get("precipitation_mean"),
    precipitationAnomaly: get("precipitation_anomaly"),
    temperatureAnomaly: get("temperature_2m_anomaly"),
    windMean: get("wind_speed_10m_mean"),
    windAnomaly: get("wind_speed_10m_anomaly"),
    cloudAnomaly: get("cloud_cover_anomaly"),
    sunshineAnomaly: get("sunshine_duration_anomaly")
  };
}
function weeklySignal(weekly, date) {
  const hit = indexedSignal(weekly, date);
  if (!hit) return null;
  const get = key => finite(hit.section?.[key]?.[hit.index]) ? hit.section[key][hit.index] : null;
  return {
    signalDate: hit.signalDate,
    precipitationMean: get("precipitation_mean"),
    precipitationAnomaly: get("precipitation_anomaly"),
    precipitationEfi: get("precipitation_efi"),
    wetAnomalyChance: get("precipitation_anomaly_gt0"),
    temperatureAnomaly: get("temperature_2m_anomaly"),
    windMean: get("wind_speed_10m_mean"),
    windAnomaly: get("wind_speed_10m_anomaly")
  };
}
function adjustedWetDayFrequency(basePercent, weekly, monthly) {
  if (!finite(basePercent)) return null;
  const base = clamp(basePercent, 1, 99) / 100;
  let logit = Math.log(base / (1 - base));
  let evidence = 0;
  if (finite(weekly?.precipitationEfi)) {
    logit += clamp(weekly.precipitationEfi, -1, 1) * 0.85;
    evidence++;
  }
  if (finite(weekly?.wetAnomalyChance)) {
    logit += clamp((weekly.wetAnomalyChance - 50) / 50, -1, 1) * 0.35;
    evidence++;
  }
  const seasonalMean = finite(weekly?.precipitationMean) ? weekly.precipitationMean : monthly?.precipitationMean;
  const seasonalAnomaly = finite(weekly?.precipitationAnomaly) ? weekly.precipitationAnomaly : monthly?.precipitationAnomaly;
  if (finite(seasonalMean) && finite(seasonalAnomaly)) {
    const baseline = seasonalMean - seasonalAnomaly;
    if (baseline > 0) {
      const ratio = clamp(seasonalMean / baseline, 0.5, 2);
      logit += clamp(Math.log(ratio), -0.65, 0.65) * 0.75;
      evidence++;
    }
  }
  const adjusted = 100 / (1 + Math.exp(-logit));
  return { value: Math.round(clamp(adjusted, 1, 99)), evidence };
}
function seasonalRainMultiplier(weekly, monthly) {
  const forecast = finite(weekly?.precipitationMean) ? weekly.precipitationMean : monthly?.precipitationMean;
  const anomaly = finite(weekly?.precipitationAnomaly) ? weekly.precipitationAnomaly : monthly?.precipitationAnomaly;
  if (!finite(forecast) || !finite(anomaly)) return { value: 1, available: false };
  const baseline = forecast - anomaly;
  if (!(baseline > 0)) return { value: 1, available: false };
  return { value: clamp(forecast / baseline, 0.45, 1.9), available: true };
}
function weatherType(rainFrequency, dailyRainMm, wetDayRainMm, rainP90, cloudAnomaly) {
  if (!finite(rainFrequency) || !finite(dailyRainMm)) {
    return { label: "歷史氣候參考", code: null, frequencyBand: "unknown", amountBand: "unknown", consistency: "資料不足" };
  }
  const frequencyBand = rainFrequency >= 55 ? "high" : rainFrequency >= 28 ? "medium" : "low";
  const amountBand = dailyRainMm >= 3 ? "high" : dailyRainMm >= 1 ? "medium" : "low";
  const consistency = frequencyBand === "high" && amountBand === "low"
    ? "雨日偏多，但平均日雨量偏少"
    : frequencyBand === "low" && amountBand === "high"
    ? "雨日較少，但平均日雨量偏高"
    : frequencyBand === "high" && amountBand === "high"
    ? "雨日與雨量均偏高"
    : frequencyBand === "low" && amountBand === "low"
    ? "雨日與雨量均偏低"
    : "雨日頻率與雨量大致相稱";
  if (rainFrequency >= 55 && dailyRainMm < 1) {
    return { label: "多雲，雨日偏多但雨量較少", code: 3, frequencyBand, amountBand, consistency };
  }
  if (rainFrequency >= 55 && dailyRainMm >= 3) {
    return { label: "多雲，降雨風險偏高", code: 61, frequencyBand, amountBand, consistency };
  }
  if (rainFrequency >= 45 && dailyRainMm >= 1) {
    return { label: "多雲，較常有雨", code: dailyRainMm >= 2 ? 61 : 3, frequencyBand, amountBand, consistency };
  }
  if (rainFrequency < 30 && finite(rainP90) && rainP90 >= 10) {
    return { label: "整體偏乾，仍須留意偶發較大雨量", code: 2, frequencyBand, amountBand, consistency };
  }
  if (rainFrequency >= 28) {
    return { label: "晴時多雲，偶有雨", code: 2, frequencyBand, amountBand, consistency };
  }
  if (finite(cloudAnomaly) && cloudAnomaly >= 10) {
    return { label: "多雲偏乾", code: 3, frequencyBand, amountBand, consistency };
  }
  return { label: "相對乾燥／晴時多雲", code: 1, frequencyBand, amountBand, consistency };
}
function confidence(sampleYears, seasonalEvidence, hasTemperature, hasRain) {
  const coverage = clamp(sampleYears / 10, 0, 1);
  let score = Math.round(25 + coverage * 45 + Math.min(3, seasonalEvidence) * 7 + (hasTemperature ? 5 : 0) + (hasRain ? 4 : 0));
  score = clamp(score, 0, 85); // Long-range daily estimates are never labelled high confidence.
  const label = score >= 70 ? "中低" : score >= 52 ? "偏低" : sampleYears >= 5 ? "低" : "資料不足";
  return { score, label };
}

/**
 * Returns one record for each requested date in D17–D90, counting today as D1.
 * Historical input is expected to come from fetchCourseHistoricalWeekNormals().
 */
export function buildDailyClimateOutlook(seasonalPayload, historicalDays = [], today, days = 90) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today || "")) throw new TypeError("today must be YYYY-MM-DD");
  if (!Number.isInteger(days) || days < 17 || days > 120) throw new TypeError("days must be between 17 and 120");
  const history = new Map((historicalDays || []).map(row => [row.date, row]));
  const weekly = seasonalPayload?.weekly || null;
  const monthly = seasonalPayload?.monthly || null;
  const output = [];
  for (let day = 17; day <= Math.min(days, 90); day++) {
    const lead = day - 1;
    const date = addDays(today, lead);
    const h = history.get(date) || {};
    const w = weeklySignal(weekly, date);
    const m = monthlySignal(monthly, date);
    const samples = finite(h.sampleYears) ? h.sampleYears : 0;
    const rainSamples = finite(h.rainSampleYears) ? h.rainSampleYears : samples;
    const tempSamples = finite(h.temperatureSampleYears) ? h.temperatureSampleYears : samples;
    const rainSignal = adjustedWetDayFrequency(h.rainFrequency, w, m);
    const multiplier = seasonalRainMultiplier(w, m);
    const tempAnomaly = finite(w?.temperatureAnomaly) ? w.temperatureAnomaly : m?.temperatureAnomaly;
    const temperatureOffset = finite(tempAnomaly) ? clamp(tempAnomaly, -2.5, 2.5) : 0;
    const high = finite(h.highMean) ? h.highMean + temperatureOffset : null;
    const low = finite(h.lowMean) ? h.lowMean + temperatureOffset : null;
    const feelsLikeMin = finite(h.feelsLikeMinMeanC) ? h.feelsLikeMinMeanC + temperatureOffset : null;
    const feelsLikeMax = finite(h.feelsLikeMaxMeanC) ? h.feelsLikeMaxMeanC + temperatureOffset : null;
    const rainChance = rainSignal?.value ?? null;
    const rainMean = finite(h.rainMean) ? h.rainMean : null;
    const rainEstimate = finite(rainMean) ? Math.max(0, rainMean * multiplier.value) : null;
    const wetDayRainEstimate = finite(rainEstimate) && finite(rainChance) && rainChance > 0
      ? rainEstimate / (rainChance / 100) : null;
    const historicalRainP90 = finite(h.rainP90) ? h.rainP90 : null;
    const adjustedRainP90 = finite(historicalRainP90) ? historicalRainP90 * multiplier.value : null;
    const windMean = finite(w?.windMean) ? w.windMean : finite(m?.windMean) ? m.windMean : null;
    const weather = weatherType(rainChance, rainEstimate, wetDayRainEstimate, adjustedRainP90, m?.cloudAnomaly);
    const seasonalEvidence = (w ? Object.values(w).filter(finite).length : 0) + (m ? Object.values(m).filter(finite).length : 0);
    const quality = confidence(Math.min(rainSamples, tempSamples), rainSignal?.evidence || 0, finite(high) && finite(low), finite(rainChance) && finite(rainEstimate));
    const hasHistory = samples > 0 || rainSamples > 0 || tempSamples > 0;
    const hasSeasonalSignal = seasonalEvidence > 0;
    const sourceType = hasHistory && hasSeasonalSignal
      ? "seasonal-plus-historical-estimate"
      : hasHistory ? "historical-climate-reference"
      : hasSeasonalSignal ? "seasonal-signal-without-daily-baseline"
      : "insufficient-data";
    const sourceLabel = sourceType === "seasonal-plus-historical-estimate"
      ? "歷史同期統計＋季節模式訊號估計"
      : sourceType === "historical-climate-reference"
      ? "僅有歷史同期統計（未取得有效季節訊號）"
      : sourceType === "seasonal-signal-without-daily-baseline"
      ? "僅有季節模式訊號（缺歷史逐日基準）"
      : "資料不足";
    const fieldQuality = {
      temperature: finite(high) && finite(low) ? (hasHistory ? "historical-plus-seasonal-adjustment" : "seasonal-signal-only") : "missing",
      rainfallFrequency: finite(rainChance) ? (hasHistory && hasSeasonalSignal ? "historical-adjusted-by-seasonal-signal" : hasHistory ? "historical-frequency-only" : "missing") : "missing",
      rainfallAmount: finite(rainEstimate) ? (finite(rainMean) && multiplier.available ? "historical-amount-adjusted-by-seasonal-signal" : finite(rainMean) ? "historical-average-only" : "missing") : "missing",
      wind: finite(windMean) ? "seasonal-model" : "missing",
      feelsLike: finite(feelsLikeMin) && finite(feelsLikeMax) ? "historical-apparent-temperature-plus-seasonal-temperature-adjustment" : "missing"
    };
    output.push({
      date, lead: day, band: day <= 18 ? "D17–D18" : day <= 46 ? "D19–D46" : day <= 60 ? "D47–D60" : "D61–D90",
      highEstimate: finite(high) ? Math.round(high * 10) / 10 : null,
      lowEstimate: finite(low) ? Math.round(low * 10) / 10 : null,
      feelsLikeMinEstimateC: finite(feelsLikeMin) ? Math.round(feelsLikeMin * 10) / 10 : null,
      feelsLikeMaxEstimateC: finite(feelsLikeMax) ? Math.round(feelsLikeMax * 10) / 10 : null,
      rainEstimate: finite(rainEstimate) ? Math.round(rainEstimate * 10) / 10 : null,
      rainChanceEstimate: rainChance,
      rainChanceLabel: "歷史雨日頻率經季節訊號調整（非逐日降雨機率）",
      rainAmountBand: weather.amountBand,
      rainFrequencyBand: weather.frequencyBand,
      wetDayRainEstimate: finite(wetDayRainEstimate) ? Math.round(wetDayRainEstimate * 10) / 10 : null,
      rainP90Estimate: finite(adjustedRainP90) ? Math.round(adjustedRainP90 * 10) / 10 : null,
      rainConsistency: weather.consistency,
      windMeanEstimate: windMean,
      weather: weather.label, code: weather.code,
      historical: {
        sampleYears: samples, rainSampleYears: rainSamples, temperatureSampleYears: tempSamples,
        rainFrequency: finite(h.rainFrequency) ? h.rainFrequency : null,
        rainMean, rainP10: finite(h.rainP10) ? h.rainP10 : finite(h.rainMin) ? h.rainMin : null,
        rainP90: finite(h.rainP90) ? h.rainP90 : finite(h.rainMax) ? h.rainMax : null,
        highMean: finite(h.highMean) ? h.highMean : null, lowMean: finite(h.lowMean) ? h.lowMean : null,
        feelsLikeMinMeanC: finite(h.feelsLikeMinMeanC) ? h.feelsLikeMinMeanC : null,
        feelsLikeMaxMeanC: finite(h.feelsLikeMaxMeanC) ? h.feelsLikeMaxMeanC : null,
        highStd: finite(h.highStd) ? h.highStd : null, lowStd: finite(h.lowStd) ? h.lowStd : null
      },
      seasonal: {
        weeklyDate: w?.signalDate || null, precipitationEfi: finite(w?.precipitationEfi) ? w.precipitationEfi : null,
        precipitationAnomaly: finite(w?.precipitationAnomaly) ? w.precipitationAnomaly : finite(m?.precipitationAnomaly) ? m.precipitationAnomaly : null,
        temperatureAnomaly: finite(tempAnomaly) ? tempAnomaly : null,
        rainMultiplier: multiplier.value, rainMultiplierAvailable: multiplier.available,
        evidenceCount: seasonalEvidence
      },
      confidence: quality.label, confidenceScore: quality.score,
      confidenceNote: sourceType === "seasonal-plus-historical-estimate"
        ? "使用 ERA5 歷史同期樣本與可用週／月季節訊號調整；屬長期趨勢估計，不是逐日確定性預報"
        : sourceType === "historical-climate-reference"
        ? "僅使用 ERA5 歷史同期樣本；未取得可用季節訊號，不應解讀為未來天氣預報"
        : sourceType === "seasonal-signal-without-daily-baseline"
        ? "只有季節模式訊號，缺少歷史逐日基準；不產生具體逐日氣象數值"
        : "缺少足夠歷史樣本與季節訊號，不能形成可靠逐日估計",
      sourceType, sourceLabel, fieldQuality,
      seasonalEvidenceCount: seasonalEvidence,
      historicalSampleYears: samples,
      historicalRainSampleYears: rainSamples,
      historicalTemperatureSampleYears: tempSamples,
      rainProbability: null
    });
  }
  return output;
}
