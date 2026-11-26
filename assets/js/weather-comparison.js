/**
 * Pair hourly forecasts by identical valid time and representative Okinawa zone.
 * This measures inter-provider agreement, not forecast accuracy.
 */
export function compareHourlySnapshots(weatherApi, openMeteo, cutoffLocal) {
  if (!weatherApi?.zones?.length || !openMeteo?.zones?.length) throw new Error("兩個來源都必須有區域資料");
  const rows = weatherApi.zones.map(wz => {
    const oz = openMeteo.zones.find(x => x.zone.id === wz.zone.id);
    if (!oz) throw new Error(`Open-Meteo 缺少區域：${wz.zone.id}`);
    const om = new Map(oz.hourly.time.map((time, i) => [time.replace("T", " "), i]));
    const pairs = [];
    for (const day of wz.forecastDays) for (const h of day.hours) {
      if (h.time < cutoffLocal) continue;
      const idx = om.get(h.time);
      if (idx === undefined) continue;
      const value = key => oz.hourly[key]?.[idx];
      const pair = {
        validTime: h.time,
        weatherApi: { chanceOfRain: h.chanceOfRain, precipMm: h.precipMm, tempC: h.tempC, feelsLikeC: h.feelsLikeC, windKph: h.windKph, gustKph: h.gustKph },
        openMeteo: {
          chanceOfRain: value("precipitation_probability"),
          precipMm: value("precipitation"),
          tempC: value("temperature_2m"),
          feelsLikeC: value("apparent_temperature"),
          windKph: Number.isFinite(value("wind_speed_10m")) ? value("wind_speed_10m") * 3.6 : null,
          gustKph: Number.isFinite(value("wind_gusts_10m")) ? value("wind_gusts_10m") * 3.6 : null
        }
      };
      pairs.push(pair);
    }
    const metrics = {};
    for (const field of ["chanceOfRain", "precipMm", "tempC", "feelsLikeC", "windKph", "gustKph"]) {
      const diffs = pairs.map(p => {
        const a = p.weatherApi[field], b = p.openMeteo[field];
        return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a-b) : null;
      }).filter(Number.isFinite);
      metrics[field] = { comparedHours: diffs.length, meanAbsoluteDifference: diffs.length ? Number((diffs.reduce((s,x)=>s+x,0)/diffs.length).toFixed(3)) : null };
    }
    return { zone: wz.zone, comparedHours: pairs.length, metrics, hourlyPairs: pairs };
  });
  return {
    schemaVersion: 1,
    purpose: "provider_agreement_not_accuracy",
    cutoffLocal,
    timezone: "Asia/Tokyo",
    zones: rows
  };
}
