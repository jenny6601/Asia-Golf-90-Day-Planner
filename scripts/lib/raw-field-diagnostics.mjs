const round = value => Number.isFinite(value) ? Number(value.toFixed(3)) : null;
const equal = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) < 0.05;

function summarize(rows, provider) {
  const rawRows = rows.filter(row => row && typeof row.time === "string");
  const normalizedRows = new Map(rows.normalized.map(row => [row.time, row]));
  const samples = rawRows.map(raw => {
    const normalized = normalizedRows.get(raw.time) ?? null;
    const temperature = raw.temperatureRaw;
    const feelsLike = raw.feelsLikeRaw;
    const delta = Number.isFinite(temperature) && Number.isFinite(feelsLike)
      ? feelsLike-temperature : null;
    return {
      time: raw.time,
      rawTemperature: raw.temperatureRaw,
      rawFeelsLike: raw.feelsLikeRaw,
      rawHumidity: raw.humidityRaw,
      rawWindSpeed: provider === "visualCrossing" ? raw.windSpeedRawKmh : raw.windSpeedRawMs,
      rawWindSpeedUnit: provider === "visualCrossing" ? "km/h" : "m/s",
      rawWindGust: provider === "visualCrossing" ? raw.windGustRawKmh : raw.windGustRawMs,
      rawPrecipitation: raw.precipitationRawMm,
      rawPrecipitationProbability: raw.precipitationProbabilityRawPct,
      normalizedTemperatureC: normalized?.temperatureC ?? null,
      normalizedFeelsLikeC: normalized?.feelsLikeC ?? null,
      normalizedFeelsLikeEqualsTemperature: normalized ? equal(normalized.temperatureC,normalized.feelsLikeC) : null,
      rawFeelsLikeEqualsTemperature: equal(temperature,feelsLike),
      rawFeelsLikeMinusTemperatureC: round(delta),
      normalizationPreservedFeelsLike: normalized
        ? (Number.isFinite(feelsLike) && Number.isFinite(normalized.feelsLikeC)
          ? Math.abs(feelsLike-normalized.feelsLikeC)<0.0001
          : feelsLike==null && normalized.feelsLikeC===null)
        : null
    };
  });
  const valid = samples.filter(x=>Number.isFinite(x.rawTemperature)&&Number.isFinite(x.rawFeelsLike));
  const equalCount = valid.filter(x=>x.rawFeelsLikeEqualsTemperature).length;
  const deltaValues = valid.map(x=>x.rawFeelsLikeMinusTemperatureC);
  const nonzero = deltaValues.filter(x=>Math.abs(x)>=0.05);
  return {
    provider,
    rawSampleCount:rawRows.length,
    validTemperatureFeelsLikePairs:valid.length,
    rawFeelsLikeEqualToTemperatureCount:equalCount,
    rawFeelsLikeEqualToTemperaturePct:valid.length?round(equalCount/valid.length*100):null,
    rawFeelsLikeMissingCount:rawRows.filter(x=>x.feelsLikeRaw==null).length,
    rawTemperatureMissingCount:rawRows.filter(x=>x.temperatureRaw==null).length,
    rawHumidityMissingCount:rawRows.filter(x=>x.humidityRaw==null).length,
    rawFeelsLikeMinusTemperatureMeanC:deltaValues.length?round(deltaValues.reduce((a,b)=>a+b,0)/deltaValues.length):null,
    nonEqualPairCount:nonzero.length,
    normalizationPreservedAllFeelsLikeValues:samples.every(x=>x.normalizationPreservedFeelsLike===true),
    samples
  };
}

export function buildRawFieldDiagnostics(courses) {
  return {
    generatedAt:new Date().toISOString(),
    timezone:"Asia/Tokyo",
    scope:"Selected raw response fields only; no credentials or full provider payloads are stored.",
    interpretation:"Raw equality is a source response characteristic, not by itself proof of provider error. Normalization preservation checks whether selected raw feels-like values were passed through unchanged.",
    courses:courses.map(course=>{
      const vc=course.providers?.visualCrossing?.data;
      const foreca=course.providers?.foreca?.data;
      const vcRaw=vc?.rawFieldDiagnostics??[];
      const forecaRaw=foreca?.hourly?.rawFieldDiagnostics??[];
      const vcNormalized=(vc?.days??[]).flatMap(day=>day.hours??[]);
      const forecaNormalized=foreca?.hourly?.forecast??[];
      return {
        courseId:course.id,
        courseName:course.name,
        coordinateStatus:course.coordinateStatus,
        visualCrossing:vc? summarize(Object.assign([...vcRaw],{normalized:vcNormalized}),"visualCrossing") : {status:"unavailable"},
        foreca:foreca? summarize(Object.assign([...forecaRaw],{normalized:forecaNormalized}),"foreca") : {status:"unavailable"}
      };
    })
  };
}
