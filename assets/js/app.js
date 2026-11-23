import {generateTripWindows,recommendTripDates} from "./date-engine.js";
import {fetchOkinawa16DayForecast} from "./weather-api.js";
const $=id=>document.getElementById(id);
const fmt=s=>new Intl.DateTimeFormat("zh-TW",{dateStyle:"medium",timeZone:"Asia/Tokyo"}).format(new Date(s+"T00:00:00+09:00"));
const bands={excellent:"極佳",good:"良好",caution:"需留意","not-recommended":"不建議",avoid:"極端風險"};
function syntheticInputs(startDate,horizonDays){
 const windows=generateTripWindows({startDate,horizonDays}),dates=new Set();
 windows.forEach(w=>[w.tripStart,w.tripEnd,...w.golfDates].forEach(d=>dates.add(d)));
 const data={};
 for(const date of dates){
  const n=Math.round((Date.parse(date+"T00:00:00Z")-Date.parse(startDate+"T00:00:00Z"))/86400000),wave=(Math.sin(n/7)+1)/2;
  data[date]={rainRisk:Math.min(100,18+wave*35+(n*13%17)),windRisk:15+n*7%30,thermalRisk:20+n*3%25,severeRisk:n%29===0?92:5+n*5%25,dataCompleteness:n<7?.95:n<16?.8:n<46?.55:.25};
 }
 return data;
}
function run(){
 const startDate=$("start-date").value,horizonDays=Number($("horizon").value),dailyInputs=syntheticInputs(startDate,horizonDays);
 const result=recommendTripDates({startDate,horizonDays,dailyInputs});
 $("counts").textContent=`候選行程 ${result.candidateCount} 組｜已評分 ${result.scoredCount} 組｜資料不足 ${result.missingCount} 組`;
 $("recommendations").innerHTML=result.recommendations.map(x=>`<article class="result-card"><div class="rank">推薦 #${x.recommendationRank}</div><div class="score">${x.score.toFixed(1)}<small>/100</small></div><h3>${fmt(x.tripStart)} – ${fmt(x.tripEnd)}</h3><p>打球：${x.golfDates.map(fmt).join("、")}</p><p>評級：${bands[x.band]}｜資料完整度：${x.confidenceCompleteness}%（${x.confidence}）</p><p>最弱打球日：${x.worstGolfDaySuitability.toFixed(1)} 分</p></article>`).join("")||"<p>沒有符合條件的推薦日期。</p>";
}
function cell(value, suffix="") { return value === null || value === undefined ? "—" : `${value}${suffix}`; }
function renderWeather(data) {
 const host=$("weather-results"); host.replaceChildren();
 for (const item of data.zones) {
  const card=document.createElement("article"); card.className="weather-card";
  const heading=document.createElement("h3"); heading.textContent=`${item.zone.label}｜${item.zone.place}`; card.append(heading);
  const coords=document.createElement("p"); coords.className="weather-meta"; coords.textContent=`座標 ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}｜時區 ${item.timezone}`; card.append(coords);
  const table=document.createElement("div"); table.className="weather-table";
  const header=document.createElement("div"); header.className="weather-row weather-head";
  ["日期","降雨機率","雨量","氣溫","最大風速"].forEach(t=>{const span=document.createElement("span");span.textContent=t;header.append(span);}); table.append(header);
  item.daily.time.forEach((date,i)=>{
   const row=document.createElement("div");row.className="weather-row";
   const vals=[
    fmt(date),
    cell(item.daily.precipitation_probability_max?.[i],"%"),
    cell(item.daily.precipitation_sum?.[i]," mm"),
    `${cell(item.daily.temperature_2m_min?.[i],"°")} / ${cell(item.daily.temperature_2m_max?.[i],"°")}`,
    cell(item.daily.wind_speed_10m_max?.[i]," m/s")
   ];
   vals.forEach(v=>{const span=document.createElement("span");span.textContent=v;row.append(span);});table.append(row);
  });
  card.append(table);host.append(card);
 }
}
$("start-date").value=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"});
$("run").addEventListener("click",run);run();
$("fetch-weather").addEventListener("click",async()=>{
 const button=$("fetch-weather"),status=$("weather-status");
 button.disabled=true;status.textContent="正在向 Open-Meteo 讀取沖繩北、中、南三區資料…";
 try{
  const data=await fetchOkinawa16DayForecast();
  renderWeather(data);
  const stamp=new Intl.DateTimeFormat("zh-TW",{dateStyle:"short",timeStyle:"medium",timeZone:"Asia/Tokyo"}).format(new Date(data.fetchedAt));
  status.textContent=`讀取成功｜${data.provider}｜${data.forecastDays}天｜資料讀取時間（日本時間）：${stamp}｜三區均有回傳`;
 }catch(error){
  status.textContent=`讀取失敗：${error.message}。請稍後重試；目前沒有使用合成資料代替。`;
 }finally{button.disabled=false;}
});
