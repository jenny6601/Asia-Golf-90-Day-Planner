import {generateTripWindows,recommendTripDates} from "./date-engine.js";
import {fetchOkinawa16DayForecast,fetchCourseForecast} from "./weather-api.js";
import {OKINAWA_COURSES} from "./okinawa-courses.js";
import {scoreGolfRainWindow,summarizeCourseRainRisks} from "./rain-risk.js";
const $=id=>document.getElementById(id);
const fmt=s=>new Intl.DateTimeFormat("zh-TW",{dateStyle:"medium",timeZone:"Asia/Tokyo"}).format(new Date(s+"T00:00:00+09:00"));
const bands={excellent:"極佳",good:"良好",caution:"需留意","not-recommended":"不建議",avoid:"極端風險"};
let latestWeather=null;
let selectedCourses=[];
let latestCourseWeather=null;
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
function cell(value,suffix=""){return value===null||value===undefined?"—":`${value}${suffix}`;}
function makeTable(headers,rows,cls="weather-table"){
 const table=document.createElement("div");table.className=cls;
 const head=document.createElement("div");head.className="weather-row weather-head";
 headers.forEach(t=>{const span=document.createElement("span");span.textContent=t;head.append(span);});table.append(head);
 rows.forEach(values=>{const row=document.createElement("div");row.className="weather-row";values.forEach(v=>{const span=document.createElement("span");span.textContent=v;row.append(span);});table.append(row);});
 return table;
}
function renderWeather(data){
 const host=$("weather-results");host.replaceChildren();
 for(const item of data.zones){
  const card=document.createElement("article");card.className="weather-card";
  const heading=document.createElement("h3");heading.textContent=`${item.zone.label}｜${item.zone.place}`;card.append(heading);
  const coords=document.createElement("p");coords.className="weather-meta";coords.textContent=`座標 ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}｜時區 ${item.timezone}`;card.append(coords);
  const rows=item.daily.time.map((date,i)=>[
   fmt(date),cell(item.daily.precipitation_probability_max?.[i],"%"),cell(item.daily.precipitation_sum?.[i]," mm"),
   `${cell(item.daily.temperature_2m_min?.[i],"°")} / ${cell(item.daily.temperature_2m_max?.[i],"°")}`,
   cell(item.daily.wind_speed_10m_max?.[i]," m/s"),cell(item.daily.wind_gusts_10m_max?.[i]," m/s")
  ]);
  card.append(makeTable(["日期","降雨機率","雨量","低 / 高溫","最大風速","最大陣風"],rows));host.append(card);
 }
}
function renderHourly(data,date){
 const teeHour=Number($("tee-hour").value);
 const host=$("hourly-results");host.replaceChildren();
 for(const item of data.zones){
  const card=document.createElement("article");card.className="weather-card";
  const heading=document.createElement("h3");heading.textContent=`${item.zone.label}｜${item.zone.place}｜${fmt(date)}`;card.append(heading);
  const h=item.hourly,indices=h.time.map((t,i)=>({t,i})).filter(x=>x.t.startsWith(date)&&Number(x.t.slice(11,13))>=6&&Number(x.t.slice(11,13))<=18);
  const risk=scoreGolfRainWindow(h,date,teeHour,6);
  const riskSummary=document.createElement("p");riskSummary.className="risk-summary";
  riskSummary.textContent=risk.status==="scored"
   ? `開球 ${String(teeHour).padStart(2,"0")}:00｜連續6小時降雨影響：${risk.label}（指數 ${risk.rainRisk}/100）｜平均逐時降雨機率 ${risk.averageHourlyRainProbability}%｜預報雨量合計 ${risk.expectedRainAmountMm} mm｜最高單時雨量 ${risk.peakHourlyRainMm} mm`
   : "資料不足：無法計算這個6小時時段的降雨影響指數。";
  card.append(riskSummary);
  const rows=indices.map(({t,i})=>[
   t.slice(11,16),cell(h.precipitation_probability?.[i],"%"),cell(h.precipitation?.[i]," mm"),
   cell(h.temperature_2m?.[i],"°C"),cell(h.apparent_temperature?.[i],"°C"),
   cell(h.wind_speed_10m?.[i]," m/s"),cell(h.wind_gusts_10m?.[i]," m/s"),
   cell(h.relative_humidity_2m?.[i],"%")
  ]);
  card.append(makeTable(["時間","降雨機率","雨量","氣溫","體感","風速","陣風","濕度"],rows,"weather-table hourly-table"));host.append(card);
 }
}
$("start-date").value=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"});
$("run").addEventListener("click",run);run();
$("fetch-weather").addEventListener("click",async()=>{
 const button=$("fetch-weather"),status=$("weather-status");
 button.disabled=true;status.textContent="正在向 Open-Meteo 讀取沖繩北、中、南三區資料…";
 try{
  latestWeather=await fetchOkinawa16DayForecast();
  renderWeather(latestWeather);
  const dateInput=$("hourly-date"),available=latestWeather.zones[0].daily.time;
  dateInput.min=available[0];dateInput.max=available.at(-1);dateInput.value=available[0];
  $("hourly-panel").hidden=false;renderHourly(latestWeather,dateInput.value);
  const stamp=new Intl.DateTimeFormat("zh-TW",{dateStyle:"short",timeStyle:"medium",timeZone:"Asia/Tokyo"}).format(new Date(latestWeather.fetchedAt));
  status.textContent=`讀取成功｜${latestWeather.provider}｜${latestWeather.forecastDays}天｜讀取時間（日本時間）：${stamp}｜三區均有回傳`;
 }catch(error){status.textContent=`讀取失敗：${error.message}。沒有使用合成資料代替。`;}
 finally{button.disabled=false;}
});
$("hourly-date").addEventListener("change",()=>{if(latestWeather)renderHourly(latestWeather,$("hourly-date").value);});

function renderCoursePicker(){
 const host=$("course-picker");host.replaceChildren();
 for(const course of OKINAWA_COURSES){
  const label=document.createElement("label");label.className="course-option";
  const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.value=course.id;
  checkbox.checked=selectedCourses.some(x=>x.id===course.id);
  checkbox.disabled=course.coordinateStatus==="pending" || (!checkbox.checked && selectedCourses.length>=3);
  checkbox.addEventListener("change",()=>{
   selectedCourses=OKINAWA_COURSES.filter(x=>host.querySelector(`input[value="${x.id}"]`)?.checked);
   $("course-selection-status").textContent=`已選擇 ${selectedCourses.length} / 3 個球場`;
   $("fetch-course-weather").disabled=selectedCourses.length===0;
   renderCoursePicker();
  });
  const info=document.createElement("span");
  const title=document.createElement("strong");title.textContent=`${course.name}（${course.area}）`;
  const sub=document.createElement("small");sub.textContent=course.coordinateStatus==="pending"?"GPS 待核實｜暫不可查詢":`${course.latitude.toFixed(5)}, ${course.longitude.toFixed(5)}｜座標待現地/官方圖資複核`;
  const addr=document.createElement("small");addr.textContent=course.address;
  info.append(title,sub,addr);label.append(checkbox,info);host.append(label);
 }
}
function renderCourseWeather(data){
 const host=$("course-weather-results");host.replaceChildren();
 for(const item of data.courses){
  const card=document.createElement("article");card.className="weather-card";
  const h=document.createElement("h3");h.textContent=`${item.course.name}｜${item.course.area}`;card.append(h);
  const meta=document.createElement("p");meta.className="weather-meta";meta.textContent=`GPS ${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}｜${item.timezone}`;card.append(meta);
  const rows=item.daily.time.map((date,i)=>[
   fmt(date),cell(item.daily.precipitation_probability_max?.[i],"%"),cell(item.daily.precipitation_sum?.[i]," mm"),
   `${cell(item.daily.temperature_2m_min?.[i],"°")} / ${cell(item.daily.temperature_2m_max?.[i],"°")}`,
   cell(item.daily.wind_speed_10m_max?.[i]," m/s"),cell(item.daily.wind_gusts_10m_max?.[i]," m/s")
  ]);
  card.append(makeTable(["日期","降雨機率","雨量","低 / 高溫","最大風速","最大陣風"],rows));host.append(card);
 }
}

function runCourseComparison(){
 if(!latestCourseWeather?.courses?.length)return;
 const date=$("compare-date").value,teeHour=Number($("compare-tee-hour").value);
 const results=latestCourseWeather.courses.map(item=>({
  course:item.course,
  score:scoreGolfRainWindow(item.hourly,date,teeHour,6)
 }));
 const summary=summarizeCourseRainRisks(results);
 const valid=results.filter(x=>x.score.status==="scored");
 const host=$("comparison-results");host.replaceChildren();
 const sorted=[...valid].sort((a,b)=>a.score.rainRisk-b.score.rainRisk);
 for(const item of sorted){
  const card=document.createElement("article");card.className="weather-card";
  const h=document.createElement("h3");h.textContent=`${item.course.name}｜${item.course.area}`;card.append(h);
  const risk=document.createElement("p");risk.className="risk-summary";
  risk.textContent=`降雨影響：${item.score.label}｜${item.score.rainRisk}/100`;card.append(risk);
  const detail=document.createElement("p");
  detail.textContent=`平均逐時降雨機率 ${item.score.averageHourlyRainProbability}%｜六小時預報雨量 ${item.score.expectedRainAmountMm} mm｜最高單時雨量 ${item.score.peakHourlyRainMm} mm｜濕時數 ${item.score.wetHours}/6`;
  card.append(detail);
  const note=document.createElement("p");note.className="weather-meta";note.textContent=`預報日期 ${fmt(date)}｜開球 ${String(teeHour).padStart(2,"0")}:00｜資料可信度尚未獨立校準｜GPS ${item.course.coordinateStatus==="provisional"?"暫定":"待核實"}`;card.append(note);
  host.append(card);
 }
 const avg=valid.length?valid.reduce((s,x)=>s+x.score.rainRisk,0)/valid.length:null;
 const worst=valid.length?Math.max(...valid.map(x=>x.score.rainRisk)):null;
 const best=sorted[0];
 $("comparison-status").textContent=summary.scoredCount===summary.requestedCount
  ? `比較完成｜${summary.scoredCount} 個球場｜平均風險指數 ${summary.averageRisk}｜最差球場風險 ${summary.worstRisk}｜最低風險：${best.course.name}`
  : `僅 ${summary.scoredCount}/${summary.requestedCount} 個球場有完整六小時資料；不以缺值當作零風險。`;
}
$("compare-courses").addEventListener("click",runCourseComparison);
$("compare-tee-hour").addEventListener("change",()=>{if(latestCourseWeather)runCourseComparison();});
$("compare-date").addEventListener("change",()=>{if(latestCourseWeather)runCourseComparison();});

renderCoursePicker();
$("fetch-course-weather").addEventListener("click",async()=>{
 const button=$("fetch-course-weather"),status=$("course-weather-status");
 button.disabled=true;status.textContent="正在依所選球場 GPS 讀取預報…";
 try{
  latestCourseWeather=await fetchCourseForecast(selectedCourses);
  renderCourseWeather(latestCourseWeather);
  const commonDates=latestCourseWeather.courses.map(x=>new Set(x.hourly.time.map(t=>t.slice(0,10))));
  const available=[...commonDates[0]].filter(d=>commonDates.every(set=>set.has(d))).sort();
  const dateInput=$("compare-date");
  if(available.length){
   dateInput.min=available[0];dateInput.max=available.at(-1);dateInput.value=available[0];dateInput.disabled=false;
   $("compare-courses").disabled=false;
   $("comparison-status").textContent=`可比較日期：${available[0]} 至 ${available.at(-1)}｜${available.length} 天共同資料`;
  }else{
   dateInput.disabled=true;$("compare-courses").disabled=true;
   $("comparison-status").textContent="所選球場沒有共同逐時預報日期，暫時無法公平比較。";
  }
  const stamp=new Intl.DateTimeFormat("zh-TW",{dateStyle:"short",timeStyle:"medium",timeZone:"Asia/Tokyo"}).format(new Date(latestCourseWeather.fetchedAt));
  status.textContent=`成功｜${latestCourseWeather.courses.length} 個球場｜16天｜讀取時間（日本時間）：${stamp}`;
 }catch(error){status.textContent=`讀取失敗：${error.message}`;}
 finally{button.disabled=selectedCourses.length===0;}
});

$("tee-hour").addEventListener("change",()=>{if(latestWeather)renderHourly(latestWeather,$("hourly-date").value);});
