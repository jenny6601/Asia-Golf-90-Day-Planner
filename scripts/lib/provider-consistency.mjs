const PROVIDERS = ["openMeteo", "visualCrossing", "foreca"];
const METRICS = [
  "temperatureC",
  "feelsLikeC",
  "precipitationProbabilityPct",
  "precipitationMm",
  "windSpeedMs",
  "windGustMs"
];

function providerRows(provider, data) {
  if (!data) return [];
  if (provider === "openMeteo") return Array.isArray(data.hourly) ? data.hourly : [];
  if (provider === "visualCrossing") {
    return Array.isArray(data.days) ? data.days.flatMap(day => Array.isArray(day.hours) ? day.hours : []) : [];
  }
  return Array.isArray(data.hourly?.forecast) ? data.hourly.forecast : [];
}

// All three providers describe the same Asia/Tokyo wall-clock hour.
// Foreca's +09:00 suffix is deliberately stripped only after validating the
// ISO local date/hour prefix; no UTC conversion is applied to local display time.
export function localHourKey(value) {
  if (typeof value !== "string" || value.length < 16) return null;
  const prefix = value.slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(prefix)) return null;
  return prefix.slice(0, 13);
}

function summarizeDifferences(values) {
  const finite = values.filter(Number.isFinite).map(Math.abs);
  if (!finite.length) return {sampleCount: 0, meanAbsoluteDifference: null, maxAbsoluteDifference: null};
  return {
    sampleCount: finite.length,
    meanAbsoluteDifference: Number((finite.reduce((a,b)=>a+b,0)/finite.length).toFixed(3)),
    maxAbsoluteDifference: Number(Math.max(...finite).toFixed(3))
  };
}

export function buildProviderConsistencyReport(courses, {
  startHour = 10,
  endHour = 16
} = {}) {
  const courseReports = [];
  for (const course of courses) {
    const maps = {};
    for (const provider of PROVIDERS) {
      const data = course.providers?.[provider]?.data;
      maps[provider] = new Map(providerRows(provider, data)
        .map(row => [localHourKey(row.time), row])
        .filter(([key]) => key !== null));
    }
    const sharedKeys = [...maps.openMeteo.keys()]
      .filter(key => maps.visualCrossing.has(key) && maps.foreca.has(key))
      .sort();
    const selectedKeys = sharedKeys.filter(key => {
      const hour = Number(key.slice(11,13));
      return hour >= startHour && hour <= endHour;
    });
    const dates = [...new Set(selectedKeys.map(key=>key.slice(0,10)))];
    const days = dates.map(date => {
      const keys = selectedKeys.filter(key=>key.startsWith(date+"T"));
      const byProvider = {};
      for (const provider of PROVIDERS) {
        const values = keys.map(key=>maps[provider].get(key));
        const deltas = values
          .filter(row=>Number.isFinite(row.temperatureC)&&Number.isFinite(row.feelsLikeC))
          .map(row=>row.feelsLikeC-row.temperatureC);
        byProvider[provider] = {
          matchedHours: values.length,
          feelsLikeVsAirTemperature: {
            sampleCount: deltas.length,
            equalCount: deltas.filter(x=>Math.abs(x)<0.05).length,
            meanDeltaC: deltas.length ? Number((deltas.reduce((a,b)=>a+b,0)/deltas.length).toFixed(2)) : null
          }
        };
      }
      const pairwise = {};
      for (const [a,b] of [["openMeteo","visualCrossing"],["openMeteo","foreca"],["visualCrossing","foreca"]]) {
        pairwise[a+"__"+b] = {};
        for (const metric of METRICS) {
          const diffs = keys.map(key=>{
            const x=maps[a].get(key)?.[metric], y=maps[b].get(key)?.[metric];
            return Number.isFinite(x)&&Number.isFinite(y) ? x-y : null;
          }).filter(Number.isFinite);
          pairwise[a+"__"+b][metric]=summarizeDifferences(diffs);
        }
      }
      return {date, matchedCommonHours:keys.length, providers:byProvider, pairwise};
    });
    courseReports.push({
      courseId:course.id,
      courseName:course.name,
      coordinateStatus:course.coordinateStatus,
      totalSharedLocalHours:sharedKeys.length,
      selectedWindow:{startHour,endHour},
      days
    });
  }
  return {
    timezone:"Asia/Tokyo",
    timeAlignmentPolicy:"Compare local wall-clock hour keys; preserve source timestamps separately; do not shift Foreca +09:00 values to another local hour.",
    comparisonWindow:{startHour,endHour,inclusive:true},
    metrics:METRICS,
    courses:courseReports,
    interpretation:{
      feelsLike:"Provider apparent/feels-like fields are provider-defined outputs. Equality with air temperature is not automatically a missing-data error; compare methods and conditions before treating the values as interchangeable.",
      pairwise:"Pairwise differences describe model/provider disagreement only. They are not forecast errors or accuracy scores without observations."
    }
  };
}
