const finite = x => typeof x === "number" && Number.isFinite(x);
const countFinite = a => Array.isArray(a) ? a.filter(finite).length : 0;

export function fieldCoverage(payload, section, fields, startDate=null, endDate=null) {
  const block=payload?.[section]||{};
  const times=block.time||[];
  const indexes=times.map((t,i)=>({t,i})).filter(x=>(!startDate||x.t.slice(0,10)>=startDate)&&(!endDate||x.t.slice(0,10)<=endDate)).map(x=>x.i);
  return Object.fromEntries(fields.map(key=>{
    const values=block[key];
    const selected=indexes.map(i=>values?.[i]);
    const valid=countFinite(selected);
    return [key,{expected:indexes.length,valid,missing:indexes.length-valid,coverage:indexes.length?valid/indexes.length:0}];
  }));
}

export function assessForecastPayload(payload) {
  const dailyCount=payload?.daily?.time?.length??0, hourlyCount=payload?.hourly?.time?.length??0;
  const dailyFields=["weather_code","precipitation_sum","precipitation_probability_max","temperature_2m_min","temperature_2m_max","apparent_temperature_min","apparent_temperature_max","wind_speed_10m_max","wind_gusts_10m_max"];
  const hourlyFields=["temperature_2m","apparent_temperature","relative_humidity_2m","precipitation_probability","precipitation","weather_code","wind_speed_10m","wind_direction_10m","wind_gusts_10m","cloud_cover","uv_index"];
  const daily=fieldCoverage(payload,"daily",dailyFields);
  const hourly=fieldCoverage(payload,"hourly",hourlyFields);
  const allFields=[...Object.values(daily),...Object.values(hourly)];
  return {
    timezone:payload?.timezone??null,
    returnedCoordinate:{latitude:payload?.latitude??null,longitude:payload?.longitude??null},
    elevation:payload?.elevation??null,
    generationTimeMs:payload?.generationtime_ms??null,
    dailyCount,hourlyCount,daily,hourly,
    requiredFieldCount:allFields.length,
    completeFieldCount:allFields.filter(x=>x.expected>0&&x.missing===0).length,
    totalExpectedValues:allFields.reduce((sum,x)=>sum+x.expected,0),
    totalValidValues:allFields.reduce((sum,x)=>sum+x.valid,0),
    coreFieldsComplete:dailyCount===16&&hourlyCount===384&&allFields.every(x=>x.expected>0&&x.missing===0)
  };
}