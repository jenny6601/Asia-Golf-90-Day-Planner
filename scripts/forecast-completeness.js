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
  const dailyTimes=payload?.daily?.time||[];
  const hourlyTimes=payload?.hourly?.time||[];
  const isContinuous=(times,stepMs)=>times.length>0&&times.every((value,index)=>{
    const current=Date.parse(value+(value.length===10?"T00:00:00Z":"Z"));
    if(!Number.isFinite(current))return false;
    if(index===0)return true;
    const previous=Date.parse(times[index-1]+(times[index-1].length===10?"T00:00:00Z":"Z"));
    return current-previous===stepMs;
  });
  const dailyDatesContinuous=isContinuous(dailyTimes,86400000);
  const hourlyTimesContinuous=isContinuous(hourlyTimes,3600000);
  const dailyHourlyDatesAligned=dailyTimes.length>0&&hourlyTimes.length>0&&dailyTimes[0]===hourlyTimes[0].slice(0,10)&&dailyTimes[dailyTimes.length-1]===hourlyTimes[hourlyTimes.length-1].slice(0,10);
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
    dailyDatesContinuous,hourlyTimesContinuous,dailyHourlyDatesAligned,
    coreFieldsComplete:dailyCount===16&&hourlyCount===384&&dailyDatesContinuous&&hourlyTimesContinuous&&dailyHourlyDatesAligned&&allFields.every(x=>x.expected>0&&x.missing===0)
  };
}