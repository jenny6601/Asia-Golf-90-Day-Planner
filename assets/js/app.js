import {fetchAsiaGolfDirectory} from "./course-catalog.js";
import {formatCourseDate} from "./course-time.js";
import {fetchCourseForecast} from "./weather-api.js";
import {fetchCourseSeasonalForecast,interpretPrecipitationEfi} from "./long-range-api.js";
import {scoreGolfRainWindow} from "./rain-risk.js";
import {scoreGolfSuitabilityWindow} from "./suitability-engine.js";
import {scorePwaStylePlayability} from "./pwa-playability.js";
const $=id=>document.getElementById(id),S={};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const add=(s,n)=>{const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const val=(x,u="")=>x==null?"—":x+u;
function setStatus(x){$("status").textContent=x}
function fillCourses(){const country=$("country").value,el=$("course");el.replaceChildren();const list=S.directory.courses.filter(c=>c.countryCode===country&&c.enabled);for(const c of list){const o=new Option(c.name,c.id);o.disabled=c.coordinateStatus==="pending"||!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude);el.add(o)}S.course=list.find(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude))||null;if(S.course)el.value=S.course.id;$("run").disabled=!S.course;$("course-note").textContent=S.course?"座標："+S.course.latitude.toFixed(4)+", "+S.course.longitude.toFixed(4)+"｜"+S.course.coordinateStatus+"｜"+S.course.timezone:"此國家球場資料尚在建置中。"}
function fillCountries(){const el=$("country");el.replaceChildren();for(const c of S.directory.countries){const has=S.directory.courses.some(x=>x.countryCode===c.code&&x.enabled);const o=new Option(c.nameZh+(has?"":"（建置中）"),c.code);o.disabled=!has;el.add(o)}const first=S.directory.countries.find(c=>S.directory.courses.some(x=>x.countryCode===c.code&&x.enabled));if(first)el.value=first.code;fillCourses()}
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el}
function section(host,title){const card=node("section",undefined,"weather-card");card.append(node("h3",title));host.append(card);return card}
function svgChart(host,title,series,unit){
 const card=section(host,title),width=680,height=190,left=38,right=12,top=16,bottom=30;
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox",`0 0 ${width} ${height}`);svg.setAttribute("role","img");svg.setAttribute("aria-label",title);svg.style.width="100%";svg.style.height="auto";svg.style.overflow="visible";
 const all=series.flatMap(s=>s.values.filter(Number.isFinite));if(!all.length){card.append(node("p","目前沒有足夠資料繪圖","data-note"));return}
 const lo=Math.min(0,...all),hi=Math.max(1,...all),x=i=>left+i*(width-left-right)/Math.max(1,series[0].values.length-1),y=v=>height-bottom-(v-lo)/(hi-lo)*(height-top-bottom);
 for(let k=0;k<4;k++){const yy=top+k*(height-top-bottom)/3,line=document.createElementNS(svg.namespaceURI,"line");line.setAttribute("x1",left);line.setAttribute("x2",width-right);line.setAttribute("y1",yy);line.setAttribute("y2",yy);line.setAttribute("stroke","#dce7e1");svg.append(line)}
 const palette=["#247956","#2470b5","#d28b22","#8757a6"];
 series.forEach((s,j)=>{const pts=s.values.map((v,i)=>Number.isFinite(v)?x(i)+","+y(v):null).filter(Boolean).join(" ");if(!pts)return;const poly=document.createElementNS(svg.namespaceURI,"polyline");poly.setAttribute("points",pts);poly.setAttribute("fill","none");poly.setAttribute("stroke",palette[j%palette.length]);poly.setAttribute("stroke-width","3");poly.setAttribute("stroke-linecap","round");poly.setAttribute("stroke-linejoin","round");svg.append(poly);s.values.forEach((v,i)=>{if(!Number.isFinite(v))return;const dot=document.createElementNS(svg.namespaceURI,"circle");dot.setAttribute("cx",x(i));dot.setAttribute("cy",y(v));dot.setAttribute("r","3");dot.setAttribute("fill",palette[j%palette.length]);svg.append(dot)})});
 const labels=node("div",undefined,"chart-legend");series.forEach((s,j)=>{const item=node("span",s.label+"（"+unit+"）");item.style.color=palette[j%palette.length];labels.append(item)});card.append(svg,labels);
}
function renderSixteenDayStrip(host,daily,selectedDate){
 const card=section(host,"① 16天白天逐日預報｜左右滑動檢視");
 const strip=node("div",undefined,"daily-strip");
 daily.time.forEach((date,i)=>{const day=node("button",undefined,"daily-tile"+(date===selectedDate?" selected":""));day.type="button";day.addEventListener("click",()=>{$("departure").value=date;showReport()});day.append(node("strong",date.slice(5).replace("-","/")),node("span",date===selectedDate?"所選日期":new Intl.DateTimeFormat("zh-TW",{weekday:"short",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"))),node("b",(daily.temperature_2m_max?.[i]??"—")+"° / "+(daily.temperature_2m_min?.[i]??"—")+"°"),node("small","雨 "+(daily.precipitation_probability_max?.[i]??"—")+"%"),node("small",(daily.precipitation_sum?.[i]??"—")+" mm"));strip.append(day)});
 card.append(strip);
}
function metricGrid(host,items){const grid=node("div",undefined,"results");for(const [label,value] of items){const card=node("article",undefined,"result-card");card.append(node("p",label),node("strong",value));grid.append(card)}host.append(grid)}
function showReport(){
 const host=$("report");host.replaceChildren();const c=S.course,date=$("departure").value,tee=Number($("tee").value);if(!c||!date)return;
 host.append(node("h2",c.name+"｜"+formatCourseDate(date,c.timezone)));
 const lead=(Date.parse(date+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000;
 if(lead>=0&&lead<=15&&S.forecast){
  const d=S.forecast.courses[0],i=d.daily.time.indexOf(date);
  if(i>=0){
   renderSixteenDayStrip(host,d.daily,date);
   const daily=section(host,"⓪ 所選日期預報摘要");
   const dailyText=[val(d.daily.precipitation_probability_max?.[i],"%")+" 降雨機率",val(d.daily.precipitation_sum?.[i]," mm")+" 累積雨量",val(d.daily.temperature_2m_min?.[i],"°C")+"–"+val(d.daily.temperature_2m_max?.[i],"°C"),"最大風速 "+val(d.daily.wind_speed_10m_max?.[i]," m/s")];
   metricGrid(daily,dailyText.map((v,n)=>[["降雨機率","累積雨量","最高／最低溫","最大風速"][n],v]));
  }
  const play=scorePwaStylePlayability(d.hourly,date,tee,6);
  const rows=Array.from({length:6},(_,h)=>{const time=date+"T"+String(tee+h).padStart(2,"0")+":00",i=d.hourly.time.indexOf(time);return i<0?null:{time:time.slice(11,16),code:d.hourly.weather_code?.[i],prob:d.hourly.precipitation_probability?.[i],rain:d.hourly.precipitation?.[i],temp:d.hourly.temperature_2m?.[i],feel:d.hourly.apparent_temperature?.[i],wind:d.hourly.wind_speed_10m?.[i],gust:d.hourly.wind_gusts_10m?.[i],direction:d.hourly.wind_direction_10m?.[i],humidity:d.hourly.relative_humidity_2m?.[i],cloud:d.hourly.cloud_cover?.[i],uv:d.hourly.uv_index?.[i]}});
  const summary=section(host,"⛳ 開球時段天氣摘要｜"+String(tee).padStart(2,"0")+":00 起算六小時");
  const valid=key=>rows.filter(x=>x&&Number.isFinite(x[key]));
  const probs=valid("prob").map(x=>x.prob),feels=valid("feel").map(x=>x.feel),rain=valid("rain").map(x=>x.rain);
  const codes=valid("code").map(x=>x.code),wet=codes.filter(x=>[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(x));
  const weather=codes.some(x=>[95,96,99].includes(x))?"有雷雨":wet.length>=Math.ceil(codes.length/2)?"有雨":codes.length&&codes.every(x=>x<=2)?"晴朗":codes.length?"多雲／晴時多雲":"資料不足";
  metricGrid(summary,[["天氣狀況",weather],["降雨機率最低–最高",probs.length?Math.min(...probs)+"–"+Math.max(...probs)+"%":"資料不足"],["六小時累積雨量",rain.length?rain.reduce((a,b)=>a+b,0).toFixed(1)+" mm":"資料不足"],["體感溫度最低–最高",feels.length?Math.min(...feels).toFixed(1)+"–"+Math.max(...feels).toFixed(1)+"°C":"資料不足"]]);
  const card=section(host,"⛳ 球場適打性綜合分析");
  if(play.status==="scored"){
   const top=node("div",undefined,"playability-overview");
   top.append(node("div","總得分 "+play.score+" / 100","score"),node("h3","適打等級 "+play.grade+"｜"+play.label));
   top.append(node("p","評分資料覆蓋 "+play.weightCoverage+"%｜分析時段 "+String(tee).padStart(2,"0")+":00–"+String(tee+6).padStart(2,"0")+":00","data-note"));
   if(play.safety)top.append(node("p",play.safety.reason,"risk-summary"));
   card.append(top);
   const factors=node("div",undefined,"results");
   for(const part of play.parts){const item=node("article",undefined,"result-card");item.append(node("h3",part.label+"（"+part.weight+"%）"),node("div",part.value===null?"資料不足":Math.round(part.value)+" 分","score"),node("p",part.detail));factors.append(item)}
   card.append(factors,node("h4","下場注意事項"));
   const alerts=node("ul");for(const alert of play.alerts)alerts.append(node("li",alert));card.append(alerts);
  }else card.append(node("p","逐時資料不足，無法完成六小時適打評分："+(play.missingHour||"欄位不足"),"risk-summary"));
  const rainCard=section(host,"降雨專項分析");
  const rainValues=valid("rain").map(x=>x.rain),probRows=valid("prob");
  const wetRows=valid("rain").filter(x=>x.rain>=0.1);
  metricGrid(rainCard,[["最低降雨機率",probRows.length?Math.min(...probRows.map(x=>x.prob))+"%":"資料不足"],["最高降雨機率",probRows.length?Math.max(...probRows.map(x=>x.prob))+"%":"資料不足"],["最大單小時雨量",rainValues.length?Math.max(...rainValues).toFixed(1)+" mm":"資料不足"],["降雨時數",wetRows.length+" 小時"]]);
  const tempCard=section(host,"氣溫專項分析");
  const feelValues=valid("feel").map(x=>x.feel);
  metricGrid(tempCard,[["最低體感",feelValues.length?Math.min(...feelValues).toFixed(1)+"°C":"資料不足"],["最高體感",feelValues.length?Math.max(...feelValues).toFixed(1)+"°C":"資料不足"],["低溫時數（≤15°C）",feelValues.filter(x=>x<=15).length+" 小時"],["極低溫時數（≤10°C）",feelValues.filter(x=>x<=10).length+" 小時"]]);
  const hourly=section(host,"逐時天氣預報｜六小時");
  const table=node("div",undefined,"weather-table hourly-table");
  const headers=["時間","天氣代碼","降雨機率","雨量 mm","氣溫 °C","體感 °C","風速 m/s","陣風 m/s","風向","濕度","雲量","UV"];
  const head=node("div",undefined,"weather-row weather-head");headers.forEach(x=>head.append(node("span",x)));table.append(head);
  for(const row of rows){const line=node("div",undefined,"weather-row");const vals=row?[row.time,row.code,row.prob,row.rain,row.temp,row.feel,row.wind,row.gust,row.direction,row.humidity,row.cloud,row.uv]:["—","—","—","—","—","—","—","—","—","—","—","—"];vals.forEach(x=>line.append(node("span",val(x))));table.append(line)}
  hourly.append(table);
  svgChart(host,"逐時降雨機率",rows.map(r=>r?.prob??null).length?[{label:"降雨機率",values:rows.map(r=>r?.prob??null)}]:[],"%");
  svgChart(host,"逐時雨量",[{label:"降雨量",values:rows.map(r=>r?.rain??null)}],"mm");
  svgChart(host,"氣溫與體感溫度",[{label:"氣溫",values:rows.map(r=>r?.temp??null)},{label:"體感",values:rows.map(r=>r?.feel??null)}],"°C");
  hourly.append(node("p","資料來源：Open-Meteo。適打評分為輔助判讀，尚未完成亞洲各球場歷史回測校準；請以球場公告及官方即時警示為準。","data-note"));
 }else{
  const long=section(host,"17–90天長期天氣趨勢");
  long.append(node("p","此日期超出精確逐日預報範圍。以下僅呈現週／月尺度氣候趨勢，不提供虛構的逐時預報、降雨機率、雨量或A–E適打分數。","long-range-note"));
  const w=S.seasonal?.weekly,m=S.seasonal?.monthly,wi=(w?.time||[]).reduce((a,t,i)=>t<=date?i:a,-1),mi=(m?.time||[]).findIndex(t=>t.slice(0,7)===date.slice(0,7));
  if(wi>=0)long.append(node("p","週降雨趨勢："+interpretPrecipitationEfi(w.precipitation_efi?.[wi]).label+"｜EFI "+val(w.precipitation_efi?.[wi])+"｜降雨異常 "+val(w.precipitation_anomaly?.[wi]," mm")));
  if(mi>=0)long.append(node("p","月份 "+date.slice(0,7)+"｜平均降雨 "+val(m.precipitation_mean?.[mi]," mm")+"｜降雨異常 "+val(m.precipitation_anomaly?.[mi]," mm")+"｜平均溫度 "+val(m.temperature_2m_mean?.[mi],"°C")));
 }
 const note=node("p",lead<=15?"前16天依逐時預報產生報告；評分尚未經亞洲球場歷史回測校準。":"17–90天長期趨勢可信度較低，只作初步參考。","note");host.append(note);
}
async function run(){const b=$("run");b.disabled=true;$("report").replaceChildren();setStatus("正在讀取球場天氣…");try{S.course=S.directory.courses.find(c=>c.id===$("course").value);const days=(Date.parse($("departure").value+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000;if(days>=0&&days<=15){S.forecast=await fetchCourseForecast([S.course]);S.seasonal=null}else{S.seasonal=await fetchCourseSeasonalForecast(S.course);S.forecast=null}showReport();setStatus("完成｜已產生天氣及適打報告。")}catch(e){setStatus("讀取失敗："+e.message)}finally{b.disabled=!S.course}}
async function init(){try{S.directory=await fetchAsiaGolfDirectory();fillCountries();const t=today();$("departure").min=t;$("departure").max=add(t,89);$("departure").value=t;$("country").addEventListener("change",fillCourses);$("course").addEventListener("change",()=>{S.course=S.directory.courses.find(c=>c.id===$("course").value);$("run").disabled=!S.course});$("run").addEventListener("click",run);setStatus("請選擇出發日期及球場。")}catch(e){setStatus("球場清單讀取失敗："+e.message)}}
init();