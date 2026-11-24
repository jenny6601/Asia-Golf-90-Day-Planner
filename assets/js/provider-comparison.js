const finite=x=>typeof x==="number"&&Number.isFinite(x);
const localKey=(iso,timeZone)=>{
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));
 const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${v.year}-${v.month}-${v.day}T${v.hour}:00`;
};
function sourceHours(providerData){
 if(providerData?.provider==="Visual Crossing")return (providerData.days??[]).flatMap(d=>(d.hours??[]).map(h=>({time:h.time,prob:h.precipitationProbabilityPct,rain:h.precipitationMm,temp:h.temperatureC,feels:h.feelsLikeC,wind:h.windSpeedMs,gust:h.windGustMs,period:h.precipitationAccumulationPeriodHours??1})));
 if(providerData?.provider==="Foreca")return (providerData.hourly?.forecast??[]).map(h=>({time:localKey(h.time,providerData.timezone),prob:h.precipitationProbabilityPct,rain:h.precipitationMm,temp:h.temperatureC,feels:h.feelsLikeC,wind:h.windSpeedMs,gust:h.windGustMs,period:h.precipitationAccumulationPeriodHours??1}));
 return [];
}
function openMeteoHours(courseData){
 const h=courseData?.hourly;if(!h?.time)return [];
 return h.time.map((time,i)=>({time,prob:h.precipitation_probability?.[i]??null,rain:h.precipitation?.[i]??null,temp:h.temperature_2m?.[i]??null,feels:h.apparent_temperature?.[i]??null,wind:h.wind_speed_10m?.[i]??null,gust:h.wind_gusts_10m?.[i]??null,period:1}));
}
function summarize(hours,date,teeHour){
 const selected=hours.filter(x=>x.time>=`${date}T${String(teeHour).padStart(2,"0")}:00`&&x.time<`${date}T${String(teeHour+6).padStart(2,"0")}:00`);
 if(selected.length!==6)return {status:"incomplete",hoursReturned:selected.length,expectedHours:6};
 if(selected.some(x=>x.period!==1))return {status:"incompatible-interval",hoursReturned:selected.length,expectedHours:6};
 const vals=key=>selected.map(x=>x[key]).filter(finite);
 const sum=key=>{const v=vals(key);return v.length===6?v.reduce((a,b)=>a+b,0):null;};
 const max=key=>{const v=vals(key);return v.length?Math.max(...v):null;};
 const min=key=>{const v=vals(key);return v.length?Math.min(...v):null;};
 return {status:"available",hoursReturned:6,precipProbabilityAvgPct:sum("prob")===null?null:Math.round(sum("prob")/6*10)/10,rainTotalMm:sum("rain")===null?null:Math.round(sum("rain")*10)/10,tempMinC:min("temp"),tempMaxC:max("temp"),feelsLikeMinC:min("feels"),feelsLikeMaxC:max("feels"),windMaxMs:max("wind"),gustMaxMs:max("gust"),sourceHours:selected};
}
/** Compare providers on identical local six-hour windows. No cross-provider filling or interval coercion. */
export function compareProviderGolfWindow({openMeteo,independentProviders,date,teeHour,timeZone}){
 const sources={openMeteo:{status:"available",hours:openMeteoHours(openMeteo)}};
 const vc=independentProviders?.providers?.visualCrossing;
 const foreca=independentProviders?.providers?.foreca;
 sources.visualCrossing=vc?.status==="available"?{status:"available",hours:sourceHours(vc.data)}:{status:"unavailable",reason:vc?.error??"No server-side response"};
 sources.foreca=foreca?.status==="available"?{status:"available",hours:sourceHours(foreca.data)}:{status:"unavailable",reason:foreca?.error??"No server-side response"};
 return Object.fromEntries(Object.entries(sources).map(([name,s])=>[name,s.status==="available"?summarize(s.hours,date,teeHour):s]));
}
