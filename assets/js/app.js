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
 const note=node("p",lead<=15?"前16天依逐時預報產生報告；評分尚未經亞洲球場歷史回測校準。":"17–90天長期趨勢可信度較低，只作初步參考。","note");host.append(note);
}
async function run(){const b=$("run");b.disabled=true;$("report").replaceChildren();setStatus("正在讀取球場天氣…");try{S.course=S.directory.courses.find(c=>c.id===$("course").value);const days=(Date.parse($("departure").value+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000;if(days>=0&&days<=15){S.forecast=await fetchCourseForecast([S.course]);S.seasonal=null}else{S.seasonal=await fetchCourseSeasonalForecast(S.course);S.forecast=null}showReport();setStatus("完成｜已產生天氣及適打報告。")}catch(e){setStatus("讀取失敗："+e.message)}finally{b.disabled=!S.course}}

function monthOptions(){const base=today().slice(0,7)+"-01",out=[];for(let i=0;i<3;i++){const d=new Date(base+"T12:00:00Z");d.setUTCMonth(d.getUTCMonth()+i);out.push(d.toISOString().slice(0,7))}return out}
function initClimateExplorer(){
 const overview=$("asia-overview"),cc=$("climate-country"),mm=$("climate-month");
 for(const c of S.directory.countries){const count=S.directory.courses.filter(x=>x.countryCode===c.code&&x.enabled&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)).length;const tile=node("article",undefined,"overview-tile");tile.append(node("strong",c.nameZh),node("span",count?count+" 個已建檔球場":"球場資料建置中"));overview.append(tile);cc.add(new Option(c.nameZh,c.code));}
 for(const m of monthOptions())mm.add(new Option(m,m));
 cc.value="JP";
 cc.addEventListener("change",renderRegionClimate);
 mm.addEventListener("change",renderRegionClimate);
 renderRegionClimate();
}
async function renderRegionClimate(){
 const country=$("climate-country").value,month=$("climate-month").value,out=$("region-report"),status=$("climate-status");
 out.replaceChildren();const courses=S.directory.courses.filter(c=>c.countryCode===country&&c.enabled&&Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));
 const regions=[...new Set(S.directory.courses.filter(c=>c.countryCode===country&&c.enabled).map(c=>c.region).filter(Boolean))];
 if(!courses.length){status.textContent="此國家尚無具有效座標的球場資料，暫無法製作分區氣候比較。";return}
 status.textContent="正在讀取 "+month+" 各分區季節趨勢…";
 const groups=regions.map(region=>({region,courses:courses.filter(c=>c.region===region)}));
 const table=node("div",undefined,"region-table-wrap"),tbl=node("table",undefined,"region-table");
 const thead=node("thead"),hr=node("tr");["分區","代表球場數","月平均降雨量","降雨異常","平均氣溫","氣溫異常","選擇"].forEach(t=>hr.append(node("th",t)));thead.append(hr);tbl.append(thead);
 const body=node("tbody");let success=0;
 for(const group of groups){
  if(!group.courses.length){const tr=node("tr");[group.region,"0","尚無有效座標","—","—","—","資料建置中"].forEach(v=>tr.append(node("td",v)));body.append(tr);continue}
  const records=await Promise.allSettled(group.courses.map(c=>fetchCourseSeasonalForecast(c)));
  const rows=records.filter(x=>x.status==="fulfilled").map(x=>x.value),idx=rows[0]?.monthly?.time?.findIndex(t=>t.slice(0,7)===month)??-1;
  if(idx<0){const tr=node("tr");[group.region,String(group.courses.length),"季節資料不足","—","—","—","暫不可選"].forEach(v=>tr.append(node("td",v)));body.append(tr);continue}
  const avg=key=>{const v=rows.map(r=>r.monthly?.[key]?.[idx]).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  const rain=avg("precipitation_mean"),ra=avg("precipitation_anomaly"),temp=avg("temperature_2m_mean"),ta=avg("temperature_2m_anomaly");
  const tr=node("tr");[group.region,String(rows.length),rain==null?"—":rain.toFixed(1)+" mm",ra==null?"—":(ra>0?"+":"")+ra.toFixed(1)+" mm",temp==null?"—":temp.toFixed(1)+" °C",ta==null?"—":(ta>0?"+":"")+ta.toFixed(1)+" °C"].forEach(v=>tr.append(node("td",v)));
  const td=node("td"),btn=node("button","選擇分區","region-select");btn.type="button";btn.addEventListener("click",()=>{const mainCountry=$("country");mainCountry.value=country;fillRegions();$("region").value=group.region;fillCourses();$("course").value="";S.course=null;$("run").disabled=true;$("course-note").textContent="已選擇分區，請選擇該分區球場。";$("climate-status").textContent="已選擇 "+group.region+"；正在分析該分區最佳適打週次。";renderRegionTopWeeks(group,rows)});td.append(btn);tr.append(td);body.append(tr);success++;
 }
 tbl.append(body);table.append(tbl);out.append(table);
 status.textContent="完成｜"+month+"｜取得 "+success+" 個分區的季節趨勢。數值為月尺度模式展望，不是每日降雨預報。";
}
function renderRegionTopWeeks(group,records){
 const out=$("region-report"),title=node("h3","③ "+group.region+"｜最佳適打週次 TOP 3");
 const panel=node("section",undefined,"week-recommendations");panel.append(title,node("p","以下依分區內已建檔球場的週／月尺度季節訊號排序。17–90 天不是逐日天氣預報；推薦僅代表相對乾濕趨勢，不代表實際降雨機率。","long-range-note"));
 const ref=today(),first=add(ref,16),last=add(ref,83),candidates=[];
 for(let start=first;start<=last;start=add(start,7)){
  const days=Array.from({length:7},(_,i)=>add(start,i)),signals=[];
  for(const rec of records){
   const w=rec.weekly,m=rec.monthly;
   const efiValues=days.map(d=>{let idx=-1;(w?.time||[]).forEach((t,i)=>{if(t<=d)idx=i});return idx>=0?w.precipitation_efi?.[idx]:null}).filter(Number.isFinite);
   const monthlyIndexes=days.map(d=>(m?.time||[]).findIndex(t=>t.slice(0,7)===d.slice(0,7))).filter(i=>i>=0);
   const monthIdx=monthlyIndexes[0],anomaly=monthIdx>=0?m.precipitation_anomaly?.[monthIdx]:null,mean=monthIdx>=0?m.precipitation_mean?.[monthIdx]:null;
   if(efiValues.length)signals.push({efi:efiValues.reduce((a,b)=>a+b,0)/efiValues.length});
   else if(Number.isFinite(anomaly)&&Number.isFinite(mean)&&mean>0)signals.push({efi:anomaly/mean});
  }
  if(!signals.length)continue;
  const mean=signals.reduce((s,x)=>s+x.efi,0)/signals.length;
  const rank=mean<=-.2?0:mean<=0.05?1:mean<=.2?2:3;
  candidates.push({start,end:days[6],rank,signal:mean,coverage:signals.length});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.signal-b.signal||a.start.localeCompare(b.start));
 const picked=[];for(const item of candidates){if(picked.every(x=>Math.abs((Date.parse(item.start)-Date.parse(x.start))/86400000)>=7)){picked.push(item);if(picked.length===3)break}}
 if(!picked.length){panel.append(node("p","目前沒有足夠週／月尺度資料可產生推薦。","risk-summary"))}
 else{
  const grid=node("div",undefined,"week-grid");
  picked.forEach((x,i)=>{const card=node("article",undefined,"week-card");card.append(node("div","TOP "+(i+1),"week-rank"),node("h4",x.start+" ～ "+x.end),node("strong",["偏乾趨勢","接近基準","偏濕趨勢","顯著偏濕趨勢"][x.rank]),node("p","分區氣候訊號："+(x.signal>0?"+":"")+x.signal.toFixed(2)+"｜資料覆蓋 "+x.coverage+"/"+records.length+" 個球場"),node("p",x.rank===0?"模式顯示相對偏乾，可優先列入考慮。":x.rank===1?"降雨訊號接近模式氣候基準，仍需觀察後續預報。":"模式顯示偏濕訊號，安排時需保留彈性。"));grid.append(card)});
  panel.append(grid);
 }
 out.append(panel);
}


async function init(){try{S.directory=await fetchAsiaGolfDirectory();fillCountries();initClimateExplorer();const t=today();$("departure").min=t;$("departure").max=add(t,89);$("departure").value=t;$("country").addEventListener("change",fillRegions);$("region").addEventListener("change",fillCourses);$("course").addEventListener("change",()=>{S.course=S.directory.courses.find(c=>c.id===$("course").value);$("run").disabled=!S.course});$("run").addEventListener("click",run);setStatus("請選擇出發日期及球場。")}catch(e){setStatus("球場清單讀取失敗："+e.message)}}
init();