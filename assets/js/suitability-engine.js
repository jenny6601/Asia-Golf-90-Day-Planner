/**
 * Six-hour golf playability overlay.
 * Transparent operational thresholds; not a calibrated safety or cancellation model.
 * Severity is driven by the worst forecast hour to avoid hiding short severe episodes.
 */
const max=(xs)=>Math.max(...xs);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const valid=(x)=>typeof x==="number"&&Number.isFinite(x);
export function scoreGolfSuitabilityWindow(hourly,date,teeHour,durationHours=6){
 if(!hourly||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)||!Number.isInteger(teeHour)||teeHour<0||teeHour>23||!Number.isInteger(durationHours)||durationHours<1||durationHours>12)
  throw new TypeError("Invalid hourly data, date, teeHour or durationHours");
 const indexes=[];
 for(let h=0;h<durationHours;h++){
  const target=`${date}T${String(teeHour+h).padStart(2,"0")}:00`;
  const i=(hourly.time??[]).indexOf(target);
  if(i<0)return {status:"insufficient-data",missingHour:target};
  indexes.push(i);
 }
 const fields=["wind_speed_10m","wind_gusts_10m","apparent_temperature","weather_code"];
 for(const field of fields)if(indexes.some(i=>!valid(hourly[field]?.[i])))return {status:"insufficient-data",reason:`missing-${field}`};
 const wind=indexes.map(i=>hourly.wind_speed_10m[i]),gust=indexes.map(i=>hourly.wind_gusts_10m[i]);
 const feels=indexes.map(i=>hourly.apparent_temperature[i]),codes=indexes.map(i=>hourly.weather_code[i]);
 const peakWind=max(wind),peakGust=max(gust),minFeels=Math.min(...feels),maxFeels=max(feels);
 const thunderstorm=codes.some(c=>[95,96,99].includes(c));
 const reasons=[];
 let severity=0;
 const add=(level,reason)=>{severity=Math.max(severity,level);if(!reasons.includes(reason))reasons.push(reason);};
 if(thunderstorm)add(3,"預報有雷雨訊號");
 if(peakGust>=15||peakWind>=10)add(3,"強風或強陣風");
 else if(peakGust>=12||peakWind>=8)add(2,"風勢偏強");
 if(minFeels<5||maxFeels>35)add(3,"體感溫度極端");
 else if(minFeels<10||maxFeels>32)add(2,"體感溫度需留意");
 else if(minFeels<15||maxFeels>30)add(1,"體感偏冷或偏熱");
 const rankLabel=["良好","尚可","需留意","不建議"][severity];
 return {status:"scored",model:"golf-playability-overlay-v1",calibration:"thresholds-not-hindcast-validated",
  severity,grade:rankLabel,peakWindMs:Math.round(peakWind*10)/10,peakGustMs:Math.round(peakGust*10)/10,
  feelsLikeMinC:Math.round(minFeels*10)/10,feelsLikeMaxC:Math.round(maxFeels*10)/10,
  thunderstormSignal:thunderstorm,reasons:reasons.length?reasons:["未偵測到強風、極端體感或雷雨訊號"],
  windowHours:durationHours};
}
