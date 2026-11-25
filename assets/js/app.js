import {fetchAsiaGolfDirectory} from "./course-catalog.js";
import {formatCourseDate} from "./course-time.js";
import {fetchCourseForecast} from "./weather-api.js";
import {fetchCourseSeasonalForecast,fetchCourseHistoricalMonthlyClimate,fetchCourseHistoricalWeekNormals,interpretPrecipitationEfi} from "./long-range-api.js";
import {scoreGolfRainWindow} from "./rain-risk.js";
import {scoreGolfSuitabilityWindow} from "./suitability-engine.js";
import {scorePwaStylePlayability} from "./pwa-playability.js";
const $=id=>document.getElementById(id),S={};
let climateBackAction=null,climateHistoryReady=false,exitConfirmed=false;
function showExitDialog(){
 let modal=document.getElementById("exit-dialog");if(modal){modal.hidden=false;return}
 modal=node("div",undefined,"exit-dialog");modal.id="exit-dialog";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
 const box=node("div",undefined,"exit-dialog-box");box.append(node("p","確定要退出亞洲高爾夫天氣 App 嗎？","exit-dialog-message"));
 const actions=node("div",undefined,"exit-dialog-actions");
 const cancel=node("button","取消","exit-cancel");cancel.type="button";cancel.addEventListener("click",()=>{modal.hidden=true;history.pushState({homeExitGuard:true},"",location.href);showCountryOverview()});
 const confirm=node("button","確定","exit-confirm");confirm.type="button";confirm.addEventListener("click",()=>{modal.hidden=true;exitConfirmed=true;try{window.close()}catch(e){};history.back();setTimeout(()=>{if(!document.hidden){setStatus("已送出離開指令；若瀏覽器未自動關閉，請使用 Android 系統返回鍵離開。")}},350)});
 actions.append(cancel,confirm);box.append(actions);modal.append(box);document.body.append(modal);
}
window.addEventListener("popstate",()=>{if(exitConfirmed)return;if(climateBackAction){const action=climateBackAction;action();return;}showExitDialog()});
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

function createWeatherIcon(code, historical=false, probability=null){
 const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
 svg.setAttribute("viewBox","0 0 64 64");svg.setAttribute("role","img");
 const rain=historical?Number.isFinite(probability)&&probability>=30:
  Number.isFinite(code)&&((code>=51&&code<=67)||(code>=80&&code<=82)||code>=95);
 const thunder=!historical&&Number.isFinite(code)&&code>=95;
 const sunny=!historical&&Number.isFinite(code)&&code===0;
 const partly=!historical&&Number.isFinite(code)&&(code===1||code===2);
 const cloud=!historical&&Number.isFinite(code)&&code===3;
 const add=(tag,attrs)=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));svg.append(e);return e};
 const bg=add("rect",{x:2,y:2,width:60,height:60,rx:13,fill:"#159ce5"});
 if(sunny||partly){
  add("circle",{cx:31,cy:27,r:11,fill:"#ffd22e",stroke:"#f4a900","stroke-width":2});
  if(sunny)for(let i=0;i<8;i++){const a=i*Math.PI/4,x1=31+15*Math.cos(a),y1=27+15*Math.sin(a),x2=31+20*Math.cos(a),y2=27+20*Math.sin(a);add("line",{x1,y1,x2,y2,stroke:"#ffd22e","stroke-width":3,"stroke-linecap":"round"})}
 }
 if(!sunny){
  add("path",{d:partly?"M12 42 C7 42 6 35 11 32 C12 26 20 23 26 27 C31 18 45 22 46 32 C55 32 58 42 51 45 L15 45 Z":"M10 43 C5 42 6 34 12 32 C13 24 23 21 29 26 C34 16 49 21 50 31 C59 31 60 42 53 45 Z",fill:"#f7fbff",stroke:"#829bb1","stroke-width":2.4,"stroke-linejoin":"round"});
 }
 if(rain){
  for(const [x,y] of [[21,51],[32,53],[43,51]])add("path",{d:`M${x} ${y-4} Q${x-5} ${y+2} ${x} ${y+5} Q${x+5} ${y+2} ${x} ${y-4} Z`,fill:"#49c8ff",stroke:"#1689d0","stroke-width":1});
 }
 if(thunder)add("path",{d:"M34 39 L25 52 L33 51 L29 61 L43 45 L35 46 Z",fill:"#ffd22e",stroke:"#e89b00","stroke-width":1});
 if(!sunny&&!partly&&!cloud&&!rain&&!thunder)add("path",{d:"M10 43 C5 42 6 34 12 32 C13 24 23 21 29 26 C34 16 49 21 50 31 C59 31 60 42 53 45 Z",fill:"#f7fbff",stroke:"#829bb1","stroke-width":2.4});
 return svg;
}
function renderSevenDayVisual(host,rows,historical=false){
 const strip=node("div",undefined,"taiwan-style-seven-day unified-seven-day");
 const makeRow=cls=>node("div",undefined,"taiwan-seven-row "+cls);
 const dates=makeRow("taiwan-seven-dates"),temps=makeRow("taiwan-seven-temps"),weather=makeRow("taiwan-seven-weather"),rain=makeRow("taiwan-seven-rain");
 rows.forEach(r=>{
  const dayIndex=new Date(r.date+"T12:00:00Z").getUTCDay(),weekend=dayIndex===0||dayIndex===6;
  const d=node("div",undefined,"taiwan-seven-cell"+(weekend?" weekend":""));d.append(node("strong",r.date.slice(5).replace("-","/")),node("small",["日","一","二","三","四","五","六"][dayIndex]));dates.append(d);
  const t=node("div",undefined,"taiwan-seven-cell temp-labels");t.append(node("strong",Number.isFinite(r.high)?r.high.toFixed(0)+"°":"—","temp-high"),node("strong",Number.isFinite(r.low)?r.low.toFixed(0)+"°":"—","temp-low"));temps.append(t);
  const w=node("div",undefined,"taiwan-seven-cell"+(weekend?" weekend":""));const code=Number.isFinite(r.code)?r.code:null;const label=historical?(!Number.isFinite(r.prob)?"歷史資料不足":r.prob>=60?"歷史常有雨":r.prob>=30?"歷史偶有雨":"歷史較少雨"):(r.label||"資料不足");w.append(createWeatherIcon(code,historical,r.prob),node("strong",label));weather.append(w);
  const rr=node("div",undefined,"taiwan-seven-cell"+(weekend?" weekend":""));rr.append(node("small",historical?"歷史降雨頻率":"降雨機率"),node("strong",Number.isFinite(r.prob)?r.prob.toFixed(0)+"%":"—","taiwan-rain-prob"),node("small",historical?"歷史日均雨量":"累積雨量"),node("strong",Number.isFinite(r.rain)?r.rain.toFixed(1)+" mm":"—","taiwan-rain-mm"));rain.append(rr);
 });
 strip.append(dates);
 const graph=node("div",undefined,"seven-day-inline-graph");
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 700 190");svg.setAttribute("role","img");svg.setAttribute("aria-label",historical?"歷史平均最高最低氣溫":"七天最高最低氣溫及體感");svg.style.width="100%";svg.style.minWidth="658px";svg.style.display="block";
 const vals=rows.flatMap(r=>[r.high,r.low,r.feel].filter(Number.isFinite));if(vals.length){const min=Math.min(...vals)-2,max=Math.max(...vals)+2,x=i=>45+i*610/6,y=v=>160-(v-min)/(max-min||1)*125;
 for(let j=0;j<3;j++){const line=document.createElementNS(svg.namespaceURI,"line");line.setAttribute("x1","35");line.setAttribute("x2","670");line.setAttribute("y1",20+j*62);line.setAttribute("y2",20+j*62);line.setAttribute("stroke","#dce5e9");svg.append(line)}
 const series=[{key:"high",color:"#ef6b54"},{key:"low",color:"#3198dc"},{key:"feel",color:"#d49b22"}].filter(s=>rows.some(r=>Number.isFinite(r[s.key])));
 series.forEach(s=>{const pts=rows.map((r,i)=>Number.isFinite(r[s.key])?[x(i),y(r[s.key])]:null).filter(Boolean);if(pts.length>1){const p=document.createElementNS(svg.namespaceURI,"polyline");p.setAttribute("points",pts.map(p=>p.join(",")).join(" "));p.setAttribute("fill","none");p.setAttribute("stroke",s.color);p.setAttribute("stroke-width","3");svg.append(p)}pts.forEach(p=>{const c=document.createElementNS(svg.namespaceURI,"circle");c.setAttribute("cx",p[0]);c.setAttribute("cy",p[1]);c.setAttribute("r","3.5");c.setAttribute("fill",s.color);svg.append(c)})});
 rows.forEach((r,i)=>{for(const k of ["high","low","feel"]){if(!Number.isFinite(r[k]))continue;const tx=document.createElementNS(svg.namespaceURI,"text");tx.setAttribute("x",x(i));tx.setAttribute("y",y(r[k])+(k==="high"?-9:k==="low"?17:0));tx.setAttribute("text-anchor","middle");tx.setAttribute("font-size","13");tx.setAttribute("font-weight","700");tx.setAttribute("fill",k==="high"?"#ef6b54":k==="low"?"#3198dc":"#b98517");tx.textContent=r[k].toFixed(0)+"°";svg.append(tx)}});
 }
 graph.append(svg);const legend=node("div",undefined,"seven-day-legend");legend.append(node("span",historical?"● 歷史平均最高溫":"● 最高溫","legend-high"),node("span",historical?"● 歷史平均最低溫":"● 最低溫","legend-low"));if(!historical)legend.append(node("span","● 最高體感","legend-feel"));graph.append(legend);strip.append(graph,weather,rain);host.append(strip);
}

async function showReport(){
 const host=$("report");host.replaceChildren();const course=S.course,date=$("departure").value;
 if(!course||!date)return;
 host.append(node("h2",course.name+"｜"+formatCourseDate(date,course.timezone)));
 await renderCourseSevenDayReport(host,course,date);
}
async function renderCourseSevenDayReport(host,course,startDate){
 const dates=Array.from({length:7},(_,i)=>add(startDate,i));
 const leadFor=date=>Math.floor((Date.parse(date+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);
 const report=section(host,"出發日 7 天摘要");
 report.append(node("p",course.name+"｜"+dates[0]+" ～ "+dates[6],"data-note"));
 const daily=S.forecast?.courses?.find(x=>x.course.id===course.id)?.daily;
 let historical=[];
 const needsHistory=dates.some(date=>leadFor(date)>15||leadFor(date)<0||!(daily?.time||[]).includes(date));
 if(needsHistory){
  try{const result=await fetchCourseHistoricalWeekNormals(course,dates);historical=result.days||[]}
  catch(e){report.append(node("p","部分日期歷史資料暫時無法取得："+e.message,"risk-summary"))}
 }
 const wxLabel=c=>!Number.isFinite(c)?"歷史氣候參考":c===0?"晴朗":c<=2?"晴時多雲":c===3?"陰天":c>=51&&c<=57?"毛毛雨":c>=61&&c<=67?"降雨":c>=80&&c<=82?"陣雨":c>=95?"雷雨":"多雲";
 const rows=dates.map(date=>{
  const i=(daily?.time||[]).indexOf(date),h=historical.find(x=>x.date===date),actual=leadFor(date)>=0&&leadFor(date)<=15&&i>=0;
  const code=actual?daily.weather_code?.[i]:null;
  return {date,actual,code,high:actual?daily.temperature_2m_max?.[i]:h?.highMean,low:actual?daily.temperature_2m_min?.[i]:h?.lowMean,feel:actual?daily.apparent_temperature_max?.[i]:null,prob:actual?daily.precipitation_probability_max?.[i]:h?.rainFrequency,rain:actual?daily.precipitation_sum?.[i]:h?.rainMean,label:actual?wxLabel(code):!Number.isFinite(h?.rainFrequency)?"歷史資料不足":h.rainFrequency>=60?"歷史常有雨":h.rainFrequency>=30?"歷史偶有雨":"歷史較少雨"};
 });
 const pages=node("div",undefined,"departure-week-pages");let pageIndex=0;
 const renderPage=()=>{
  pages.replaceChildren();const pageRows=rows.slice(pageIndex*5,pageIndex*5+5);
  const page=node("section",undefined,"departure-five-day-page");
  page.append(node("h4","第 "+(pageIndex+1)+" 頁｜"+pageRows[0].date+" ～ "+pageRows[pageRows.length-1].date));
  const datesRow=node("div",undefined,"departure-five-dates");
  pageRows.forEach(r=>{const wd=new Date(r.date+"T12:00:00Z").getUTCDay(),d=node("div",undefined,"departure-five-date"+([0,6].includes(wd)?" weekend-red":""));d.append(node("strong",r.date.slice(5).replace("-","/")),node("small","週"+["日","一","二","三","四","五","六"][wd]));datesRow.append(d)});
  page.append(datesRow);
  const chartWrap=node("div",undefined,"departure-five-chart");
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 700 190");svg.setAttribute("role","img");svg.setAttribute("aria-label","每日最高溫、最低溫及最高體感溫度曲線");svg.style.width="100%";svg.style.display="block";
  const values=pageRows.flatMap(r=>[r.high,r.low,r.feel].filter(Number.isFinite));
  if(values.length){const lo=Math.min(...values)-2,hi=Math.max(...values)+2,x=i=>70+i*560/Math.max(1,pageRows.length-1),y=v=>155-(v-lo)/(hi-lo||1)*115;
   [25,85,145].forEach(yy=>{const l=document.createElementNS(svg.namespaceURI,"line");l.setAttribute("x1",35);l.setAttribute("x2",680);l.setAttribute("y1",yy);l.setAttribute("y2",yy);l.setAttribute("stroke","#dce5e9");svg.append(l)});
   [{key:"high",color:"#ef6b54"},{key:"low",color:"#3198dc"},{key:"feel",color:"#d49b22"}].filter(s=>pageRows.some(r=>Number.isFinite(r[s.key]))).forEach(s=>{const pts=pageRows.map((r,i)=>Number.isFinite(r[s.key])?[x(i),y(r[s.key])]:null).filter(Boolean);if(pts.length>1){const p=document.createElementNS(svg.namespaceURI,"polyline");p.setAttribute("points",pts.map(p=>p.join(",")).join(" "));p.setAttribute("fill","none");p.setAttribute("stroke",s.color);p.setAttribute("stroke-width","4");p.setAttribute("stroke-linecap","round");p.setAttribute("stroke-linejoin","round");svg.append(p)}pts.forEach((p,i)=>{const dot=document.createElementNS(svg.namespaceURI,"circle");dot.setAttribute("cx",p[0]);dot.setAttribute("cy",p[1]);dot.setAttribute("r","4");dot.setAttribute("fill",s.color);svg.append(dot);const tx=document.createElementNS(svg.namespaceURI,"text");tx.setAttribute("x",p[0]);tx.setAttribute("y",p[1]+(s.key==="high"?-10:s.key==="low"?17:2));tx.setAttribute("text-anchor","middle");tx.setAttribute("font-size","15");tx.setAttribute("font-weight","800");tx.setAttribute("fill",s.color);tx.textContent=pageRows[i][s.key].toFixed(0)+"°";svg.append(tx)})});
  }
  chartWrap.append(svg);const legend=node("div",undefined,"departure-five-legend");legend.append(node("span","● 最高溫","legend-high"),node("span","● 最低溫","legend-low"),node("span","● 體感溫度","legend-feel"));chartWrap.append(legend);page.append(chartWrap);
  const cards=node("div",undefined,"departure-five-cards");
  pageRows.forEach(r=>{const wd=new Date(r.date+"T12:00:00Z").getUTCDay(),day=node("button",undefined,"departure-five-card"+(r.date===startDate?" is-departure":""));day.type="button";day.append(createWeatherIcon(r.code,!r.actual,r.prob),node("strong",r.label));day.append(node("span",Number.isFinite(r.high)&&Number.isFinite(r.low)?r.high.toFixed(1)+"° / "+r.low.toFixed(1)+"°C":"溫度資料不足"));day.append(node("small",r.actual?"降雨機率":"歷史降雨頻率"),node("b",Number.isFinite(r.prob)?r.prob.toFixed(0)+"%":"—","departure-rain-prob"),node("small",r.actual?"累積雨量":"歷史日均雨量"),node("b",Number.isFinite(r.rain)?r.rain.toFixed(1)+" mm":"—","departure-rain-mm"));if([0,6].includes(wd))day.classList.add("weekend");day.addEventListener("click",()=>renderDepartureDayPage(host,course,r));cards.append(day)});
  page.append(cards);
  const nav=node("div",undefined,"departure-page-nav");const prev=node("button","上一頁");prev.disabled=pageIndex===0;prev.addEventListener("click",()=>{pageIndex--;renderPage()});const label=node("span",(pageIndex+1)+" / "+Math.ceil(rows.length/5));const next=node("button","下一頁");next.disabled=(pageIndex+1)*5>=rows.length;next.addEventListener("click",()=>{pageIndex++;renderPage()});nav.append(prev,label,next);page.append(nav);pages.append(page);
 };
 report.append(pages);
 report.append(node("p","每頁最多顯示 5 天；點選任一天即可展開逐時預報或歷史資料。前 16 天使用逐日預報，超出範圍以歷史同期資料補充。","long-range-note"));
}
async function renderDepartureDayPage(host,course,row){
 host.replaceChildren();
 const back=node("button","← 返回出發日 7 天摘要","departure-detail-back");back.type="button";
 back.addEventListener("click",()=>showReport());
 host.append(back);
 const loading=node("p","正在讀取所選日期的天氣資料…","data-note");host.append(loading);
 try{
  await renderDepartureDayDetails(host,course,row,row.date);
 }catch(error){
  const card=node("section",undefined,"weather-card");
  card.append(node("h3","天氣資料讀取失敗"),node("p","無法產生此日圖表："+(error?.message||String(error)),"risk-summary"));
  const retry=node("button","重新讀取此日資料");retry.type="button";retry.addEventListener("click",()=>renderDepartureDayPage(host,course,row));card.append(retry);host.append(card);
 }finally{loading.remove()}
}

async function renderDepartureDayDetails(host,course,row,departureDate){
 const actual=row.actual,card=section(host,(actual?"逐時天氣資料｜":"歷史資料頁面｜")+row.date+"（"+course.name+"）");
 card.classList.add("departure-day-details");
 if(!actual){
  card.append(node("p","此日期已超出 16 天逐日預報範圍，以下僅提供歷史同期統計，不代表該日實際天氣，也不提供虛構的逐時降雨機率或雨量。","long-range-note"));
  const result=await fetchCourseHistoricalWeekNormals(course,[row.date]);
  const h=result.days?.[0];
  const stats=node("div",undefined,"results");
  for(const [label,value] of [["歷史平均最高溫",h?.highMean],["歷史平均最低溫",h?.lowMean],["歷史降雨頻率",h?.rainFrequency],["歷史日均雨量",h?.rainMean]]){
   const item=node("article",undefined,"result-card");item.append(node("p",label),node("strong",Number.isFinite(value)?value.toFixed(1)+(label.includes("溫")?" °C":label.includes("頻率")?"%":" mm"):"資料不足"));stats.append(item);
  }
  card.append(stats);return;
 }
 let forecast=S.forecast?.courses?.find(x=>x.course.id===course.id);
 if(!forecast){
  const result=await fetchCourseForecast([course]);
  S.forecast=result;
  forecast=result.courses?.find(x=>x.course.id===course.id);
 }
 if(!forecast?.hourly?.time?.length){card.append(node("p","球場逐時預報資料尚未取得，請稍後重試。","risk-summary"));return}
 const hourly=forecast.hourly,indices=hourly.time.map((t,i)=>String(t).slice(0,10)===row.date&&Number(String(t).slice(11,13))>=6&&Number(String(t).slice(11,13))<=18?i:-1).filter(i=>i>=0);
 if(!indices.length){card.append(node("p","此日期未取得 06:00–18:00 逐時預報。","risk-summary"));return}
 card.append(node("p","資料範圍：06:00–18:00｜逐時預報資料。","data-note"));
 const records=indices.map(i=>({time:String(hourly.time[i]).slice(11,16),code:hourly.weather_code?.[i],prob:hourly.precipitation_probability?.[i],rain:hourly.precipitation?.[i]??hourly.rain?.[i],temp:hourly.temperature_2m?.[i],feel:hourly.apparent_temperature?.[i],wind:hourly.wind_speed_10m?.[i],humidity:hourly.relative_humidity_2m?.[i]}));
 const table=node("div",undefined,"departure-hourly-table");
 const header=node("div",undefined,"departure-hour-row is-head");
 ["時間","天氣","機率 %","雨量 mm","降雨判讀","氣溫 °C","體感 °C"].forEach(x=>header.append(node("span",x)));table.append(header);
 const label=c=>!Number.isFinite(c)?"—":c===0?"晴朗":c<=2?"晴時多雲":c===3?"陰／多雲":c<=48?"多雲":c<=57?"毛毛雨":c<=67?"降雨":c<=82?"陣雨":c>=95?"雷雨":"多雲";
 for(const r of records){const line=node("div",undefined,"departure-hour-row");const wx=node("span",undefined,"hour-weather-cell");wx.append(createWeatherIcon(r.code,false,r.prob),node("small",label(r.code)));const rainRisk=!Number.isFinite(r.prob)?"—":r.prob>=50?"較高降雨風險":r.prob>=20?"留意零星降雨":"低降雨風險";line.append(node("span",r.time),wx,node("span",Number.isFinite(r.prob)?r.prob+"%":"—"),node("span",Number.isFinite(r.rain)?r.rain.toFixed(1)+" mm":"—"),node("span",rainRisk),node("span",Number.isFinite(r.temp)?r.temp.toFixed(1):"—"),node("span",Number.isFinite(r.feel)?r.feel.toFixed(1):"—"));table.append(line)}
 card.append(node("h4","逐時天氣明細｜06:00–18:00","departure-hourly-title"),table);
 const iconLine=node("div",undefined,"hourly-weather-icon-line");records.forEach(r=>iconLine.append(createWeatherIcon(r.code,false,r.prob)));card.append(iconLine);
 svgChart(card,"每小時降雨機率圖（%）",[{label:"降雨機率",values:records.map(r=>r.prob)}],"%");
 svgChart(card,"每小時預報雨量圖（mm）",[{label:"降雨量",values:records.map(r=>r.rain)}],"mm");
 svgChart(card,"逐小時氣溫與體感溫度（°C）",[{label:"氣溫",values:records.map(r=>r.temp)},{label:"體感溫度",values:records.map(r=>r.feel)}],"°C");
 const note=node("p","逐時資料來源：Open-Meteo 球場座標預報。圖表與表格以所選日期當地時間呈現。","data-note");card.append(note);
}

async function run(){
 const button=$("run");button.disabled=true;$("report").replaceChildren();
 try{
  const selectedDate=$("departure").value;
  S.course=S.directory?.courses?.find(c=>c.id===$("course").value)||null;
  if(!selectedDate||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(selectedDate))throw new Error("請先選擇有效的出發日期。");
  if(!S.course)throw new Error("請先選擇已完成座標核實的球場。");
  setStatus("正在產生七天天氣及適打報告…");
  const leadDays=Math.floor((Date.parse(selectedDate+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);
  S.forecast=null;S.seasonal=null;
  let forecastWarning="";
  if(leadDays<=15&&leadDays>=0){
   try{S.forecast=await fetchCourseForecast([S.course]);}
   catch(error){forecastWarning="逐日預報暫時無法連線，將改以歷史同期資料補充。";}
  }
  await showReport();
  const hasReport=$("report").children.length>1;
  if(!hasReport)throw new Error("報告內容未能建立，請確認球場座標及日期。");
  setStatus(forecastWarning||"完成｜已產生出發日起七天報告。");
 }catch(error){
  setStatus("產生報告失敗："+(error?.message||String(error)));
  const report=$("report");report.replaceChildren();
  const message=node("section",undefined,"weather-card");
  message.append(node("h3","目前無法產生報告"),node("p",error?.message||String(error),"risk-summary"));
  const retry=node("button","重新產生報告");retry.type="button";retry.addEventListener("click",run);message.append(retry);report.append(message);
 }finally{button.disabled=!S.course}
}

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
 $("climate-explorer").classList.add("is-subpage");
 overview.hidden=true;status.hidden=true;
 climateBackAction=backAction||null;
 if(!climateHistoryReady){history.replaceState({climateHome:true},"",location.href);climateHistoryReady=true;}
 history.pushState({climateFlow:true},"",location.href);
 let nav=$("flow-nav");if(!nav){nav=node("div",undefined,"flow-nav");nav.id="flow-nav";$("climate-explorer").insertBefore(nav,out)}
 nav.replaceChildren();
 const h=node("h2",title,"flow-title");nav.append(h);
 const actions=node("div",undefined,"flow-actions");
 if(backAction){const back=node("button","← 返回上一層","flow-back");back.type="button";back.addEventListener("click",()=>history.back());actions.append(back)}
 const home=node("button","⌂ 回首頁","flow-home");home.type="button";home.addEventListener("click",()=>{climateBackAction=null;showCountryOverview();history.pushState({homeExitGuard:true},"",location.href)});actions.append(home);
 nav.append(actions);
 out.hidden=false;status.hidden=false;
}
function showCountryOverview(){
 climateBackAction=null;
 $("climate-explorer").classList.remove("is-subpage");
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
const SUBREGION_CATALOG={
 JP:{
  "北海道":["札幌・北廣島","苫小牧・千歲","二世谷・俱知安","富良野・旭川","帶廣・釧路"],
  "東北":["青森・弘前","秋田","盛岡","仙台・松島","山形","福島・郡山"],
  "關東":["東京・多摩","橫濱・湘南","千葉・房總","埼玉","栃木・茨城","群馬"],
  "中部":["新潟","長野・輕井澤","山梨・富士五湖","靜岡","愛知・名古屋","岐阜・三重北部"],
  "關西":["大阪・神戶","京都","滋賀","奈良","和歌山"],
  "中國地方":["岡山","廣島","山口","島根","鳥取"],
  "四國":["德島","香川","愛媛","高知"],
  "九州":["福岡","佐賀・長崎","熊本","大分","宮崎","鹿兒島"],
  "沖繩":["那霸・南部","恩納・中部","名護・北部","宮古島","石垣島"]
 },
 KR:{
  "首都圈":["首爾","仁川","京畿道南部","京畿道北部"],
  "江原道":["春川","原州","平昌・旌善","江陵・束草"],
  "忠清道":["大田","天安・牙山","清州","忠州"],
  "全羅道":["全州","群山・益山","光州","麗水・順天"],
  "慶尚道":["釜山","大邱","蔚山","慶州・浦項","昌原・巨濟"],
  "濟州島":["濟州市","西歸浦"]
 },
 CN:{
  "華北":["北京","天津","石家莊","太原・呼和浩特"],
  "東北":["瀋陽","大連","長春","哈爾濱"],
  "華東":["上海","蘇州・無錫","杭州・寧波","南京","青島・濟南"],
  "華中":["武漢","長沙","鄭州"],
  "華南":["廣州・佛山","深圳・東莞","珠海・中山","廈門・泉州","海口・三亞"],
  "西南":["成都","重慶","昆明","貴陽"],
  "西北":["西安","蘭州","銀川・西寧","烏魯木齊"]
 },
 VN:{
  "北部":["河內","海防・下龍","寧平","沙壩"],
  "中北部":["清化","榮市・乂安","順化"],
  "中部沿海":["峴港","會安","廣南・廣義","歸仁","芽莊・金蘭"],
  "西原":["大叻","邦美蜀","波來古"],
  "東南部":["胡志明市","平陽・同奈","頭頓"],
  "湄公河三角洲":["芹苴","富國島","美拖・迪石"]
 },
 TH:{
  "北部":["清邁","清萊","南邦"],
  "東北部":["呵叻","孔敬","烏隆他尼"],
  "中部":["曼谷","華欣・七岩","北碧"],
  "東部":["芭達雅","羅勇","尖竹汶"],
  "西部":["佛統","叻丕"],
  "南部":["普吉","攀牙","蘇梅島","合艾"]
 },
 MY:{
  "北馬":["檳城","吉打・浮羅交怡","霹靂"],
  "中馬":["吉隆坡","雪蘭莪","布城"],
  "南馬":["柔佛新山","馬六甲","森美蘭"],
  "東海岸":["關丹","登嘉樓","哥打峇魯"],
  "沙巴":["亞庇","山打根"],
  "砂拉越":["古晉","美里","詩巫"]
 },
 SG:{"新加坡全島":["市中心","西部","北部","東部"]},
 ID:{
  "蘇門答臘":["棉蘭","巨港","巴淡島"],
  "爪哇":["雅加達","萬隆","日惹","三寶瓏","泗水"],
  "峇里及努沙登加拉":["峇里島","龍目島"],
  "加里曼丹":["巴里巴板","坤甸"],
  "蘇拉威西":["望加錫","美娜多"],
  "馬魯古":["安汶"],
  "巴布亞":["查亞普拉"]
 }
};
const JP_PREFECTURES={
"北海道":["北海道"],"東北":["青森縣","岩手縣","宮城縣","秋田縣","山形縣","福島縣"],
"關東":["東京都","神奈川縣","千葉縣","埼玉縣","茨城縣","栃木縣","群馬縣"],
"中部":["新潟縣","富山縣","石川縣","福井縣","山梨縣","長野縣","岐阜縣","靜岡縣","愛知縣"],
"關西":["三重縣","滋賀縣","京都府","大阪府","兵庫縣","奈良縣","和歌山縣"],
"中國地方":["鳥取縣","島根縣","岡山縣","廣島縣","山口縣"],
"四國":["德島縣","香川縣","愛媛縣","高知縣"],
"九州":["福岡縣","佐賀縣","長崎縣","熊本縣","大分縣","宮崎縣","鹿兒島縣"],
"沖繩":["沖繩縣"]
};
const JP_PREFECTURE_CLUSTERS={
"北海道":["札幌・北廣島","苫小牧・千歲","二世谷・俱知安","旭川・富良野","帶廣・十勝","釧路・根室","函館・道南","網走・知床"],
"青森縣":["青森・弘前","八戶・三澤"],"岩手縣":["盛岡・雫石","花卷・北上","一關・平泉"],
"宮城縣":["仙台・松島","大崎・鳴子","石卷・三陸"],"秋田縣":["秋田・男鹿","大館・能代","橫手・湯澤"],
"山形縣":["山形・天童","米澤・置賜","酒田・鶴岡"],"福島縣":["福島・二本松","郡山・磐梯","會津・白河"],
"東京都":["多摩・八王子","東京灣岸"],"神奈川縣":["橫濱・川崎","湘南・鎌倉","箱根・相模湖"],
"千葉縣":["成田・佐倉","千葉・市原","房總・木更津","茂原・九十九里"],"埼玉縣":["埼玉南部","熊谷・深谷","秩父・飯能"],
"茨城縣":["水戶・笠間","筑波・土浦","鹿島・鉾田","常陸太田・大子"],"栃木縣":["宇都宮・鹿沼","那須・塩原","日光・鬼怒川","小山・栃木市"],
"群馬縣":["前橋・高崎","太田・桐生","草津・沼田"],"新潟縣":["新潟・阿賀野","長岡・燕三條","上越・妙高"],
"富山縣":["富山・立山","高岡・氷見"],"石川縣":["金澤・白山","能登"],"福井縣":["福井・坂井","敦賀・若狹"],
"山梨縣":["甲府・笛吹","富士五湖・河口湖"],"長野縣":["長野・須坂","輕井澤・佐久","松本・安曇野","諏訪・蓼科","伊那・木曾"],
"岐阜縣":["岐阜・各務原","多治見・可兒","郡上・飛驒"],"靜岡縣":["靜岡・清水","濱松・濱名湖","御殿場・富士","伊豆・熱海"],
"愛知縣":["名古屋・尾張","豐田・三河","知多半島"],"三重縣":["四日市・鈴鹿","津・松阪","伊勢・志摩"],
"滋賀縣":["大津・草津","近江八幡・彦根"],"京都府":["京都市區","龜岡・丹波","舞鶴・丹後"],
"大阪府":["大阪北部","大阪東部","大阪南部"],"兵庫縣":["神戶・六甲","三田・篠山","姬路・播磨","淡路島"],
"奈良縣":["奈良・生駒","吉野・五條"],"和歌山縣":["和歌山市・紀北","田邊・白濱"],
"鳥取縣":["鳥取・岩美","米子・大山"],"島根縣":["松江・出雲","濱田・益田"],
"岡山縣":["岡山・倉敷","津山・美作"],"廣島縣":["廣島・東廣島","福山・尾道"],"山口縣":["山口・防府","下關・宇部"],
"德島縣":["德島・鳴門","阿南・祖谷"],"香川縣":["高松・坂出","丸龜・琴平"],"愛媛縣":["松山・今治","新居濱・西條","宇和島"],"高知縣":["高知・南國","四萬十・足摺"],
"福岡縣":["福岡・糸島","北九州・筑豐","久留米・筑後"],"佐賀縣":["佐賀・鳥栖","唐津・伊万里"],
"長崎縣":["長崎・諫早","佐世保・平戶"],"熊本縣":["熊本・菊池","阿蘇・山鹿","八代・天草"],
"大分縣":["大分・別府","由布・九重","日田・中津"],"宮崎縣":["宮崎・日南","都城・霧島"],"鹿兒島縣":["鹿兒島・指宿","霧島・姶良","奄美"],
"沖繩縣":["那霸・南部","恩納・中部","名護・北部","宮古島","石垣島"]
};
function renderJapanPrefectureMenu(region){
 const out=$("region-report");out.replaceChildren();
 showClimateScreen("日本 🇯🇵｜"+region+"｜選擇都道府縣",()=>renderRegionClimate());
 const grid=node("div",undefined,"region-choice-grid subregion-choice-grid");
 for(const prefecture of JP_PREFECTURES[region]||[]){
  const card=node("button",undefined,"region-choice subregion-choice");card.type="button";
  card.append(node("strong",prefecture));
  card.addEventListener("click",()=>renderJapanClusterMenu(region,prefecture));
  grid.append(card);
 }
 out.append(grid);
}
function coursesForJapanCluster(courses,prefecture,cluster){
 if(prefecture==="沖繩縣"){
  if(cluster.includes("南部"))return courses.filter(c=>c.area==="南部"||/那霸|糸滿|八重瀨/.test(c.city||""));
  if(cluster.includes("中部"))return courses.filter(c=>c.area==="中部"||/恩納/.test(c.city||""));
  if(cluster.includes("北部"))return courses.filter(c=>c.area==="北部"||/名護/.test(c.city||""));
  return courses.filter(c=>/宮古|石垣/.test((c.city||"")+" "+(c.address||"")));
 }
 const terms=cluster.split(/[・／]/).map(x=>x.trim()).filter(x=>x.length>1);
 return courses.filter(c=>terms.some(t=>[c.city,c.address,c.area].filter(Boolean).join(" ").includes(t)));
}
function renderJapanClusterMenu(region,prefecture){
 const out=$("region-report");out.replaceChildren();
 showClimateScreen("日本 🇯🇵｜"+prefecture,()=>{
  if(prefecture==="北海道"||prefecture==="沖繩縣")renderRegionClimate();
  else renderJapanPrefectureMenu(region);
 });
 const clusters=JP_PREFECTURE_CLUSTERS[prefecture]||[prefecture.replace("縣","").replace("府","")];
 const grid=node("div",undefined,"region-choice-grid subregion-choice-grid");
 for(const cluster of clusters){
  const card=node("button",undefined,"region-choice subregion-choice");card.type="button";card.append(node("strong",cluster));
  card.addEventListener("click",()=>{
   const regionCourses=S.directory.courses.filter(c=>c.countryCode==="JP"&&c.enabled&&((region==="沖繩"&&["Okinawa","沖繩"].includes(c.region))||c.region===region));
   const prefectureCourses=regionCourses.filter(c=>(c.prefecture||"")===prefecture || (prefecture==="沖繩縣"&&c.region==="Okinawa"));
   const selected=coursesForJapanCluster(prefectureCourses,prefecture,cluster);
   renderRegionMonths("JP",region,monthOptions(),selected,cluster);
  });
  grid.append(card);
 }
 out.append(grid);
}
function coursesForSubregion(courses,subregion){
 const tokens=subregion.split(/[・／]/).map(x=>x.trim()).filter(Boolean);
 return courses.filter(course=>{
  const hay=[course.city,course.area,course.name,course.nameLocal,course.address].filter(Boolean).join(" ");
  return tokens.some(token=>hay.toLowerCase().includes(token.toLowerCase()));
 });
}
function renderSubregionMenu(country,region){
 const out=$("region-report");out.replaceChildren();
 const countryName=S.directory.countries.find(c=>c.code===country)?.nameZh||country;
 if(country==="JP"){
  if(region==="北海道"){renderJapanClusterMenu(region,"北海道");return}
  if(region==="沖繩"){renderJapanClusterMenu(region,"沖繩縣");return}
  renderJapanPrefectureMenu(region);return
 }
 const all=S.directory.courses.filter(c=>c.countryCode===country&&c.enabled);
 const regionCourses=all.filter(c=>(country==="JP"&&["Okinawa","沖繩"].includes(c.region)?"沖繩":c.region)===region);
 const subregions=SUBREGION_CATALOG[country]?.[region]||[];
 showClimateScreen(countryName+"｜"+region+"｜選擇次分區",()=>renderRegionClimate());
 const grid=node("div",undefined,"region-choice-grid subregion-choice-grid");
 for(const subregion of subregions){
  const matches=coursesForSubregion(regionCourses,subregion);
  const card=node("button",undefined,"region-choice subregion-choice");card.type="button";
  card.append(node("strong",subregion));
  card.addEventListener("click",()=>renderRegionMonths(country,region,monthOptions(),matches,subregion));
  grid.append(card);
 }
 out.append(grid);
}
function initClimateExplorer(){
 const overview=$("asia-overview"),cc=$("climate-country");
 for(const c of S.directory.countries){
  const count=S.directory.courses.filter(x=>x.countryCode===c.code&&x.enabled&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)).length;
  const flags={JP:"🇯🇵",KR:"🇰🇷",CN:"🇨🇳",VN:"🇻🇳",TH:"🇹🇭",MY:"🇲🇾",SG:"🇸🇬",ID:"🇮🇩"};
  const tile=node("button",undefined,"overview-tile country-tile");tile.type="button";tile.append(node("span",flags[c.code]||"🌏","country-flag"),node("strong",c.nameZh));
  tile.addEventListener("click",()=>{cc.value=c.code;renderRegionClimate()});overview.append(tile);cc.add(new Option(c.nameZh,c.code));
 }
 cc.value="JP";cc.addEventListener("change",renderRegionClimate);$("region-report").hidden=true;$("climate-status").textContent="請選擇國家，進入該國地理分區。";
}
async function renderRegionClimate(){
 const country=$("climate-country").value,out=$("region-report"),status=$("climate-status");
 out.replaceChildren();const months=monthOptions(),all=S.directory.courses.filter(c=>c.countryCode===country&&c.enabled),catalog=REGION_CATALOG[country]||[];
 const normalizeRegion=r=>(country==="JP"&&["Okinawa","沖繩"].includes(r)?"沖繩":r);
 const defined=[...new Set([...catalog,...all.map(c=>c.region).filter(Boolean)].map(normalizeRegion))];
 const countryFlags={JP:"🇯🇵",KR:"🇰🇷",CN:"🇨🇳",VN:"🇻🇳",TH:"🇹🇭",MY:"🇲🇾",SG:"🇸🇬",ID:"🇮🇩"};
 showClimateScreen((S.directory.countries.find(c=>c.code===country)?.nameZh||country)+" "+(countryFlags[country]||"🌏")+"｜選擇地理分區",showCountryOverview);
 const available=all.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));
 const selectedCountry=S.directory.countries.find(c=>c.code===country);

 const grid=node("div",undefined,"region-choice-grid");
 for(const region of defined){
  const courses=all.filter(c=>normalizeRegion(c.region)===region);
  const valid=courses.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));
  const card=node("button",undefined,"region-choice");card.type="button";
  card.append(node("strong",region),node("span",courses.length?courses.length+" 個球場資料／"+valid.length+" 個有效座標":"球場資料待建置"),node("small","查看三個月天氣分區表"));
  card.addEventListener("click",()=>renderSubregionMenu(country,region));
  grid.append(card);
 }
 out.append(grid);
 status.textContent=(selectedCountry?.nameZh||country)+"｜"+defined.length+" 個地理分區。點選分區即可查看三個月總表。"+(available.length?" 已有 "+available.length+" 個具有效座標的球場。":" 目前尚無有效球場座標。");
}
async function renderRegionMonths(country,region,months,courses,subregion=""){
 const out=$("region-report"),status=$("climate-status");out.replaceChildren();
 const scopeName=region+(subregion?"｜"+subregion:"");
 showClimateScreen("② "+(S.directory.countries.find(c=>c.code===country)?.nameZh||country)+"｜"+scopeName+"｜三個月天氣總表",()=>renderSubregionMenu(country,region));
 const valid=courses.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));
 const records=(await Promise.allSettled(valid.map(c=>fetchCourseSeasonalForecast(c)))).filter(x=>x.status==="fulfilled").map(x=>x.value);
 const table=node("div",undefined,"region-table-wrap"),tbl=node("table",undefined,"region-table region-matrix"),thead=node("thead"),hr=node("tr");
 ["天氣指標",...months.map(m=>m)].forEach(t=>hr.append(node("th",t)));thead.append(hr);tbl.append(thead);
 const body=node("tbody");
 const historicalResults=(await Promise.allSettled(valid.map(c=>fetchCourseHistoricalMonthlyClimate(c)))).filter(x=>x.status==="fulfilled").map(x=>x.value);
 const monthData=months.map(month=>{
  const season=records.map(rec=>{
   const i=(rec.monthly?.time||[]).findIndex(t=>t.slice(0,7)===month);
   return i<0?null:{rain:rec.monthly.precipitation_mean?.[i],anomaly:rec.monthly.precipitation_anomaly?.[i]};
  }).filter(Boolean);
  const hist=historicalResults.map(rec=>rec.monthly?.find(x=>x.month===Number(month.slice(5,7)))).filter(Boolean);
  const avg=(arr,key)=>{const v=arr.map(x=>x[key]).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  const seasonRain=avg(season,"rain"),seasonAnomaly=avg(season,"anomaly");
  const historicalRain=avg(hist,"rain"),rain=Number.isFinite(seasonRain)?seasonRain:historicalRain;
  const rainDays=avg(hist,"rainDays"),low=avg(hist,"low"),high=avg(hist,"high");
  const avgDaily=avg(hist,"avgDailyRain"),maxDaily=hist.length?Math.max(...hist.map(x=>x.maxDailyRain).filter(Number.isFinite)):null;
  let outlook="歷史同期參考";
  if(Number.isFinite(seasonRain)&&Number.isFinite(seasonAnomaly)){
   const baseline=seasonRain-seasonAnomaly;
   outlook=baseline>0?(seasonRain/baseline>=1.2?"季節預測偏濕":seasonRain/baseline<=.8?"季節預測偏乾":"季節預測接近常態"):"季節預測可用";
  }
  const days=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  return {month,outlook,rain,low,high,rainDays,avgDaily:Number.isFinite(avgDaily)?avgDaily:(Number.isFinite(rain)?rain/days:null),maxDaily,
   status:season.length&&hist.length?"季節預測＋歷史統計":season.length?"季節預測可用":hist.length?"歷史氣候參考":valid.length?"天氣資料暫缺":"待建置"};
 });
 const metrics=[
  {label:"月天氣總況",key:"outlook",text:true},
  {label:"歷史月平均低溫",key:"low",unit:" °C"},
  {label:"歷史月平均高溫",key:"high",unit:" °C"},
  {label:"月降雨量",key:"rain",unit:" mm"},
  {label:"歷史月降雨日數（≥1 mm）",key:"rainDays",unit:" 日"},
  {label:"歷史月平均日雨量",key:"avgDaily",unit:" mm／日"},
  {label:"歷史月最高日雨量",key:"maxDaily",unit:" mm"}
 ];
 for(const metric of metrics){
  const tr=node("tr");tr.append(node("th",metric.label));
  for(const item of monthData){
   const v=item[metric.key];
   const display=metric.text?(v??"—"):(Number.isFinite(v)?(metric.key==="rainDays"?v.toFixed(1):v.toFixed(1))+metric.unit:"—");
   tr.append(node("td",display));
  }
  body.append(tr);
 }
 const statusRow=node("tr");statusRow.append(node("th","資料狀態"));for(const item of monthData)statusRow.append(node("td",item.status));body.append(statusRow);
 const actionRow=node("tr");actionRow.append(node("th","下一步"));for(const item of monthData){const td=node("td"),btn=node("button","查看週分析","region-select");btn.type="button";btn.addEventListener("click",()=>{const group={region:scopeName,rootRegion:region,subregion,country,courses:valid,months};if(records.length){renderRegionTopWeeks(group,records,item.month)}else{renderEmptyWeekAnalysis(country,scopeName,item.month,()=>renderRegionMonths(country,region,months,valid,subregion))}});td.append(btn);actionRow.append(td)}body.append(actionRow);
 tbl.append(body);table.append(tbl);out.append(table);
 const coursePanel=node("section",undefined,"cluster-course-panel");
 coursePanel.append(node("h3","已建置球場"));

 const picker=node("select",undefined,"cluster-course-select");picker.setAttribute("aria-label","選擇已建置球場");
 picker.add(new Option(courses.length?"請選擇球場":"尚無已建置球場", ""));
 for(const course of courses){
  const hasCoords=Number.isFinite(course.latitude)&&Number.isFinite(course.longitude);
  const option=new Option(course.name+(hasCoords?"":"（座標待核實）"),course.id);
  picker.add(option);
 }
 const choose=node("button","使用此球場","cluster-course-use");choose.type="button";choose.disabled=!courses.length;
 choose.addEventListener("click",()=>{
  const course=courses.find(c=>c.id===picker.value);if(!course)return;
  $("country").value=course.countryCode;$("country").dispatchEvent(new Event("change"));
  if([...$("region").options].some(o=>o.value===course.region))$("region").value=course.region;
  $("region").dispatchEvent(new Event("change"));
  if([...$("course").options].some(o=>o.value===course.id)){
   $("course").value=course.id;$("course").dispatchEvent(new Event("change"));
  }
  $("departure").scrollIntoView({behavior:"smooth",block:"center"});
  $("course-note").textContent=Number.isFinite(course.latitude)&&Number.isFinite(course.longitude)
   ?"已選擇 "+course.name+"｜座標 "+course.latitude.toFixed(4)+", "+course.longitude.toFixed(4)+"｜"+course.coordinateStatus
   :"已選擇 "+course.name+"，但座標尚待核實，暫不能產生實際球場天氣報告。";
 });
 coursePanel.append(picker,choose);out.append(coursePanel);
 status.textContent=valid.length?"已選擇 "+scopeName+"｜球場 "+courses.length+" 個，其中 "+valid.length+" 個具有效座標，成功取得季節資料 "+records.length+" 組。":"已選擇 "+scopeName+"。此次分區尚無球場／天氣資料，但月份及週分析操作仍可使用。";
}
function renderEmptyWeekAnalysis(country,region,month,backAction){
 const out=$("region-report");out.replaceChildren();showClimateScreen("③ "+region+"｜"+month+"｜週次預覽",backAction||(()=>showCountryOverview()));
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
 const out=$("region-report");out.replaceChildren();showClimateScreen("③ "+group.region+"｜"+month+"｜本月推薦週次",()=>renderRegionMonths(group.country||$("climate-country").value,group.rootRegion||group.region,group.months||monthOptions(),group.courses,group.subregion||""));const panel=node("section",undefined,"week-recommendations");
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
 const lead=(Date.parse(week.start+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000;
 const courses=(group.courses||[]).filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)).slice(0,3);
 const dates=Array.from({length:7},(_,i)=>add(week.start,i));
 const report=section(host,(lead>=0&&lead+6<16?"七天逐日天氣預報｜":"歷史同期七天天氣參考｜")+week.start+" ～ "+week.end);
 const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
 const wxLabel=code=>{if(!Number.isFinite(code))return "資料不足";if(code===0)return "晴朗";if(code<=2)return "晴時多雲";if(code===3)return "陰天";if(code>=51&&code<=57)return "毛毛雨";if(code>=61&&code<=67)return "降雨";if(code>=80&&code<=82)return "陣雨";if(code>=95)return "雷雨";return "多雲"};
 const wxIcon=code=>!Number.isFinite(code)?"—":code===0?"☀️":code<=2?"🌤️":code===3?"☁️":code>=51&&code<=67?"🌧️":code>=80&&code<=82?"🌦️":code>=95?"⛈️":"☁️";
 let rows=[];
 if(lead>=0&&lead+6<16&&courses.length){
  let forecasts=[];try{const result=await fetchCourseForecast(courses);forecasts=result.courses||[]}catch(e){report.append(node("p","逐日預報暫時無法取得："+e.message,"risk-summary"))}
  rows=dates.map(date=>{const entries=forecasts.map(f=>{const i=f.daily.time.indexOf(date);return i<0?null:{code:f.daily.weather_code?.[i],rain:f.daily.precipitation_sum?.[i],prob:f.daily.precipitation_probability_max?.[i],low:f.daily.temperature_2m_min?.[i],high:f.daily.temperature_2m_max?.[i],feel:f.daily.apparent_temperature_max?.[i]}}).filter(Boolean);const codes=entries.map(x=>x.code).filter(Number.isFinite);const code=codes.length?codes.sort((a,b)=>codes.filter(x=>x===b).length-codes.filter(x=>x===a).length)[0]:null;return {date,code,icon:wxIcon(code),label:wxLabel(code),rain:median(entries.map(x=>x.rain)),prob:median(entries.map(x=>x.prob)),low:median(entries.map(x=>x.low)),high:median(entries.map(x=>x.high)),feel:median(entries.map(x=>x.feel))}});
  if(!rows.some(r=>Number.isFinite(r.high)||Number.isFinite(r.prob)))report.append(node("p","這七天尚無完整逐日預報，改以歷史同期資料作參考。","data-note"));
 }
 if(!rows.length||!(lead>=0&&lead+6<16&&rows.some(r=>Number.isFinite(r.high)||Number.isFinite(r.prob)))){
  let normals=[];const results=await Promise.allSettled(courses.map(c=>fetchCourseHistoricalWeekNormals(c,dates)));normals=results.filter(x=>x.status==="fulfilled").map(x=>x.value);
  rows=dates.map((date,i)=>{const samples=normals.map(n=>n.days[i]).filter(Boolean),get=k=>median(samples.map(x=>x[k]));const prob=get("rainFrequency");return {date,high:get("highMean"),low:get("lowMean"),prob,rain:get("rainMean"),icon:!Number.isFinite(prob)?"—":prob>=60?"🌧️":prob>=30?"🌦️":"🌤️",label:!Number.isFinite(prob)?"資料不足":prob>=60?"歷史常有雨":prob>=30?"歷史偶有雨":"歷史較少雨"}});
  report.append(node("p","以下為過去十年相同月日的 ERA5 歷史同期統計；降雨頻率不是未來降雨機率，氣溫與雨量不是該週預報。","long-range-note"));
 }
 renderSevenDayVisual(report,rows,!(lead>=0&&lead+6<16&&rows.some(r=>Number.isFinite(r.high)||Number.isFinite(r.prob))));
 const choose=node("button","選擇出發日期及球場","week-back");choose.type="button";choose.addEventListener("click",()=>showDepartureForm(week.start));host.append(choose);host.scrollIntoView({behavior:"smooth",block:"start"});
}

function showDepartureForm(startDate){
 $("departure").value=startDate;$("departure").min=today();$("departure").max=add(today(),89);
 $("course-note").textContent="已帶入所選週次起始日；請選擇球場及開球時間。";
 $("climate-explorer").hidden=true;
 const form=$("departure").closest(".panel");form.hidden=false;
 form.scrollIntoView({behavior:"smooth",block:"start"});
}
async function initDepartureCalendar(){
 const input=$("departure");input.type="text";input.readOnly=true;input.placeholder="選擇出發日期";input.setAttribute("aria-haspopup","dialog");
 const open=()=>{let shown=input.value||today(),month=shown.slice(0,7)+"-01";const overlay=node("div",undefined,"calendar-overlay");overlay.setAttribute("role","presentation");const dialog=node("section",undefined,"calendar-dialog");dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");const top=node("div",undefined,"calendar-top"),heading=node("strong","選取日期");const prev=node("button","‹","calendar-prev"),next=node("button","›","calendar-next");prev.type=next.type="button";top.append(heading,prev,next);const grid=node("div",undefined,"calendar-grid");dialog.append(top,grid);const actions=node("div",undefined,"calendar-actions"),cancel=node("button","取消"),confirm=node("button","確定");cancel.type=confirm.type="button";actions.append(cancel,confirm);dialog.append(actions);overlay.append(dialog);document.body.append(overlay);
 const draw=()=>{const d=new Date(month+"T12:00:00Z");heading.textContent=d.getUTCFullYear()+"年"+(d.getUTCMonth()+1)+"月";grid.replaceChildren();["一","二","三","四","五","六","日"].forEach((w,i)=>{const el=node("span",w,"calendar-weekday"+(i>=5?" weekend-red":""));grid.append(el)});const offset=(d.getUTCDay()+6)%7;for(let i=0;i<offset;i++)grid.append(node("span","","calendar-empty"));const days=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();for(let day=1;day<=days;day++){const date=month.slice(0,8)+String(day).padStart(2,"0"),dow=new Date(date+"T12:00:00Z").getUTCDay(),b=node("button",String(day),"calendar-day"+(dow===0||dow===6?" weekend-red":"")+(date===shown?" selected":""));b.type="button";b.disabled=date<today()||date>add(today(),89);b.addEventListener("click",()=>{shown=date;draw()});grid.append(b)}};
 prev.addEventListener("click",()=>{const d=new Date(month+"T12:00:00Z");d.setUTCMonth(d.getUTCMonth()-1);month=d.toISOString().slice(0,7)+"-01";draw()});next.addEventListener("click",()=>{const d=new Date(month+"T12:00:00Z");d.setUTCMonth(d.getUTCMonth()+1);month=d.toISOString().slice(0,7)+"-01";draw()});cancel.addEventListener("click",()=>overlay.remove());confirm.addEventListener("click",()=>{input.value=shown;overlay.remove()});overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove()});draw()};
 input.addEventListener("click",open);
}
async function init(){try{S.directory=await fetchAsiaGolfDirectory();fillCountries();initClimateExplorer();const t=today();$("departure").min=t;$("departure").max=add(t,89);$("departure").value=t;initDepartureCalendar();$("country").addEventListener("change",fillRegions);$("region").addEventListener("change",fillCourses);$("course").addEventListener("change",()=>{S.course=S.directory.courses.find(c=>c.id===$("course").value);$("run").disabled=!S.course});$("run").addEventListener("click",run);setStatus("請選擇出發日期及球場。")}catch(e){setStatus("球場清單讀取失敗："+e.message)}}
init();