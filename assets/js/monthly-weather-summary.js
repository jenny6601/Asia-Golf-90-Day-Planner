/**
 * Monthly golf-weather summary.
 * Rain frequency is a wet-day frequency estimate for long range, not a
 * calibrated daily rain probability. Rain amount is the estimated calendar-day
 * mean. Missing fields are never silently replaced with extreme values.
 */
export function classifyMonthlyDay({ rainFrequency, rainAmount, highTemp }) {
  const hasFrequency = Number.isFinite(rainFrequency);
  const hasAmount = Number.isFinite(rainAmount);
  if (!hasFrequency && !hasAmount) return null;

  let grade;
  if (hasFrequency && hasAmount) {
    grade = rainFrequency < 30 && rainAmount < 1 ? 0
      : rainFrequency < 45 && rainAmount < 2 ? 1
      : rainFrequency < 60 && rainAmount < 4 ? 2 : 3;
  } else if (hasFrequency) {
    grade = rainFrequency < 30 ? 0 : rainFrequency < 45 ? 1 : rainFrequency < 60 ? 2 : 3;
  } else {
    grade = rainAmount < 1 ? 0 : rainAmount < 2 ? 1 : rainAmount < 4 ? 2 : 3;
  }

  const tooHot = Number.isFinite(highTemp) && highTemp > 33;
  if (tooHot) grade = 3;
  return { grade, status: grade === 3 ? "不適" : grade === 2 ? "可打" : "適打", playable: grade <= 1 };
}

export function summarizeMonthlyWeather(days, today, expectedDates = []) {
  const future = (days || []).filter(day => day?.date >= today);
  const valid = future.filter(day => Number.isInteger(day.grade) && day.grade >= 0 && day.grade <= 3);
  const counts = {
    suitable: valid.filter(day => day.grade <= 1).length,
    watch: valid.filter(day => day.grade === 2).length,
    poor: valid.filter(day => day.grade === 3).length
  };
  const expected = expectedDates.filter(date => date >= today).length || future.length;
  const coverage = expected ? valid.length / expected : 0;
  const suitableRatio = valid.length ? counts.suitable / valid.length : 0;
  const poorRatio = valid.length ? counts.poor / valid.length : 0;

  let label = "資料不足";
  let description = "可評估日期不足，暫不判定本月整體天氣。";
  if (valid.length && coverage >= 0.5) {
    if (suitableRatio >= 0.7 && poorRatio <= 0.15) {
      label = "整體適打";
      description = "多數可評估日期降雨風險較低，適合安排球敘。";
    } else if (suitableRatio >= 0.5 && poorRatio <= 0.25) {
      label = "大致適打";
      description = "整體條件尚可，部分日期仍需留意降雨。";
    } else if (suitableRatio >= 0.3) {
      label = "降雨需留意";
      description = "適打日期與降雨風險日期交錯，建議挑選較佳時段。";
    } else {
      label = "不優先安排";
      description = "較多日期有明顯降雨或其他不利條件。";
    }
  }
  return { label, description, counts, validDays: valid.length, expectedDays: expected, coverage };
}

/** Select the first source that actually contains a finite value for a metric. */
export function firstAvailableMetric(...values) {
  return values.find(Number.isFinite) ?? null;
}
