/**
 * Provisional golf rain-impact model.
 * This is a transparent prototype rubric, not a statistically calibrated probability
 * of a round being cancelled. Keep raw forecast inputs alongside the index.
 */
const clamp = n => Math.max(0, Math.min(100, n));
const mean = xs => xs.reduce((a,b)=>a+b,0)/xs.length;

function probabilityImpact(avgProbability) {
  if (avgProbability <= 20) return 0;
  if (avgProbability <= 40) return 20;
  if (avgProbability <= 60) return 45;
  if (avgProbability <= 80) return 70;
  return 90;
}
function amountImpact(mm) {
  if (mm <= 0.1) return 0;
  if (mm <= 1) return 15;
  if (mm <= 3) return 35;
  if (mm <= 5) return 60;
  if (mm <= 10) return 80;
  return 100;
}
function intensityImpact(mmPerHour) {
  if (mmPerHour <= 0.1) return 0;
  if (mmPerHour <= 0.5) return 15;
  if (mmPerHour <= 1) return 30;
  if (mmPerHour <= 2.5) return 55;
  if (mmPerHour <= 5) return 80;
  return 100;
}

export function scoreGolfRainWindow(hourly, date, teeHour, durationHours = 6) {
  if (!hourly || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isInteger(teeHour) || teeHour < 0 || teeHour > 23 ||
      !Number.isInteger(durationHours) || durationHours < 1 || durationHours > 12) {
    throw new TypeError("Invalid hourly data, date, teeHour or durationHours");
  }
  const times = hourly.time ?? [];
  const indexes = [];
  for (let h = 0; h < durationHours; h++) {
    const target = `${date}T${String(teeHour+h).padStart(2,"0")}:00`;
    const i = times.indexOf(target);
    if (i < 0) return { status:"insufficient-data", missingHour:target };
    indexes.push(i);
  }
  const probs = indexes.map(i => hourly.precipitation_probability?.[i]);
  const amounts = indexes.map(i => hourly.precipitation?.[i]);
  if ([...probs,...amounts].some(v => typeof v !== "number" || !Number.isFinite(v))) {
    return { status:"insufficient-data", reason:"missing-precipitation-fields" };
  }
  const avgProbability = mean(probs);
  const totalRainMm = amounts.reduce((a,b)=>a+b,0);
  const peakHourlyRainMm = Math.max(...amounts);
  const wetHours = amounts.filter(v=>v>=0.1).length;
  const pImpact = probabilityImpact(avgProbability);
  const aImpact = amountImpact(totalRainMm);
  const iImpact = intensityImpact(peakHourlyRainMm);
  const risk = clamp(0.35*pImpact + 0.40*aImpact + 0.25*iImpact);
  const label = risk < 15 ? "低" : risk < 35 ? "偏低" : risk < 60 ? "中" : risk < 80 ? "高" : "很高";
  return {
    status:"scored",
    model:"golf-rain-impact-prototype-v1",
    calibration:"unvalidated",
    date, teeHour, durationHours,
    averageHourlyRainProbability:Math.round(avgProbability*10)/10,
    expectedRainAmountMm:Math.round(totalRainMm*10)/10,
    peakHourlyRainMm:Math.round(peakHourlyRainMm*10)/10,
    wetHours,
    probabilityImpact:pImpact,
    amountImpact:aImpact,
    intensityImpact:iImpact,
    rainRisk:Math.round(risk*10)/10,
    label
  };
}
