/**
 * Destination-region 5-day / 4-night golf-trip screening.
 *
 * This engine intentionally consumes one regional weather signal (or a small set
 * of regional signals), never per-course coordinates or hourly forecasts.
 * D17-D46 uses weekly precipitation EFI; D47-D90 uses monthly precipitation
 * anomaly. These are qualitative planning signals, not daily rain forecasts.
 */
const DAY_MS = 86400000;
const addDays = (date, n) => new Date(Date.parse(date + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
const leadDays = (date, referenceDate) => (Date.parse(date + "T00:00:00Z") - Date.parse(referenceDate + "T00:00:00Z")) / DAY_MS;

function weeklySignal(series, date) {
  const times = series?.time ?? [];
  let index = -1;
  for (let i = 0; i < times.length; i++) if (times[i] <= date) index = i;
  if (index < 0) return null;
  const efi = series.precipitation_efi?.[index];
  if (!Number.isFinite(efi)) return null;
  const rank = efi >= 0.8 ? 3 : efi >= 0.5 ? 2 : efi <= -0.5 ? 0 : 1;
  return {rank, label:["偏乾","接近基準","偏濕","顯著偏濕"][rank], basis:"weekly-precipitation-efi", period:times[index], value:efi};
}

function monthlySignal(series, date) {
  const month = date.slice(0, 7);
  const index = (series?.time ?? []).findIndex(value => value.slice(0, 7) === month);
  if (index < 0) return null;
  const mean = series.precipitation_mean?.[index];
  const anomaly = series.precipitation_anomaly?.[index];
  if (!Number.isFinite(mean) || mean <= 0 || !Number.isFinite(anomaly)) return null;
  const ratio = anomaly / mean;
  const rank = ratio >= 0.2 ? 3 : ratio >= 0.05 ? 2 : ratio <= -0.2 ? 0 : 1;
  return {rank, label:["偏乾","接近基準","偏濕","顯著偏濕"][rank], basis:"monthly-precipitation-anomaly", period:series.time[index], anomalyMm:anomaly, anomalyPercent:Math.round(ratio * 100)};
}

function signalForLead(regionWeather, date, lead) {
  if (lead >= 17 && lead <= 46) return weeklySignal(regionWeather.weekly, date);
  if (lead >= 47 && lead <= 90) return monthlySignal(regionWeather.monthly, date);
  return null;
}

/**
 * regionWeather: {regionId, regionLabel, weekly:{time,precipitation_efi},
 * monthly:{time,precipitation_mean,precipitation_anomaly}}
 */
export function evaluateRegionalGolfTrip({tripStart, referenceDate, regionWeather, roundDayOffsets=[1,2,3]}) {
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
  if (!validDate(tripStart) || !validDate(referenceDate)) throw new TypeError("tripStart and referenceDate must be YYYY-MM-DD");
  if (!regionWeather?.regionId || !regionWeather?.regionLabel) throw new TypeError("regional weather identity is required");
  if (!Array.isArray(roundDayOffsets) || roundDayOffsets.length !== 3 || roundDayOffsets.some(x => !Number.isInteger(x) || x < 0 || x > 4) || new Set(roundDayOffsets).size !== 3) {
    throw new RangeError("exactly three distinct golf-day offsets within the five-day trip are required");
  }
  const tripEnd = addDays(tripStart, 4);
  const rounds = roundDayOffsets.map((offset, index) => {
    const date = addDays(tripStart, offset);
    const lead = leadDays(date, referenceDate);
    const signal = signalForLead(regionWeather, date, lead);
    return {round:index + 1, date, leadDays:lead, status:signal ? "scored" : "insufficient-data", signal};
  });
  if (rounds.some(round => round.status !== "scored")) {
    return {status:"insufficient-data", regionId:regionWeather.regionId, regionLabel:regionWeather.regionLabel, tripStart, tripEnd, tripDays:5, nights:4, rounds, missingDates:rounds.filter(x => x.status !== "scored").map(x => x.date), score:null};
  }
  const ranks = rounds.map(round => round.signal.rank);
  const worstRank = Math.max(...ranks);
  const meanRank = ranks.reduce((sum, value) => sum + value, 0) / ranks.length;
  const rank = Math.max(worstRank, Math.round(meanRank));
  return {
    status:"scored", regionId:regionWeather.regionId, regionLabel:regionWeather.regionLabel,
    tripStart, tripEnd, tripDays:5, nights:4,
    golfDates:rounds.map(x => x.date), rounds, tendencyRank:rank,
    tendency:["偏乾趨勢","接近氣候基準","偏濕趨勢","顯著偏濕趨勢"][rank],
    confidence:"very-low", confidenceLabel:"極低（區域長期趨勢，尚未完成回測校準）",
    evidenceTypes:[...new Set(rounds.map(x => x.signal.basis))],
    interpretation:"用於旅遊日期初篩；不是逐日降雨預報、降雨機率或取消機率。實際出發前應再以短期預報確認。",
    calibration:"not-validated"
  };
}

export function recommendRegionalGolfTrips({referenceDate, regionWeather, limit=3, minStartGap=5, horizonDays=90}) {
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
  if (!validDate(referenceDate)) throw new TypeError("referenceDate must be YYYY-MM-DD");
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(minStartGap) || minStartGap < 1 || !Number.isInteger(horizonDays) || horizonDays < 21 || horizonDays > 90) {
    throw new RangeError("invalid recommendation options");
  }
  const first = addDays(referenceDate, 17);
  const last = addDays(referenceDate, horizonDays - 4);
  const all = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    all.push(evaluateRegionalGolfTrip({tripStart:date, referenceDate, regionWeather}));
  }
  const scored = all.filter(item => item.status === "scored").sort((a,b) => a.tendencyRank - b.tendencyRank || a.tripStart.localeCompare(b.tripStart));
  const recommendations = [];
  for (const item of scored) {
    const spaced = recommendations.every(existing => Math.abs(leadDays(item.tripStart, existing.tripStart)) >= minStartGap);
    if (spaced) {
      recommendations.push({...item, recommendationRank:recommendations.length + 1});
      if (recommendations.length === limit) break;
    }
  }
  return {regionId:regionWeather.regionId, candidateCount:all.length, scoredCount:scored.length, missingCount:all.length-scored.length, recommendations, all};
}
