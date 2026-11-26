/**
 * Daily seasonal + same-calendar-day ERA5 blend for lead days 19–90.
 * Seasonal daily values are a model signal; ERA5 values are climatological
 * analogues. This is an experimental decision-support estimate, not a forecast.
 */
const finite = v => typeof v === "number" && Number.isFinite(v);
const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const blend = (a,b,wa,wb) => {
  const av=finite(a), bv=finite(b);
  if(av&&bv)return (a*wa+b*wb)/(wa+wb);
  if(av)return a;
  if(bv)return b;
  return null;
};
const weatherLabel = code => !finite(code)?"天氣型態資料不足":code===0?"晴朗":code<=2?"晴時多雲":code===3?"多雲／陰":code<=48?"霧或低雲":code<=57?"零星飄雨":code<=67?"降雨訊號":code<=82?"陣雨訊號":code>=95?"雷雨型態訊號":"多雲";
function dayLead(date, today) {
 return Math.round((Date.parse(date+"T12:00:00Z")-Date.parse(today+"T12:00:00Z"))/86400000);
}
export function normalizeSeasonalDaily(payload, today) {
 const d=payload?.daily||{}, h=payload?.hourly||{};
 const dates=d.time||[], ht=h.time||[];
 const hourlyByDate=new Map();
 ht.forEach((t,i)=>{const date=String(t).slice(0,10);if(!hourlyByDate.has(date))hourlyByDate.set(date,[]);hourlyByDate.get(date).push(i)});
 return dates.map((date,i)=>{
  const ids=hourlyByDate.get(date)||[];
  const rainValues=ids.map(j=>h.precipitation?.[j]??h.rain?.[j]??h.showers?.[j]).filter(finite);
  const tempValues=ids.map(j=>h.temperature_2m?.[j]).filter(finite);
  const apparentValues=ids.map(j=>h.apparent_temperature?.[j]).filter(finite);
  const windValues=ids.map(j=>h.wind_speed_10m?.[j]).filter(finite);
  const humidityValues=ids.map(j=>h.relative_humidity_2m?.[j]).filter(finite);
  const dailyRain=rainValues.length?rainValues.reduce((s,v)=>s+v,0):null;
  const code=d.weather_code?.[i]??null;
  const lead=dayLead(date,today);
  return {date,lead,band:lead<=46?"EC46":"SEAS5",code,weather:weatherLabel(code),
   high:d.temperature_2m_max?.[i]??null,low:d.temperature_2m_min?.[i]??null,
   tempMean:d.temperature_2m_mean?.[i]??mean(tempValues),
   windMean:d.wind_speed_10m_mean?.[i]??mean(windValues),
   cloudMean:d.cloud_cover_mean?.[i]??null,sunshineSeconds:d.sunshine_duration?.[i]??null,
   rainEstimate:dailyRain,rainSource:rainValues.length?"seasonal-6h-sum":null,
   apparentMean:mean(apparentValues),humidityMean:mean(humidityValues),
   gustMax:ids.map(j=>h.wind_gusts_10m?.[j]).filter(finite).length?Math.max(...ids.map(j=>h.wind_gusts_10m?.[j]).filter(finite)):null,
   sixHourSamples:ids.length,validRainSamples:rainValues.length};
 });
}
export function blendSeasonalWithHistory(seasonalDays, historicalDays=[]) {
 const hist=new Map(historicalDays.map(x=>[x.date,x]));
 return seasonalDays.filter(s=>s.lead>=19&&s.lead<=90).map(s=>{
  const h=hist.get(s.date)||{};
  const samples=finite(h.sampleYears)?h.sampleYears:0;
  const histRain=finite(h.rainMean)?h.rainMean:null;
  const histHigh=finite(h.highMean)?h.highMean:null, histLow=finite(h.lowMean)?h.lowMean:null;
  // Base weights 40 seasonal / 40 historical daily analogue / 20 variability.
  // The variability component widens uncertainty; it does not invent a third forecast.
  const variabilityCoverage=clamp(samples/10,0,1);
  const seasonalWeight=0.4, historicalWeight=0.4*variabilityCoverage;
  const high=blend(s.high,histHigh,seasonalWeight,historicalWeight);
  const low=blend(s.low,histLow,seasonalWeight,historicalWeight);
  const rain=blend(s.rainEstimate,histRain,seasonalWeight,historicalWeight);
  const rainSpread=finite(h.rainMax)&&finite(h.rainMin)?h.rainMax-h.rainMin:null;
  const wetSignal=s.code!==null&&((s.code>=51&&s.code<=82)||s.code>=95);
  const playability=wetSignal||(finite(rain)&&rain>=5)?"偏濕／不利趨勢":
    finite(rain)&&rain>=2?"需留意降雨":"相對有利趨勢";
  const complete=[s.high,s.low,s.rainEstimate,s.windMean,s.code].filter(finite).length;
  const confidence=samples>=8&&complete>=4?"中低":samples>=5&&complete>=3?"偏低":"低";
  return {...s,highEstimate:high,lowEstimate:low,rainEstimate:rain,
   historical:{sampleYears:samples,highMean:histHigh,lowMean:histLow,rainMean:histRain,
    rainFrequency:finite(h.rainFrequency)?h.rainFrequency:null,rainSpread},
   weights:{seasonal:seasonalWeight,historical:historicalWeight,variability:0.2*variabilityCoverage},
   playability,confidence,confidenceNote:"季節趨勢估計；非逐日確定性預報",
   rainProbability:null,rainProbabilityLabel:"不提供季節模式降雨機率",
   dataCompleteness:complete/5};
 });
}
