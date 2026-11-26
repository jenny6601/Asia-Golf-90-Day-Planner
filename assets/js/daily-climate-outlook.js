/**
 * Daily climate outlook engine for forecast days D19–D90 (day 1 is today).
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
function weatherType(rainChance, rainMm, cloudAnomaly) {
  if (!finite(rainChance)) return { label: "歷史氣候參考", code: null };
  if (rainChance >= 70 || (rainChance >= 55 && finite(rainMm) && rainMm >= 4)) return { label: "偏濕／降雨風險較高", code: 61 };
  if (rainChance >= 45) return { label: "多雲，留意降雨", code: 3 };
  if (rainChance >= 28) return { label: "晴時多雲／偶有雨", code: 2 };
  if (finite(cloudAnomaly) && cloudAnomaly >= 10) return { label: "多雲偏乾", code: 3 };
  return { label: "相對乾燥／晴時多雲", code: 1 };
}
function confidence(sampleYears, seasonalEvidence, hasTemperature, hasRain) {
  const coverage = clamp(sampleYears / 10, 0, 1);
  let score = Math.round(25 + coverage * 45 + Math.min(3, seasonalEvidence) * 7 + (hasTemperature ? 5 : 0) + (hasRain ? 4 : 0));
  score = clamp(score, 0, 85); // Long-range daily estimates are never labelled high confidence.
  const label = score >= 70 ? "中低" : score >= 52 ? "偏低" : sampleYears >= 5 ? "低" : "資料不足";
  return { score, label };
}

/**
 * Returns one record for each requested date in D19–D90, counting today as D1.
 * Historical input is expected to come from fetchCourseHistoricalWeekNormals().
 */
export function buildDailyClimateOutlook(seasonalPayload, historicalDays = [], today, days = 90) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today || "")) throw new TypeError("today must be YYYY-MM-DD");
  if (!Number.isInteger(days) || days < 19 || days > 120) throw new TypeError("days must be between 19 and 120");
  const history = new Map((historicalDays || []).map(row => [row.date, row]));
  const weekly = seasonalPayload?.weekly || null;
  const monthly = seasonalPayload?.monthly || null;
  const output = [];
  for (let day = 19; day <= Math.min(days, 90); day++) {
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
    const rainChance = rainSignal?.value ?? null;
    const rainMean = finite(h.rainMean) ? h.rainMean : null;
    const rainEstimate = finite(rainMean) ? Math.max(0, rainMean * multiplier.value) : null;
    const windMean = finite(w?.windMean) ? w.windMean : finite(m?.windMean) ? m.windMean : null;
    const weather = weatherType(rainChance, rainEstimate, m?.cloudAnomaly);
    const seasonalEvidence = (w ? Object.values(w).filter(finite).length : 0) + (m ? Object.values(m).filter(finite).length : 0);
    const quality = confidence(Math.min(rainSamples, tempSamples), rainSignal?.evidence || 0, finite(high) && finite(low), finite(rainChance) && finite(rainEstimate));
    const hasHistory = samples > 0 || rainSamples > 0 || tempSamples > 0;
    output.push({
      date, lead: day, band: day <= 46 ? "D19–D46" : day <= 60 ? "D47–D60" : "D61–D90",
      highEstimate: finite(high) ? Math.round(high * 10) / 10 : null,
      lowEstimate: finite(low) ? Math.round(low * 10) / 10 : null,
      rainEstimate: finite(rainEstimate) ? Math.round(rainEstimate * 10) / 10 : null,
      rainChanceEstimate: rainChance,
      rainChanceLabel: "歷史雨日頻率經季節訊號調整（非逐日降雨機率）",
      windMeanEstimate: windMean,
      weather: weather.label, code: weather.code,
      historical: {
        sampleYears: samples, rainSampleYears: rainSamples, temperatureSampleYears: tempSamples,
        rainFrequency: finite(h.rainFrequency) ? h.rainFrequency : null,
        rainMean, rainP10: finite(h.rainP10) ? h.rainP10 : finite(h.rainMin) ? h.rainMin : null,
        rainP90: finite(h.rainP90) ? h.rainP90 : finite(h.rainMax) ? h.rainMax : null,
        highMean: finite(h.highMean) ? h.highMean : null, lowMean: finite(h.lowMean) ? h.lowMean : null,
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
      confidenceNote: hasHistory ? "歷史同期統計＋週／月季節訊號；屬長期趨勢估計" : "缺少足夠歷史樣本，不能形成可靠逐日估計",
      sourceType: hasHistory ? "seasonal-climate-estimate" : "insufficient-data",
      rainProbability: null
    });
  }
  return output;
}
