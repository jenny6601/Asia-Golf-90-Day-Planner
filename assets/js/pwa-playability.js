/**
 * Taiwan Golf Weather PWA-style six-hour playability score.
 * Inputs use Open-Meteo units: wind speed in m/s, precipitation in mm.
 * This is a transparent decision aid, not a statistically calibrated forecast.
 */
const valid = value => typeof value === "number" && Number.isFinite(value);
const mean = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
const max = values => values.length ? Math.max(...values) : null;
const sum = values => values.length ? values.reduce((a,b)=>a+b,0) : null;
const clamp = value => Math.max(0,Math.min(100,value));

function grade(score) {
  if (score === null) return {grade:"—",label:"資料不足"};
  if (score >= 90) return {grade:"A",label:"非常適合"};
  if (score >= 80) return {grade:"B",label:"適合"};
  if (score >= 65) return {grade:"C",label:"尚可，需留意"};
  if (score >= 50) return {grade:"D",label:"不佳，宜審慎"};
  return {grade:"E",label:"不適合"};
}
function temperatureScore(feels) {
  const t=mean(feels);
  if(t===null)return null;
  if(t>=20&&t<=27)return 100;
  if((t>=15&&t<20)||(t>27&&t<=30))return 80;
  if((t>=10&&t<15)||(t>30&&t<=33))return 60;
  return 30;
}
function rainScore(probabilities, amounts) {
  const parts=[];
  const highest=max(probabilities),total=sum(amounts);
  if(highest!==null)parts.push({score:clamp(100-highest),weight:.6});
  if(total!==null)parts.push({score:total<=0?100:total<=1?80:total<=3?60:total<=5?35:0,weight:.4});
  return parts.length?parts.reduce((s,p)=>s+p.score*p.weight,0)/parts.reduce((s,p)=>s+p.weight,0):null;
}
export function scorePwaStylePlayability(hourly,date,teeHour,durationHours=6) {
  if(!hourly||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!Number.isInteger(teeHour)||teeHour<0||teeHour>23||!Number.isInteger(durationHours)||durationHours<1||durationHours>12)throw new TypeError("Invalid hourly data, date, teeHour or durationHours");
  const indexes=[];
  for(let h=0;h<durationHours;h++){
    const target=date+"T"+String(teeHour+h).padStart(2,"0")+":00";
    const i=(hourly.time||[]).indexOf(target);
    if(i<0)return {status:"insufficient-data",missingHour:target};
    indexes.push(i);
  }
  const values=field=>indexes.map(i=>hourly[field]?.[i]).filter(valid);
  const probabilities=values("precipitation_probability"),amounts=values("precipitation");
  const winds=values("wind_speed_10m"),gusts=values("wind_gusts_10m"),feels=values("apparent_temperature"),codes=values("weather_code");
  const rain=rainScore(probabilities,amounts);
  const avgWind=mean(winds),peakGust=max(gusts);
  const windParts=[];
  if(avgWind!==null)windParts.push({score:clamp(100-Math.max(0,avgWind*3.6-10)*3.33),weight:.5});
  if(peakGust!==null)windParts.push({score:clamp(100-Math.max(0,peakGust*3.6-20)*2.5),weight:.5});
  const wind=windParts.length?windParts.reduce((s,p)=>s+p.score*p.weight,0)/windParts.reduce((s,p)=>s+p.weight,0):null;
  const temp=temperatureScore(feels);
  let stability=null;
  if(codes.length){
    const transitions=codes.slice(1).reduce((s,v,i)=>s+(v!==codes[i]?1:0),0);
    const severe=codes.filter(v=>[95,96,99].includes(v)).length;
    const rainy=codes.filter(v=>[51,53,55,56,57,61,63,65,66,67,80,81,82].includes(v)).length;
    stability=clamp(100-(transitions/Math.max(1,codes.length-1))*35-(rainy/codes.length)*20-(severe/codes.length)*70);
  }
  const parts=[
    {key:"rain",label:"降雨風險",weight:60,value:rain,detail:"最高降雨機率 "+(max(probabilities)===null?"—":Math.round(max(probabilities))+"%")+"｜累積雨量 "+(sum(amounts)===null?"—":sum(amounts).toFixed(1)+" mm")},
    {key:"wind",label:"風速與陣風",weight:15,value:wind,detail:"平均風速 "+(avgWind===null?"—":(avgWind*3.6).toFixed(1)+" km/h")+"｜最大陣風 "+(peakGust===null?"—":(peakGust*3.6).toFixed(1)+" km/h")},
    {key:"temperature",label:"氣溫與體感",weight:15,value:temp,detail:"平均體感 "+(mean(feels)===null?"—":mean(feels).toFixed(1)+"°C")},
    {key:"stability",label:"天氣穩定度",weight:10,value:stability,detail:codes.length?"依逐時天氣現象變化評估":"天氣現象資料不足"}
  ];
  const available=parts.filter(p=>p.value!==null),weight=available.reduce((s,p)=>s+p.weight,0);
  const applicableWeight=100;
  const score=weight?Math.round(available.reduce((s,p)=>s+p.value*p.weight,0)/weight):null;
  const weightCoverage=applicableWeight?Math.round(weight/applicableWeight*100):0;
  const totalRain=sum(amounts),thunder=codes.some(v=>[95,96,99].includes(v));
  const dangerousWind=(avgWind!==null&&avgWind*3.6>=25)||(peakGust!==null&&peakGust*3.6>=40);
  let safety=null;
  if(thunder)safety={grade:"E",label:"雷雨警示｜不建議下場",reason:"預報時段出現雷雨訊號，安全警示優先於分數。"};
  else if((totalRain!==null&&totalRain>=5)||dangerousWind)safety={grade:"D",label:"安全警示｜不宜下場",reason:(totalRain!==null&&totalRain>=5?"預報累積雨量達5 mm以上。 ":"")+(dangerousWind?"風速或陣風達安全警示門檻。":"")};
  const finalGrade=safety?safety.grade:grade(score).grade;
  const labels={A:"非常適合",B:"適合",C:"尚可，需留意",D:"不佳，宜審慎",E:"不適合"};
  const alerts=[];
  if(thunder)alerts.push("預報出現雷雨訊號，請暫緩下場並遵循球場及官方即時警示。");
  if(totalRain!==null&&totalRain>=5)alerts.push("六小時累積雨量達5 mm以上，留意球道濕滑及球場公告。");
  if(avgWind!==null&&avgWind*3.6>=25)alerts.push("平均風速達25 km/h，球路及擊球距離可能受影響。");
  if(peakGust!==null&&peakGust*3.6>=40)alerts.push("最大陣風達40 km/h，注意擊球穩定與現場安全。");
  if(max(probabilities)!==null&&max(probabilities)>=30)alerts.push("至少一小時降雨機率達30%，建議攜帶雨具。");
  if(mean(feels)!==null&&mean(feels)<=10)alerts.push("平均體感溫度達10°C以下，屬極低溫，建議評估延後開球並加強保暖。");
  else if(mean(feels)!==null&&mean(feels)<=15)alerts.push("平均體感溫度達15°C以下，屬低溫，建議分層穿著並充分暖身。");
  if(mean(feels)!==null&&max(feels)>30)alerts.push("部分時段體感超過30°C，注意補水與防曬。");
  if(!alerts.length)alerts.push("目前逐時資料未顯示明顯降雨、強風或雷雨警訊；出發前仍請確認最新預報。");
  return {status:"scored",model:"taiwan-pwa-v32-playability-baseline",calibration:"not-hindcast-calibrated",score,grade:finalGrade,label:safety?.label||labels[finalGrade],safety,weightCoverage,parts,alerts,windowHours:durationHours,weather:{precipitationProbabilityMin:probabilities.length?Math.min(...probabilities):null,precipitationProbabilityMax:max(probabilities),rainfallMm:totalRain,feelsLikeMinC:feels.length?Math.min(...feels):null,feelsLikeMaxC:max(feels),averageWindKmh:avgWind===null?null:avgWind*3.6,peakGustKmh:peakGust===null?null:peakGust*3.6,thunderstormSignal:thunder}};
}
