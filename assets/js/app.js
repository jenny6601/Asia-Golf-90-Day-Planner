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
function fillCourses(){const country=$("country").value,region=$("region").value,el=$("course");el.replaceChildren();const list=S.directory.courses.filter(c=>c.countryCode===country&&c.region===region&&c.enabled);for(const c of list){const o=new Option(c.name,c.id);o.disabled=c.coordinateStatus==="pending"||!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude);el.add(o)}const usable=list.find(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));S.course=usable||null;if(usable)el.value=usable.id;el.disabled=!list.length;$("run").disabled=!S.course;$("course-note").textContent=usable?"座標："+usable.latitude.toFixed(4)+", "+usable.longitude.toFixed(4)+"｜"+usable.coordinateStatus+"｜"+usable.timezone:list.length?"此分區球場座標尚待核實，暫不能查詢逐點天氣。":"此分區尚無已建檔球場。"}
function fillRegions(){const country=$("country").value,el=$("region");el.replaceChildren();const regions=[...new Set(S.directory.courses.filter(c=>c.countryCode===country&&c.enabled).map(c=>c.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh-Hant"));for(const region of regions)el.add(new Option(region==="Okinawa"?"沖繩（獨立分區）":region,region));el.disabled=!regions.length;if(regions.length)el.value=regions.includes("Okinawa")?"Okinawa":regions[0];fillCourses()}
function fillCountries(){const el=$("country");el.replaceChildren();for(const c of S.directory.countries){const has=S.directory.courses.some(x=>x.countryCode===c.code&&x.enabled);const o=new Option(c.nameZh+(has?"":"（建置中）"),c.code);o.disabled=!has;el.add(o)}const first=S.directory.countries.find(c=>S.directory.courses.some(x=>x.countryCode===c.code&&x.enabled));if(first)el.value=first.code;fillRegions()}
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
 renderCourseSevenDayReport(host,c,date);
 const note=node("p",lead<=15?"前16天依逐時預報產生報告；評分尚未經亞洲球場歷史回測校準。":"17–90天長期趨勢可信度較低，只作初步參考。","note");host.append(note);
}

function renderCourseSevenDayReport(host,course,startDate){
 const report=section(host,"⑤ 球場專屬｜出發日起 7 天天氣報告");
 const endDate=add(startDate,6);
 report.append(node("p",course.name+"｜"+startDate+" ～ "+endDate+"｜座標 "+course.latitude.toFixed(4)+", "+course.longitude.toFixed(4),"data-note"));
 const daily=S.forecast?.courses?.find(x=>x.course.id===course.id)?.daily;
 const monthly=S.seasonal?.monthly,weekly=S.seasonal?.weekly;
 const rows=[];
 for(let offset=0;offset<7;offset++){
  const date=add(startDate,offset),idx=daily?.time?.indexOf(date)??-1;
  if(idx>=0){
   rows.push({date,level:"逐日預報",rain:daily.precipitation_sum?.[idx],prob:daily.precipitation_probability_max?.[idx],low:daily.temperature_2m_min?.[idx],high:daily.temperature_2m_max?.[idx],wind:daily.wind_speed_10m_max?.[idx]});
  }else{
   let wi=-1;(weekly?.time||[]).forEach((t,i)=>{if(t<=date)wi=i});
   const mi=(monthly?.time||[]).findIndex(t=>t.slice(0,7)===date.slice(0,7));
   rows.push({date,level:wi>=0&&Number.isFinite(weekly.precipitation_efi?.[wi])?"週尺度趨勢":mi>=0?"月尺度趨勢":"資料不足",efi:wi>=0?weekly.precipitation_efi?.[wi]:null,rain:mi>=0?monthly.precipitation_mean?.[mi]:null,rainAnomaly:mi>=0?monthly.precipitation_anomaly?.[mi]:null,temp:mi>=0?monthly.temperature_2m_mean?.[mi]:null});
  }
 }
 const table=node("div",undefined,"weather-table course-seven-table"),head=node("div",undefined,"weather-row weather-head");
 ["日期","資料層級","降雨量／趨勢","降雨機率","溫度","最大風速"].forEach(x=>head.append(node("span",x)));table.append(head);
 for(const row of rows){const line=node("div",undefined,"weather-row");let rainText="—",probText="—",tempText="—",windText="—";
  if(row.level==="逐日預報"){rainText=val(row.rain," mm");probText=val(row.prob,"%");tempText=val(row.low,"°")+" / "+val(row.high,"°");windText=val(row.wind," m/s")}
  else if(row.level==="週尺度趨勢"){rainText=interpretPrecipitationEfi(row.efi).label;tempText="非逐日資料"}
  else if(row.level==="月尺度趨勢"){rainText=val(row.rain," mm／月");tempText=val(row.temp,"°C／月")}
  [row.date,row.level,rainText,probText,tempText,windText].forEach(x=>line.append(node("span",x)));table.append(line)
 }
 report.append(table);
 const actual=rows.filter(x=>x.level==="逐日預報");
 if(actual.length){
  svgChart(report,"球場逐日累積雨量（僅顯示有效預報日）",[{label:"每日雨量",values:rows.map(x=>x.level==="逐日預報"&&Number.isFinite(x.rain)?x.rain:null)}],"mm");
  report.append(node("p","逐日資料覆蓋 "+actual.length+"/7 天。超出逐日預報範圍的日期只顯示可取得的週／月尺度趨勢，不推算每日雨量、降雨機率或溫度。","data-note"));
 }else{
  const signals=rows.map(x=>x.efi).filter(Number.isFinite);
  report.append(node("p",signals.length?"此七天期間沒有逐日預報；目前只取得週尺度降雨趨勢，EFI="+(signals.reduce((a,b)=>a+b,0)/signals.length).toFixed(2)+"。":"此七天期間沒有逐日預報，僅有可用的月尺度氣候背景。","long-range-note"));
  report.append(node("p","資料可信度：季節趨勢參考。不可解讀為每日降雨機率或每日雨量，也不產生 A–E 適打等級。","data-note"));
 }
}

async function run(){const b=$("run");b.disabled=true;$("report").replaceChildren();setStatus("正在讀取球場天氣…");try{S.course=S.directory.courses.find(c=>c.id===$("course").value);const days=(Date.parse($("departure").value+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000;if(days>=0&&days<=15){S.forecast=await fetchCourseForecast([S.course]);S.seasonal=null}else{S.seasonal=await fetchCourseSeasonalForecast(S.course);S.forecast=null}showReport();setStatus("完成｜已產生天氣及適打報告。")}catch(e){setStatus("讀取失敗："+e.message)}finally{b.disabled=!S.course}}

function monthOptions(){
 const current=today(),base=current.slice(0,7)+"-01",monthEnd=new Date(Date.parse(base+"T12:00:00Z"));
 monthEnd.setUTCMonth(monthEnd.getUTCMonth()+1);monthEnd.setUTCDate(0);
 const remaining=Math.round((Date.parse(monthEnd.toISOString().slice(0,10)+"T12:00:00Z")-Date.parse(current+"T12:00:00Z"))/86400000)+1;
 const offset=remaining<7?1:0,out=[];
 for(let i=0;i<3;i++){const d=new Date(base+"T12:00:00Z");d.setUTCMonth(d.getUTCMonth()+offset+i);out.push(d.toISOString().slice(0,7))}
 return out;
}
function showClimateScreen(title,backAction){
 const overview=$("asia-overview"),out=$("region-report"),status=$("climate-status");
 overview.hidden=true;status.hidden=true;
 let nav=$("flow-nav");if(!nav){nav=node("div",undefined,"flow-nav");nav.id="flow-nav";$("climate-explorer").insertBefore(nav,out)}
 nav.replaceChildren();
 if(backAction){const back=node("button","← 返回上一層","flow-back");back.type="button";back.addEventListener("click",backAction);nav.append(back)}
 const h=node("h2",title,"flow-title");nav.append(h);
 out.hidden=false;status.hidden=false;
}
function showCountryOverview(){
 $("asia-overview").hidden=false;$("region-report").replaceChildren();$("region-report").hidden=true;
 const nav=$("flow-nav");if(nav)nav.replaceChildren();
 $("climate-status").hidden=false;$("climate-status").textContent="請選擇國家，進入該國地理分區。";
}
const REGION_CATALOG={
 JP:["北海道","東北","關東","中部","關西","中國地方","四國","九州","沖繩"],
 KR:["首都圈","江原道","忠清道","全羅道","慶尚道","濟州島"],
 CN:["華北","東北","華東","華中","華南","西南","西北"],
 VN:["北部","中北部","中部沿海","西原","東南部","湄公河三角洲"],
 TH:["北部","東北部","中部","東部","西部","南部"],
 MY:["北馬","中馬","南馬","東海岸","沙巴","砂拉越"],
 SG:["新加坡全島"],
 ID:["蘇門答臘","爪哇","峇里及努沙登加拉","加里曼丹","蘇拉威西","馬魯古","巴布亞"]
};
function initClimateExplorer(){
 const overview=$("asia-overview"),cc=$("climate-country");
 for(const c of S.directory.countries){
  const count=S.directory.courses.filter(x=>x.countryCode===c.code&&x.enabled&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)).length;
  const tile=node("button",undefined,"overview-tile country-tile");tile.type="button";tile.append(node("strong",c.nameZh),node("span",count?count+" 個已建檔球場":"球場資料建置中"));
  tile.addEventListener("click",()=>{cc.value=c.code;renderRegionClimate()});overview.append(tile);cc.add(new Option(c.nameZh,c.code));
 }
 cc.value="JP";cc.addEventListener("change",renderRegionClimate);$("region-report").hidden=true;$("climate-status").textContent="請選擇國家，進入該國地理分區。";
}
async function renderRegionClimate(){
 const country=$("climate-country").value,out=$("region-report"),status=$("climate-status");
 out.replaceChildren();const months=monthOptions(),all=S.directory.courses.filter(c=>c.countryCode===country&&c.enabled),catalog=REGION_CATALOG[country]||[];
 const normalizeRegion=r=>(country==="JP"&&["Okinawa","沖繩"].includes(r)?"沖繩":r);
 const defined=[...new Set([...catalog,...all.map(c=>c.region).filter(Boolean)].map(normalizeRegion))];
 showClimateScreen((S.directory.countries.find(c=>c.code===country)?.nameZh||country)+"｜選擇地理分區",showCountryOverview);
 const available=all.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));
 const selectedCountry=S.directory.countries.find(c=>c.code===country);

 const grid=node("div",undefined,"region-choice-grid");
 for(const region of defined){
  const courses=all.filter(c=>normalizeRegion(c.region)===region);
  const valid=courses.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));
  const card=node("button",undefined,"region-choice");card.type="button";
  card.append(node("strong",region),node("span",courses.length?courses.length+" 個球場資料／"+valid.length+" 個有效座標":"球場資料待建置"),node("small","查看三個月天氣分區表"));
  card.addEventListener("click",()=>renderRegionMonths(country,region,months,courses));
  grid.append(card);
 }
 out.append(grid);
 status.textContent=(selectedCountry?.nameZh||country)+"｜"+defined.length+" 個地理分區。點選分區即可查看三個月總表。"+(available.length?" 已有 "+available.length+" 個具有效座標的球場。":" 目前尚無有效球場座標。");
}
async function renderRegionMonths(country,region,months,courses){
 const out=$("region-report"),status=$("climate-status");out.replaceChildren();
 showClimateScreen("② "+(S.directory.countries.find(c=>c.code===country)?.nameZh||country)+"｜"+region+"｜三個月天氣總表",()=>renderRegionClimate());
 const valid=courses.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));
 const records=(await Promise.allSettled(valid.map(c=>fetchCourseSeasonalForecast(c)))).filter(x=>x.status==="fulfilled").map(x=>x.value);
 const table=node("div",undefined,"region-table-wrap"),tbl=node("table",undefined,"region-table region-matrix"),thead=node("thead"),hr=node("tr");
 ["天氣指標",...months.map(m=>m)].forEach(t=>hr.append(node("th",t)));thead.append(hr);tbl.append(thead);
 const body=node("tbody");
 const metrics=[{label:"月平均降雨量",key:"rain",unit:" mm",fmt:v=>v.toFixed(1)},{label:"降雨異常",key:"anomaly",unit:" mm",fmt:v=>(v>0?"+":"")+v.toFixed(1)},{label:"月平均氣溫",key:"temp",unit:" °C",fmt:v=>v.toFixed(1)}];
 const monthData=months.map(month=>{const values=records.map(rec=>{const i=(rec.monthly?.time||[]).findIndex(t=>t.slice(0,7)===month);return i<0?null:{rain:rec.monthly.precipitation_mean?.[i],temp:rec.monthly.temperature_2m_mean?.[i],anomaly:rec.monthly.precipitation_anomaly?.[i]}}).filter(Boolean);const avg=key=>{const v=values.map(x=>x[key]).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};return {month,rain:avg("rain"),temp:avg("temp"),anomaly:avg("anomaly"),status:values.length?"季節資料可用":valid.length?"天氣資料暫缺":"待建置"}});
 for(const metric of metrics){const tr=node("tr");tr.append(node("th",metric.label));for(const item of monthData){const v=item[metric.key];tr.append(node("td",Number.isFinite(v)?metric.fmt(v)+metric.unit:"—"))}body.append(tr)}
 const statusRow=node("tr");statusRow.append(node("th","資料狀態"));for(const item of monthData)statusRow.append(node("td",item.status));body.append(statusRow);
 const actionRow=node("tr");actionRow.append(node("th","下一步"));for(const item of monthData){const td=node("td"),btn=node("button","查看週分析","region-select");btn.type="button";btn.addEventListener("click",()=>{const group={region,courses:valid};if(records.length){renderRegionTopWeeks(group,records,item.month)}else{renderEmptyWeekAnalysis(country,region,item.month)}});td.append(btn);actionRow.append(td)}body.append(actionRow);
 tbl.append(body);table.append(tbl);out.append(table);
 status.textContent=valid.length?"已選擇 "+region+"｜球場 "+valid.length+" 個，成功取得季節資料 "+records.length+" 組。月份已改為橫向、天氣指標縱向，方便手機閱讀。":"已選擇 "+region+"。此區尚無球場／天氣資料，但月份及週分析操作仍可使用。";
}
function renderEmptyWeekAnalysis(country,region,month){
 const out=$("region-report");out.replaceChildren();showClimateScreen("③ "+region+"｜"+month+"｜週次預覽",()=>renderRegionMonths(country,region,monthOptions(),[]));
 const panel=node("section",undefined,"week-recommendations");
 panel.append(node("h3","③ "+region+"｜"+month+" 週天氣分析"),node("p","此分區目前尚無球場座標或天氣資料。以下提供週次版面預覽；資料建置完成後會自動以該區實際季節資料取代。","long-range-note"));
 const grid=node("div",undefined,"week-grid");
 const first=month+"-01";
 for(let i=0;i<3;i++){const start=add(first,i*7),end=add(start,6),card=node("article",undefined,"week-card");card.append(node("div","週次 "+(i+1),"week-rank"),node("h4",start+" ～ "+end),node("strong","天氣資料待建置"),node("p","降雨、溫度及適打分析暫無資料。"),node("button","查看七天報告","week-open"));card.lastChild.type="button";card.lastChild.addEventListener("click",()=>renderEmptySevenDay(country,region,start));grid.append(card)}
 panel.append(grid);out.append(panel);
}
function renderEmptySevenDay(country,region,start){
 const out=$("region-report");out.replaceChildren();showClimateScreen("④ "+region+"｜七天天氣報告預覽",()=>renderEmptyWeekAnalysis(country,region,start.slice(0,7)));const panel=node("section",undefined,"selected-week-report");
 panel.append(node("h3","④ "+region+"｜七天天氣報告"),node("h4",start+" ～ "+add(start,6)),node("p","此分區尚無球場／天氣資料。此畫面為版面預覽，並非實際天氣預報。","long-range-note"));
 const strip=node("div",undefined,"seven-day-strip");
 for(let i=0;i<7;i++){const date=add(start,i),tile=node("div",undefined,"seven-day-item");tile.append(node("strong",date.slice(5)),node("span","待建置"));strip.append(tile)}
 panel.append(strip);const choose=node("button","前往選擇出發日期及球場","week-back");choose.type="button";choose.addEventListener("click",()=>{$("departure").value=start;$("departure").scrollIntoView({behavior:"smooth",block:"center"})});panel.append(choose);out.append(panel);
}

function renderRegionTopWeeks(group,records,month){
 const out=$("region-report");out.replaceChildren();showClimateScreen("③ "+group.region+"｜"+month+"｜選擇週次",()=>renderRegionMonths($("climate-country").value,group.region,monthOptions(),group.courses));const title=node("h3","③ "+group.region+"｜"+month+" 週天氣分析 TOP 3");
 const panel=node("section",undefined,"week-recommendations");panel.append(title,);
 const monthStart=month+"-01",monthEnd=new Date(Date.parse(monthStart+"T12:00:00Z"));monthEnd.setUTCMonth(monthEnd.getUTCMonth()+1);monthEnd.setUTCDate(0);const last=monthEnd.toISOString().slice(0,10),todayDate=today(),first=monthStart>todayDate?monthStart:todayDate,candidates=[];
 for(let start=first;start<=last;start=add(start,7)){
  const weekEnd=add(start,6);if(weekEnd>last)continue;
  const days=Array.from({length:7},(_,i)=>add(start,i)),signals=[];
  for(const rec of records){
   const w=rec.weekly,m=rec.monthly;
   const efiValues=days.map(d=>{let idx=-1;(w?.time||[]).forEach((t,i)=>{if(t<=d)idx=i});return idx>=0?w.precipitation_efi?.[idx]:null}).filter(Number.isFinite);
   const monthIdx=(m?.time||[]).findIndex(t=>t.slice(0,7)===month);
   const anomaly=monthIdx>=0?m.precipitation_anomaly?.[monthIdx]:null,mean=monthIdx>=0?m.precipitation_mean?.[monthIdx]:null;
   if(efiValues.length)signals.push({efi:efiValues.reduce((a,b)=>a+b,0)/efiValues.length,source:"weekly"});
   else if(Number.isFinite(anomaly)&&Number.isFinite(mean)&&mean>0)signals.push({efi:anomaly/mean,source:"monthly"});
  }
  if(!signals.length)continue;
  const mean=signals.reduce((s,x)=>s+x.efi,0)/signals.length,rank=mean<=-.2?0:mean<=.05?1:mean<=.2?2:3;
  candidates.push({start,end:weekEnd,rank,signal:mean,coverage:signals.length,source:signals.every(x=>x.source==="weekly")?"weekly":"monthly"});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.signal-b.signal||a.start.localeCompare(b.start));
 const picked=[];for(const item of candidates){if(picked.every(x=>Math.abs((Date.parse(item.start)-Date.parse(x.start))/86400000)>=7)){picked.push(item);if(picked.length===3)break}}
 if(!picked.length){panel.append(node("p","目前沒有足夠週／月尺度資料可產生推薦。","risk-summary"))}
 else{
  const grid=node("div",undefined,"week-grid");
  picked.forEach((x,i)=>{const card=node("article",undefined,"week-card");card.append(node("div","TOP "+(i+1),"week-rank"),node("h4",x.start+" ～ "+x.end),node("strong",["偏乾趨勢","接近基準","偏濕趨勢","顯著偏濕趨勢"][x.rank]),node("p","分區氣候訊號："+(x.signal>0?"+":"")+x.signal.toFixed(2)+"｜"+(x.source==="weekly"?"週尺度資料":"月尺度參考")+"｜資料覆蓋 "+x.coverage+"/"+records.length+" 個球場"),node("p",x.source==="monthly"?"此週採用整月氣候訊號，無法區分同月內哪一週實際較乾。":x.rank===0?"模式顯示相對偏乾，可優先列入考慮。":x.rank===1?"降雨訊號接近模式氣候基準，仍需觀察後續預報。":"模式顯示偏濕訊號，安排時需保留彈性。"));const choose=node("button","查看此週 7 天報告","week-open");choose.type="button";choose.addEventListener("click",()=>renderSelectedWeekReport(group,x,records,month));card.append(choose);grid.append(card)});
  panel.append(grid);
 }
 out.append(panel);
}


async function renderSelectedWeekReport(group,week,records,month){
 const host=$("region-report");host.replaceChildren();showClimateScreen("④ "+group.region+"｜"+week.start+"｜七天天氣報告",()=>renderRegionTopWeeks(group,records,month));
 const report=section(host,"七天逐日天氣預報｜"+week.start+" ～ "+week.end);
 
 const lead=(Date.parse(week.start+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000;
 const courses=(group.courses||[]).filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)).slice(0,3);
 let forecasts=[];
 if(lead>=0&&lead<=9&&courses.length){
  try{const result=await fetchCourseForecast(courses);forecasts=result.courses||[]}catch(e){report.append(node("p","逐日／逐時預報暫時無法取得："+e.message,"risk-summary"))}
 }
 const dates=Array.from({length:7},(_,i)=>add(week.start,i));
 const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
 const dailyRows=dates.map(date=>{
  const entries=forecasts.map(f=>{const i=f.daily.time.indexOf(date);return i<0?null:{code:f.daily.weather_code?.[i],rain:f.daily.precipitation_sum?.[i],prob:f.daily.precipitation_probability_max?.[i],low:f.daily.temperature_2m_min?.[i],high:f.daily.temperature_2m_max?.[i],feelLow:f.daily.apparent_temperature_min?.[i],feelHigh:f.daily.apparent_temperature_max?.[i],wind:f.daily.wind_speed_10m_max?.[i]}}).filter(Boolean);
  return {date,code:median(entries.map(x=>x.code)),rain:median(entries.map(x=>x.rain)),prob:median(entries.map(x=>x.prob)),low:median(entries.map(x=>x.low)),high:median(entries.map(x=>x.high)),feelLow:median(entries.map(x=>x.feelLow)),feelHigh:median(entries.map(x=>x.feelHigh)),wind:median(entries.map(x=>x.wind)),coverage:entries.length};
 });
 const wxLabel=code=>{if(!Number.isFinite(code))return "資料不足";if(code===0)return "晴朗";if(code<=2)return "晴時多雲";if(code===3)return "陰天";if(code===45||code===48)return "霧";if(code>=51&&code<=57)return "毛毛雨";if(code>=61&&code<=67)return "降雨";if(code>=71&&code<=77)return "降雪";if(code>=80&&code<=82)return "陣雨";if(code>=95)return "雷雨";return "多雲"};
 const wxIcon=code=>{if(!Number.isFinite(code))return "—";if(code===0)return "☀️";if(code<=2)return "🌤️";if(code===3)return "☁️";if(code>=51&&code<=67)return "🌧️";if(code>=80&&code<=82)return "🌦️";if(code>=95)return "⛈️";return "☁️"};
 const strip=node("div",undefined,"taiwan-style-seven-day");
 const dateRow=node("div",undefined,"taiwan-seven-row taiwan-seven-dates");
 const weatherRow=node("div",undefined,"taiwan-seven-row taiwan-seven-weather");
 const rainRow=node("div",undefined,"taiwan-seven-row taiwan-seven-rain");
 for(const row of dailyRows){
  const dateCell=node("div",undefined,"taiwan-seven-cell");dateCell.append(node("strong",row.date.slice(5).replace("-","/")),node("small",["日","一","二","三","四","五","六"][new Date(row.date+"T12:00:00Z").getUTCDay()]));dateRow.append(dateCell);
  const weatherCell=node("div",undefined,"taiwan-seven-cell");weatherCell.append(node("div",wxIcon(row.code),"taiwan-seven-icon"),node("strong",wxLabel(row.code)));weatherRow.append(weatherCell);
  const rainCell=node("div",undefined,"taiwan-seven-cell");rainCell.append(node("small","降雨機率"),node("strong",val(row.prob,"%"),"taiwan-rain-prob"),node("small","累積雨量"),node("strong",val(row.rain," mm"),"taiwan-rain-mm"));rainRow.append(rainCell);
 }
 strip.append(dateRow);
 const curve=section(strip,"七天氣溫曲線");
 svgChart(curve,"每日最高／最低氣溫及體感",[{label:"最高溫",values:dailyRows.map(x=>x.high)},{label:"最低溫",values:dailyRows.map(x=>x.low)},{label:"最高體感",values:dailyRows.map(x=>x.feelHigh)}],"°C");
 strip.append(weatherRow,rainRow);report.append(strip);
 if(forecasts.length){
  const rainValues=dailyRows.map(x=>x.rain),tempValues=dailyRows.map(x=>x.high),feelValues=dailyRows.map(x=>x.feelHigh);
  const probs=dailyRows.map(x=>x.prob).filter(Number.isFinite),rainValid=rainValues.filter(Number.isFinite),lowVals=dailyRows.map(x=>x.low).filter(Number.isFinite),highVals=tempValues.filter(Number.isFinite);
  const rainCard=section(host,"降雨專項分析｜七天");
  metricGrid(rainCard,[["七天累積雨量",rainValid.length?rainValid.reduce((a,b)=>a+b,0).toFixed(1)+" mm":"資料不足"],["最高降雨機率",probs.length?Math.max(...probs)+"%":"資料不足"],["有雨日數",dailyRows.filter(x=>Number.isFinite(x.rain)&&x.rain>=0.1).length+" 天"],["平均日雨量",rainValid.length?(rainValid.reduce((a,b)=>a+b,0)/rainValid.length).toFixed(1)+" mm":"資料不足"]]);
  svgChart(host,"七天每日累積雨量",[{label:"每日雨量",values:rainValues}],"mm");
  const tempCard=section(host,"氣溫及體感分析｜七天");
  metricGrid(tempCard,[["最低氣溫",lowVals.length?Math.min(...lowVals).toFixed(1)+"°C":"資料不足"],["最高氣溫",highVals.length?Math.max(...highVals).toFixed(1)+"°C":"資料不足"],["最低體感",dailyRows.map(x=>x.feelLow).filter(Number.isFinite).length?Math.min(...dailyRows.map(x=>x.feelLow).filter(Number.isFinite)).toFixed(1)+"°C":"逐日體感資料不足"],["最高體感",feelValues.filter(Number.isFinite).length?Math.max(...feelValues).toFixed(1)+"°C":"逐日體感資料不足"]]);
  svgChart(host,"七天最高／最低氣溫",[{label:"最高氣溫",values:tempValues},{label:"最低氣溫",values:dailyRows.map(x=>x.low)}],"°C");
  if(feelValues.some(Number.isFinite))svgChart(host,"七天最高體感溫度",[{label:"最高體感",values:feelValues}],"°C");
  const hourlyCard=section(host,"逐時天氣預報｜每日 06:00–18:00（有資料才顯示）");
  let hourCount=0;
  for(const date of dates){
   const details=document.createElement("details"),summary=document.createElement("summary");summary.textContent=date+"｜查看逐時天氣";details.append(summary);
   const rows=[];
   for(let h=6;h<=18;h++){
    const stamp=date+"T"+String(h).padStart(2,"0")+":00";
    const points=forecasts.map(f=>{const i=f.hourly.time.indexOf(stamp);return i<0?null:{code:f.hourly.weather_code?.[i],prob:f.hourly.precipitation_probability?.[i],rain:f.hourly.precipitation?.[i],temp:f.hourly.temperature_2m?.[i],feel:f.hourly.apparent_temperature?.[i],wind:f.hourly.wind_speed_10m?.[i],humidity:f.hourly.relative_humidity_2m?.[i]}}).filter(Boolean);
    if(!points.length)continue;hourCount++;
    const cells=[stamp.slice(11),wxLabel(median(points.map(x=>x.code))),val(median(points.map(x=>x.prob)),"%"),val(median(points.map(x=>x.rain))," mm"),val(median(points.map(x=>x.temp)),"°C"),val(median(points.map(x=>x.feel)),"°C"),val(median(points.map(x=>x.wind))," m/s"),val(median(points.map(x=>x.humidity)),"%")];
    const line=document.createElement("div");line.className="seven-day-hour-row";cells.forEach(v=>{const span=document.createElement("span");span.textContent=v;line.append(span)});rows.push(line);
   }
   if(rows.length){const head=document.createElement("div");head.className="seven-day-hour-row is-head";["時間","天氣","降雨機率","雨量","氣溫","體感","風速","濕度"].forEach(v=>{const span=document.createElement("span");span.textContent=v;head.append(span)});details.append(head,...rows);hourlyCard.append(details)}
  }
  if(!hourCount)hourlyCard.append(node("p","所選七天期間沒有可用逐時資料。","data-note"));
  report.append();
 }else{
  const seasonal=node("section",undefined,"week-recommendations");
  seasonal.append(node("h3","季節趨勢參考（非逐日預報）"),node("p","所選週次超出目前可用的 16 天逐日／逐時預報範圍，或尚無可用球場座標。此處不製作虛構的七天逐日數字。","long-range-note"));
  const weeklyRows=records.flatMap(rec=>(rec.weekly?.time||[]).map((d,i)=>({date:d,rain:rec.weekly.precipitation_mean?.[i],efi:rec.weekly.precipitation_efi?.[i],temp:rec.weekly.temperature_2m_mean?.[i]})).filter(x=>x.date>=week.start&&x.date<=week.end));
  const monthlyRows=records.map(rec=>{const i=(rec.monthly?.time||[]).findIndex(d=>d.slice(0,7)===month);return i<0?null:{rain:rec.monthly.precipitation_mean?.[i],temp:rec.monthly.temperature_2m_mean?.[i],anomaly:rec.monthly.precipitation_anomaly?.[i]}}).filter(Boolean);
  const mean=key=>{const a=weeklyRows.map(x=>x[key]).filter(Number.isFinite);if(a.length)return a.reduce((p,c)=>p+c,0)/a.length;const b=monthlyRows.map(x=>x[key]).filter(Number.isFinite);return b.length?b.reduce((p,c)=>p+c,0)/b.length:null};
  metricGrid(seasonal,[["模式週／月降雨量",val(mean("rain")," mm")],["平均氣溫",val(mean("temp"),"°C")],["降雨 EFI",weeklyRows.length?val(mean("efi")):"未提供"]]);
  seasonal.append(node("p","此階段僅能顯示週／月氣候背景；降雨機率、每日雨量、逐日溫度及逐時天氣均未提供。","data-note"));report.append(seasonal);
 }
 const choose=node("button","選擇出發日期及球場","week-back");choose.type="button";choose.addEventListener("click",()=>showDepartureForm(week.start));host.append(choose);host.scrollIntoView({behavior:"smooth",block:"start"});
}

function showDepartureForm(startDate){
 $("departure").value=startDate;$("departure").min=today();$("departure").max=add(today(),89);
 $("course-note").textContent="已帶入所選週次起始日；請選擇球場及開球時間。";
 $("climate-explorer").hidden=true;
 const form=$("departure").closest(".panel");form.hidden=false;
 form.scrollIntoView({behavior:"smooth",block:"start"});
}
async function init(){try{S.directory=await fetchAsiaGolfDirectory();fillCountries();initClimateExplorer();const t=today();$("departure").min=t;$("departure").max=add(t,89);$("departure").value=t;$("country").addEventListener("change",fillRegions);$("region").addEventListener("change",fillCourses);$("course").addEventListener("change",()=>{S.course=S.directory.courses.find(c=>c.id===$("course").value);$("run").disabled=!S.course});$("run").addEventListener("click",run);setStatus("請選擇出發日期及球場。")}catch(e){setStatus("球場清單讀取失敗："+e.message)}}
init();