import {recommendFiveDayWindows} from "./itinerary-engine.js";
import {fetchOkinawa16DayForecast,fetchCourseForecast} from "./weather-api.js";
import {getDestinations,getDestination,getCoursesForCountry,getCourseCoverage} from "./destination-catalog.js";
import {scoreGolfRainWindow,summarizeCourseRainRisks} from "./rain-risk.js";
import {scoreFiveDayItinerary} from "./itinerary-engine.js";
import {fetchOkinawaLongRange,interpretPrecipitationEfi} from "./long-range-api.js";
import {classifyForecastConfidence} from "./confidence-engine.js";
import {recommendLongRangeWindows} from "./long-range-engine.js";
import {combineHorizonRecommendations} from "./horizon-integration.js";
const $=id=>document.getElementById(id);
const fmt=s=>new Intl.DateTimeFormat("zh-TW",{dateStyle:"medium",timeZone:"Asia/Tokyo"}).format(new Date(s+"T00:00:00+09:00"));
const bands={excellent:"極佳",good:"良好",caution:"需留意","not-recommended":"不建議",avoid:"極端風險"};
let activeCountry="JP";
let latestWeather=null;
let selectedCourses=[];
let latestCourseWeather=null;
let latestLongRangeData=null;
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


function renderDestinations(){
 const host=$("destination-grid");host.replaceChildren();
 for(const item of getDestinations()){
  const button=document.createElement("button");button.type="button";
  button.className="destination-card"+(item.code===activeCountry?" is-active":"");
  button.setAttribute("aria-pressed",String(item.code===activeCountry));
  const flag=document.createElement("span");flag.className="destination-flag";flag.textContent=item.flag;
  const name=document.createElement("strong");name.textContent=item.name;
  const state=document.createElement("small");state.textContent=item.label;
  button.append(flag,name,state);
  button.addEventListener("click",()=>selectDestination(item.code));
  host.append(button);
 }
}
function selectDestination(countryCode){
 const destination=getDestination(countryCode);if(!destination)return;
 activeCountry=countryCode;
 selectedCourses=[];latestCourseWeather=null;latestLongRangeData=null;
 document.querySelectorAll("[data-country-scope]").forEach(node=>{node.hidden=countryCode!=="JP";});
 $("destination-status").textContent=destination.code==="JP"
  ?"日本｜沖繩為第一個可操作試點；其他日本地區待逐步加入。"
  :`${destination.flag} ${destination.name}｜目前尚無完成 GPS 與時區核實的球場資料，暫不開放預報及日期評分。`;
 const empty=$("destination-empty");empty.hidden=destination.code==="JP";
 empty.textContent=destination.code==="JP"?"":`${destination.name}目的地模組已建立入口。下一步將加入城市／區域、官方球場資料、座標來源與 IANA 時區；在資料完成前不顯示假預報或假推薦。`;
 $("course-selection-status").textContent="已選擇 0 / 3 個球場";
 $("fetch-course-weather").disabled=true;
 $("run-unified-recommendations").disabled=true;
 $("course-weather-status").textContent="尚未讀取球場天氣。";
 $("course-weather-results").replaceChildren();
 $("live-date-recommendations").replaceChildren();
 $("live-date-status").textContent="尚未進行真實日期推薦。";
 $("unified-recommendations").replaceChildren();
 $("unified-recommendation-status").textContent="請先選擇三座球場。";
 renderDestinations();renderCoursePicker();
}

function renderCoursePicker(){
 const host=$("course-picker");host.replaceChildren();
 const courses=getCoursesForCountry(activeCountry);
 if(!courses.length){const empty=document.createElement("p");empty.className="destination-empty";empty.textContent=`${getDestination(activeCountry)?.name??"此目的地"}的球場清單尚在建置。完成球場名稱、官方地址、GPS 座標與 IANA 時區核實後，才會開放天氣查詢。`;host.append(empty);return;}
 for(const course of getCoursesForCountry(activeCountry)){
  const label=document.createElement("label");label.className="course-option";
  const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.value=course.id;
  checkbox.checked=selectedCourses.some(x=>x.id===course.id);
  checkbox.disabled=course.coordinateStatus==="pending" || (!checkbox.checked && selectedCourses.length>=3);
  checkbox.addEventListener("change",()=>{
   if(checkbox.checked){selectedCourses.push(course);}else{selectedCourses=selectedCourses.filter(x=>x.id!==course.id);}
   latestCourseWeather=null;$("run-unified-recommendations").disabled=selectedCourses.length!==3;
   $("course-weather-status").textContent="球場選擇已變更，請重新讀取逐時預報。";
   $("course-selection-status").textContent=`已選擇 ${selectedCourses.length} / 3 個球場`;
   $("fetch-course-weather").disabled=selectedCourses.length===0;
   renderCoursePicker();
  });
  const info=document.createElement("span");
  const title=document.createElement("strong");title.textContent=`${course.name}（${course.area}）`;
  const sub=document.createElement("small");sub.textContent=course.coordinateStatus==="pending"?"GPS 待核實｜暫不可查詢":`${course.latitude.toFixed(5)}, ${course.longitude.toFixed(5)}｜第三方地圖暫定，待官方圖資複核`;
  const addr=document.createElement("small");addr.textContent=course.address;
  info.append(title,sub,addr);label.append(checkbox,info);host.append(label);
 }
}
function renderCourseWeather(data){
 const host=$("course-weather-results");host.replaceChildren();
 for(const item of data.courses){
  const card=document.createElement("article");card.className="weather-card";
  const h=document.createElement("h3");h.textContent=`${item.course.name}｜${item.course.area}`;card.append(h);
  const meta=document.createElement("p");meta.className="weather-meta";
  const audit=item.coordinateAudit;
  meta.textContent="輸入球場座標 "+audit.requested.latitude.toFixed(5)+", "+audit.requested.longitude.toFixed(5)+"｜預報網格座標 "+audit.providerGrid.latitude.toFixed(5)+", "+audit.providerGrid.longitude.toFixed(5)+"｜網格偏移 "+(audit.gridOffsetKm===null?"—":audit.gridOffsetKm+" km")+"｜海拔 "+(item.elevation??"—")+" m｜"+item.timezone;
  card.append(meta);
  const quality=document.createElement("p");quality.className="data-note";
  quality.textContent="座標來源："+audit.source+"｜狀態："+(audit.coordinateStatus==="provisional"?"第三方地圖暫定，尚未官方界線核實":audit.coordinateStatus)+"。網格偏移只反映氣象模式格點與輸入座標的距離，不代表球場 GPS 正確性。";
  card.append(quality);
  if(audit.sourceUrl){const link=document.createElement("a");link.href=audit.sourceUrl;link.target="_blank";link.rel="noopener";link.textContent="查看座標來源";card.append(link);}
  const rows=item.daily.time.map((date,i)=>[
   fmt(date),cell(item.daily.precipitation_probability_max?.[i],"%"),cell(item.daily.precipitation_sum?.[i]," mm"),
   `${cell(item.daily.temperature_2m_min?.[i],"°")} / ${cell(item.daily.temperature_2m_max?.[i],"°")}`,
   cell(item.daily.wind_speed_10m_max?.[i]," m/s"),cell(item.daily.wind_gusts_10m_max?.[i]," m/s")
  ]);
  card.append(makeTable(["日期","降雨機率","雨量","低 / 高溫","最大風速","最大陣風"],rows));host.append(card);
 }
}


function populateItineraryStartDates(){
 const select=$("itinerary-start");select.replaceChildren();
 if(!latestCourseWeather?.courses || selectedCourses.length!==3){
  select.disabled=true;select.add(new Option("請先選擇三個球場並讀取預報",""));return;
 }
 const startSet=new Set(latestCourseWeather.courses[0].hourly.time.map(t=>t.slice(0,10)));
 const lastDates=latestCourseWeather.courses.map(x=>new Set(x.hourly.time.map(t=>t.slice(0,10))));
 const candidates=[...startSet].sort().filter(start=>{
  const golfDates=[1,2,3].map(n=>new Date(Date.parse(start+"T00:00:00Z")+n*86400000).toISOString().slice(0,10));
  return lastDates.every(set=>golfDates.every(d=>set.has(d)));
 });
 const valid=candidates.filter(start=>scoreFiveDayItinerary({
  tripStart:start,teeHour:Number($("itinerary-tee-hour").value),
  courses:latestCourseWeather.courses
 }).status==="scored");
 if(!valid.length){
  select.disabled=true;select.add(new Option("目前預報範圍內沒有完整五天行程",""));$("score-itinerary").disabled=true;return;
 }
 valid.forEach(start=>select.add(new Option(`${fmt(start)} 出發｜${fmt(new Date(Date.parse(start+"T00:00:00Z")+4*86400000).toISOString().slice(0,10))} 返回`,start)));
 select.value=valid[0];select.disabled=false;$("score-itinerary").disabled=false;
}
function renderItinerary(){
 const status=$("itinerary-status"),host=$("itinerary-results");host.replaceChildren();
 if(!latestCourseWeather || selectedCourses.length!==3){
  status.textContent="請先選擇三個球場並成功讀取預報。";return;
 }
 const result=scoreFiveDayItinerary({
  tripStart:$("itinerary-start").value,
  teeHour:Number($("itinerary-tee-hour").value),
  courses:latestCourseWeather.courses
 });
 if(result.status!=="scored"){
  status.textContent=result.message;return;
 }
 const card=document.createElement("article");card.className="weather-card";
 const heading=document.createElement("h3");heading.textContent=`五天四夜｜${fmt(result.tripStart)} – ${fmt(result.tripEnd)}`;card.append(heading);
 const score=document.createElement("p");score.className="risk-summary";score.textContent=`整趟三場球降雨影響：${result.label}｜${result.itineraryRisk}/100`;card.append(score);
 const summary=document.createElement("p");summary.textContent=`三場平均風險 ${result.averageRoundRisk}｜最差一場 ${result.worstRoundRisk}｜每日開球 ${String(result.teeHour).padStart(2,"0")}:00`;card.append(summary);
 const rows=result.rounds.map(x=>[
  `Day ${x.round+1}｜${fmt(x.date)}`,
  x.courseName,
  x.score.label,
  `${x.score.rainRisk}/100`,
  `${x.score.averageHourlyRainProbability}%`,
  `${x.score.expectedRainAmountMm} mm`,
  x.suitability?.status==="scored"?x.suitability.grade:"適打資料不足"
 ]);
 card.append(makeTable(["日期","球場","降雨風險","指數","平均逐時機率","六小時雨量","適打性"],rows));
 const travel=document.createElement("p");travel.className="weather-meta";travel.textContent=`Day 1 ${fmt(result.travelDays[0].date)}：交通日（未納入風險分數）｜Day 5 ${fmt(result.travelDays[1].date)}：交通日（未納入風險分數）`;card.append(travel);
 const conditions=document.createElement("p");conditions.textContent="適打性觀察："+result.rounds.map(x=>x.suitability?.status==="scored"?`${x.courseName}：${x.suitability.grade}（${x.suitability.reasons.join("、")}）`:`${x.courseName}：風勢／體感／雷雨資料不足`).join("；");card.append(conditions);
 const worst=document.createElement("p");worst.textContent=`最需留意：Day ${result.worstRound.round+1}｜${result.worstRound.courseName}（${result.worstRound.risk}/100）`;card.append(worst);
 host.append(card);
 status.textContent="評估完成｜使用三個球場各自 GPS 的真實逐時預報｜僅評估打球日；交通日未計分。";
}
$("score-itinerary").addEventListener("click",renderItinerary);

function renderLiveDateRecommendations(){
 const host=$("live-date-recommendations"),status=$("live-date-status");host.replaceChildren();
 if(!latestCourseWeather?.courses||selectedCourses.length!==3){status.textContent="請先選擇三個球場並成功讀取球場逐時預報。";return;}
 const result=recommendFiveDayWindows({courses:latestCourseWeather.courses,teeHour:Number($("itinerary-tee-hour").value),limit:3,minStartGap:5});
 status.textContent=result.recommendations.length?`真實預報評估 ${result.candidateCount} 個候選出發日｜完整評分 ${result.scoredCount} 組｜推薦 ${result.recommendations.length} 組`:"目前資料範圍內沒有三場均具完整六小時資料的五天行程；不以合成資料補足。";
 for(const item of result.recommendations){
  const card=document.createElement("article");card.className="weather-card";
  const h=document.createElement("h3");h.textContent=`推薦 #${item.recommendationRank}｜${fmt(item.tripStart)} – ${fmt(item.tripEnd)}`;card.append(h);
  const score=document.createElement("p");score.className="risk-summary";score.textContent=`三場球降雨影響指數：${item.itineraryRisk}/100（${item.label}）`;card.append(score);
  const p=document.createElement("p");p.textContent=`Day 2–4：${item.rounds.map(x=>fmt(x.date)+" "+x.courseName+"（降雨 "+x.score.rainRisk+"/100；適打 "+(x.suitability?.status==="scored"?x.suitability.grade:"資料不足")+"）").join("；")}`;card.append(p);
  const c=document.createElement("p");c.className="weather-meta";c.textContent="可信度：中等（未校準）｜16天逐時預報｜尚未完成沖繩歷史回測；此指數不是取消球賽機率。";card.append(c);host.append(card);
 }
}
$("recommend-live-dates").addEventListener("click",renderLiveDateRecommendations);

$("itinerary-tee-hour").addEventListener("change",()=>{populateItineraryStartDates();});

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



function renderUnifiedRecommendations(){
 const host=$("unified-recommendations"),status=$("unified-recommendation-status");host.replaceChildren();
 if(!latestCourseWeather?.courses||selectedCourses.length!==3||!latestLongRangeData){
  status.textContent="請先選擇三個球場，分別完成球場16天預報及沖繩17–90天長期展望讀取。";return;
 }
 const referenceDate=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"});
 const shortRange=recommendFiveDayWindows({courses:latestCourseWeather.courses,teeHour:Number($("itinerary-tee-hour").value),limit:3,minStartGap:5});
 const longRange=recommendLongRangeWindows({referenceDate,points:latestLongRangeData.points,limit:3,minStartGap:5});
 const combined=combineHorizonRecommendations({shortRange,longRange,shortFetchedAt:latestCourseWeather.fetchedAt,longFetchedAt:latestLongRangeData.fetchedAt});
 status.textContent=`整合完成｜短期可評估 ${shortRange.scoredCount} 組，長期可評估 ${longRange.scoredCount} 組。短期與長期分開排序。`;
 for(const group of [combined.shortRange,combined.longRange]){
  const section=document.createElement("section");section.className="weather-card";
  const heading=document.createElement("h3");heading.textContent=group===combined.shortRange?"1–16天｜真實球場逐時預報推薦":"17–90天｜ECMWF季節趨勢候選";section.append(heading);
  const meaning=document.createElement("p");meaning.className="weather-meta";meaning.textContent=group.meaning;section.append(meaning);
  if(!group.items.length){const empty=document.createElement("p");empty.textContent="目前沒有完整資料支持的候選日期。";section.append(empty);}
  for(const item of group.items){
   const card=document.createElement("article");card.className="weather-card";
   const h=document.createElement("h4");h.textContent=`第 ${item.rank} 順位｜${fmt(item.tripStart)} – ${fmt(item.tripEnd)}`;card.append(h);
   const score=document.createElement("p");score.className="risk-summary";
   score.textContent=item.kind==="short-range"?`降雨影響指數 ${item.value}/100（${item.label}）`:`區域濕潤趨勢：${item.label}（分級 ${item.value}/3）`;
   card.append(score);
   const rounds=document.createElement("p");rounds.textContent=item.rounds.map(r=>item.kind==="short-range"?`${r.date} ${r.courseName}：降雨 ${r.value}/100；適打 ${r.suitability?.status==="scored"?r.suitability.grade:"資料不足"}`:`${r.date} ${r.zone}最需留意：${r.label}`).join("；");card.append(rounds);
   const note=document.createElement("p");note.className="weather-meta";note.textContent=`可信度：${item.confidence}｜資料：${item.source}`;card.append(note);section.append(card);
  }
  host.append(section);
 }
 const note=document.createElement("p");note.className="data-note";note.textContent=combined.note;host.append(note);
}
async function runAllHorizonRecommendations(){
 const button=$("run-unified-recommendations"),status=$("unified-recommendation-status");
 if(selectedCourses.length!==3){status.textContent="請先選擇三座球場。";return;}
 button.disabled=true;
 status.textContent="正在同步讀取三座球場短期預報與 EC46／SEAS5 長期展望…";
 try{
  const [courseData,longData]=await Promise.all([
   latestCourseWeather?.courses?.length?Promise.resolve(latestCourseWeather):fetchCourseForecast(selectedCourses),
   latestLongRangeData?Promise.resolve(latestLongRangeData):fetchOkinawaLongRange()
  ]);
  latestCourseWeather=courseData;
  latestLongRangeData=longData;
  renderCourseWeather(latestCourseWeather);
  renderLongRange(latestLongRangeData);
  populateItineraryStartDates();
  renderUnifiedRecommendations();
 }catch(error){
  status.textContent="讀取失敗："+error.message+"。沒有以合成資料代替。";
 }finally{
  button.disabled=selectedCourses.length!==3;
 }
}
$("run-unified-recommendations").addEventListener("click",runAllHorizonRecommendations);

function renderLongRange(data){
 const host=$("long-range-results");host.replaceChildren();
 for(const item of data.points){
  const card=document.createElement("article");card.className="weather-card";
  const heading=document.createElement("h3");heading.textContent=`${item.point.label}｜${item.point.place}`;card.append(heading);
  const meta=document.createElement("p");meta.className="weather-meta";meta.textContent=`ECMWF Seasonal Seamless｜座標 ${item.latitude.toFixed(3)}, ${item.longitude.toFixed(3)}｜${item.timezone}`;card.append(meta);
  const audit=document.createElement("p");audit.className="data-note";
  const q=item.dataQuality;
  audit.textContent=`資料檢核｜週資料 ${q?.weekly?.count??0} 筆（EFI ${q?.weekly?.fields?.precipitation_efi?.validCount??0} 筆有效）｜月資料 ${q?.monthly?.count??0} 筆（平均雨量 ${q?.monthly?.fields?.precipitation_mean?.validCount??0} 筆有效、雨量距平 ${q?.monthly?.fields?.precipitation_anomaly?.validCount??0} 筆有效）`;
  card.append(audit);
  if(q?.warnings?.length){const warning=document.createElement("p");warning.className="data-note";warning.textContent="資料警示："+q.warnings.join("；");card.append(warning);}
  const weekly=item.weekly;
  if(weekly?.time?.length){
   const title=document.createElement("h4");title.textContent="週趨勢（次季節展望）";card.append(title);
   const rows=weekly.time.map((date,i)=>{
    const efi=interpretPrecipitationEfi(weekly.precipitation_efi?.[i]);
    const confidence=classifyForecastConfidence({validDate:date,referenceDate:new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"}),temporalResolution:"weekly"});
    return [date,cell(weekly.precipitation_mean?.[i]," mm"),cell(weekly.precipitation_anomaly?.[i]," mm"),cell(weekly.precipitation_efi?.[i]),efi.label,confidence.label,cell(weekly.wind_speed_10m_mean?.[i]," m/s"),cell(weekly.temperature_2m_mean?.[i],"°C")];
   });
   card.append(makeTable(["週起始","平均雨量","雨量距平","降雨 EFI","濕潤訊號","可信度","平均風速","平均溫度"],rows));
  }else{const p=document.createElement("p");p.textContent="沒有週展望資料。";card.append(p);}
  const monthly=item.monthly;
  if(monthly?.time?.length){
   const title=document.createElement("h4");title.textContent="月趨勢（季節展望）";card.append(title);
   const rows=monthly.time.map((date,i)=>{
    const confidence=classifyForecastConfidence({validDate:date,referenceDate:new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"}),temporalResolution:"monthly"});
    return [date,cell(monthly.precipitation_mean?.[i]," mm"),cell(monthly.precipitation_anomaly?.[i]," mm"),
     cell(monthly.wind_speed_10m_mean?.[i]," m/s"),cell(monthly.wind_speed_10m_anomaly?.[i]," m/s"),
     cell(monthly.temperature_2m_mean?.[i],"°C"),cell(monthly.temperature_2m_anomaly?.[i],"°C"),confidence.label];
   });
   card.append(makeTable(["月份","平均雨量","雨量距平","平均風速","風速距平","平均溫度","溫度距平","可信度"],rows));
  }else{const p=document.createElement("p");p.textContent="沒有月展望資料。";card.append(p);}
  host.append(card);
 }
}

function renderLongRangeRecommendations(data){
 const host=$("long-range-recommendations"),status=$("long-range-recommendation-status");host.replaceChildren();
 const referenceDate=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"});
 const result=recommendLongRangeWindows({referenceDate,points:data.points,limit:3,minStartGap:5});
 const by=result.coverageByHorizon;
 const coverageText=by?`17–46 天週 EFI ${by.weekly.scoredCount}/${by.weekly.candidateCount}（${(by.weekly.coverageRate*100).toFixed(1)}%）｜47–90 天月距平 ${by.monthly.scoredCount}/${by.monthly.candidateCount}（${(by.monthly.coverageRate*100).toFixed(1)}%）｜跨界窗口 ${by.transition.scoredCount}/${by.transition.candidateCount}`:"";
 status.textContent=result.recommendations.length
  ? `已評估 ${result.candidateCount} 個五天窗口｜完整可評分 ${result.scoredCount} 組（總覆蓋率 ${(result.coverageRate*100).toFixed(1)}%）｜資料不足 ${result.missingCount} 組｜${coverageText}｜符合條件推薦 ${result.recommendations.length} 組。推薦僅來自可完整評分的窗口，不代表未覆蓋日期較差。`
  : `目前沒有足夠資料可評估完整五天窗口｜已檢查 ${result.candidateCount} 組，資料不足 ${result.missingCount} 組｜${coverageText}。`;
 for(const item of result.recommendations){
  const card=document.createElement("article");card.className="weather-card";
  const h=document.createElement("h3");h.textContent=`長期候選 #${item.recommendationRank}｜${fmt(item.tripStart)} – ${fmt(item.tripEnd)}`;card.append(h);
  const p=document.createElement("p");p.className="risk-summary";p.textContent=`區域趨勢：${item.tendency}｜分級 ${item.tendencyRank}/3`;card.append(p);
  const details=item.rounds.map(x=>`Day ${x.date}：${x.worstZoneLabel}最需留意（${x.worstSignal.label}）`).join("；");
  const d=document.createElement("p");d.textContent=details;card.append(d);
  const note=document.createElement("p");note.className="weather-meta";note.textContent=`時間尺度可信度：${item.temporalConfidence??item.confidence}｜空間代表性：${item.spatialConfidence??"未評估"}（${item.regionalSampleCount??"—"}個不同網格）｜EC46週展望／SEAS5月展望｜${item.interpretation}。同一趨勢分級內的日期不代表可精確排序。${item.spatialWarning?" "+item.spatialWarning:""}`;card.append(note);
  host.append(card);
 }
}
$("recommend-long-range").addEventListener("click",()=>{if(latestLongRangeData)renderLongRangeRecommendations(latestLongRangeData);});
$("fetch-long-range").addEventListener("click",async()=>{
 const button=$("fetch-long-range"),status=$("long-range-status");
 button.disabled=true;status.textContent="正在讀取 ECMWF EC46 + SEAS5 長期展望…";
 try{
  const data=await fetchOkinawaLongRange();latestLongRangeData=data;renderLongRange(data);$("recommend-long-range").disabled=false;$("run-unified-recommendations").disabled=selectedCourses.length!==3;renderLongRangeRecommendations(data);
  const stamp=new Intl.DateTimeFormat("zh-TW",{dateStyle:"short",timeStyle:"medium",timeZone:"Asia/Tokyo"}).format(new Date(data.fetchedAt));
  const quality=data.dataQuality;
  status.textContent=`讀取完成｜${data.provider}｜三區回傳 ${quality.zoneCount}/3｜週 EFI ${quality.readyForWeeklyScoring?"有資料":"無資料"}（全筆完整 ${quality.weeklyCoverageComplete?"是":"否"}）｜月雨量 ${quality.readyForMonthlyScoring?"有資料":"無資料"}（全筆完整 ${quality.monthlyCoverageComplete?"是":"否"}）｜日本時間：${stamp}${quality.warnings.length?"｜有資料警示，請查看各區檢核":"｜資料欄位檢核通過"}`;
 }catch(error){status.textContent=`讀取失敗：${error.message}。沒有以合成資料代替。`;}
 finally{button.disabled=false;}
});

renderCoursePicker();
$("fetch-course-weather").addEventListener("click",async()=>{
 const button=$("fetch-course-weather"),status=$("course-weather-status");
 button.disabled=true;status.textContent="正在依所選球場 GPS 讀取預報…";
 try{
  latestCourseWeather=await fetchCourseForecast(selectedCourses);
  $("run-unified-recommendations").disabled=selectedCourses.length!==3;
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
  populateItineraryStartDates();
  const stamp=new Intl.DateTimeFormat("zh-TW",{dateStyle:"short",timeStyle:"medium",timeZone:"Asia/Tokyo"}).format(new Date(latestCourseWeather.fetchedAt));
  status.textContent=`成功｜${latestCourseWeather.courses.length} 個球場｜16天｜讀取時間（日本時間）：${stamp}`;
 }catch(error){status.textContent=`讀取失敗：${error.message}`;}
 finally{button.disabled=selectedCourses.length===0;}
});

$("tee-hour").addEventListener("change",()=>{if(latestWeather)renderHourly(latestWeather,$("hourly-date").value);});
