import {fetchAsiaGolfDirectory} from "./course-catalog.js";
import {formatCourseDate} from "./course-time.js";
import {fetchCourseForecast} from "./weather-api.js";
import {fetchCourseSeasonalForecast,fetchCourseHistoricalMonthlyClimate,fetchCourseHistoricalWeekNormals,interpretPrecipitationEfi} from "./long-range-api.js?v=era5-shared-cache-v1";
import {normalizeSeasonalDaily,blendSeasonalWithHistory} from "./seasonal-daily-engine.js";
import {buildDailyClimateOutlook} from "./daily-climate-outlook.js";
import {scoreGolfRainWindow} from "./rain-risk.js";
import {scoreGolfSuitabilityWindow} from "./suitability-engine.js";
import {scorePwaStylePlayability} from "./pwa-playability.js";
import {renderTaiwanPwaHourly} from "./taiwan-hourly-renderer.js";
const $=id=>document.getElementById(id),S={};
let climateBackAction=null,departureFormReturnAction=null,exitConfirmed=false,exitDialogOpen=false;
function ensureHomeExitGuard(){
 // Maintain one same-document entry. This is a browser-history guard, not a way to prevent Chrome itself from closing.
 if(history.state?.asiaGolfHomeGuard!==true)history.pushState({asiaGolfHomeGuard:true},"",location.href);
}
function showExitDialog(){
 let modal=document.getElementById("exit-dialog");
 if(modal){modal.hidden=false;exitDialogOpen=true;return}
 modal=node("div",undefined,"exit-dialog");modal.id="exit-dialog";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
 const box=node("div",undefined,"exit-dialog-box");box.append(node("p","確定要退出亞洲高爾夫天氣 App 嗎？","exit-dialog-message"));
 const actions=node("div",undefined,"exit-dialog-actions");
 const cancel=node("button","取消","exit-cancel");cancel.type="button";cancel.addEventListener("click",()=>{modal.hidden=true;exitDialogOpen=false;ensureHomeExitGuard()});
 const confirm=node("button","確定","exit-confirm");confirm.type="button";confirm.addEventListener("click",()=>{modal.hidden=true;exitDialogOpen=false;exitConfirmed=true});
 actions.append(cancel,confirm);box.append(actions);modal.append(box);document.body.append(modal);exitDialogOpen=true;
}
function handleAppBack(source="system"){
 if(returnFromDepartureForm())return;
 if(climateBackAction){
  const action=climateBackAction;climateBackAction=null;action();return;
 }
 if($("climate-explorer")?.classList.contains("is-subpage")){showCountryOverview();return}
 showExitDialog();
}
window.addEventListener("popstate",()=>{
 if(exitConfirmed)return;
 // Re-arm a single same-document entry before changing the visible screen.
 ensureHomeExitGuard();
 handleAppBack("popstate");
});
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
function renderSevenDayVisual(host,rows,historical=false,onSelectDate=null){
 const pages=node("div",undefined,"selected-week-five-pages");let pageIndex=0;
 const renderPage=()=>{
  pages.replaceChildren();const pageRows=rows.slice(pageIndex*5,pageIndex*5+5);
  const strip=node("div",undefined,"taiwan-style-seven-day unified-seven-day");
  const makeRow=cls=>node("div",undefined,"taiwan-seven-row "+cls);
  const dates=makeRow("taiwan-seven-dates"),weather=makeRow("taiwan-seven-weather"),rain=makeRow("taiwan-seven-rain");
  pageRows.forEach(r=>{const wd=new Date(r.date+"T12:00:00Z").getUTCDay(),clickable=!!onSelectDate&&r.clickable===true;const d=node(clickable?"button":"div",undefined,"taiwan-seven-cell"+([0,6].includes(wd)?" weekend":"")+(clickable?" seven-day-date-button seven-day-hourly-cell":""));if(clickable){d.type="button";d.dataset.hourlyDate=r.date;d.setAttribute("aria-label",r.date+" 點選查看逐時天氣");d.title="點選此日期查看逐時天氣";d.style.width="100%";d.style.border="0";d.style.borderRadius="0";d.style.font="inherit";d.style.cursor="pointer";d.style.pointerEvents="auto";d.style.touchAction="manipulation"}d.append(node("strong",r.date.slice(5).replace("-","/")),node("small",["日","一","二","三","四","五","六"][wd]));if(clickable)d.addEventListener("click",()=>onSelectDate(r.date));dates.append(d)});
  strip.append(dates);
  const graph=node("div",undefined,"seven-day-inline-graph"),svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 700 220");svg.setAttribute("role","img");svg.setAttribute("aria-label","每日最高最低氣溫及體感");svg.style.width="100%";svg.style.display="block";
  const vals=pageRows.flatMap(r=>[r.high,r.low,r.feel].filter(Number.isFinite));
  if(vals.length){const lo=Math.min(...vals)-2,hi=Math.max(...vals)+2,x=i=>70+i*140,y=v=>150-(v-lo)/(hi-lo||1)*80;
   [20,82,144].forEach(yy=>{const l=document.createElementNS(svg.namespaceURI,"line");l.setAttribute("x1",35);l.setAttribute("x2",670);l.setAttribute("y1",yy);l.setAttribute("y2",yy);l.setAttribute("stroke","#dce5e9");svg.append(l)});
   [{key:"high",color:"#ef6b54"},{key:"low",color:"#3198dc"},{key:"feel",color:"#d49b22"}].filter(s=>pageRows.some(r=>Number.isFinite(r[s.key]))).forEach(s=>{const pts=pageRows.map((r,i)=>Number.isFinite(r[s.key])?[x(i),y(r[s.key])]:null);const valid=pts.filter(Boolean);if(valid.length>1){const p=document.createElementNS(svg.namespaceURI,"polyline");p.setAttribute("points",valid.map(p=>p.join(",")).join(" "));p.setAttribute("fill","none");p.setAttribute("stroke",s.color);p.setAttribute("stroke-width","3.5");p.setAttribute("stroke-linecap","round");p.setAttribute("stroke-linejoin","round");svg.append(p)}pts.forEach((p,i)=>{if(!p)return;const dot=document.createElementNS(svg.namespaceURI,"circle");dot.setAttribute("cx",p[0]);dot.setAttribute("cy",p[1]);dot.setAttribute("r","4.5");dot.setAttribute("fill",s.color);svg.append(dot);const tx=document.createElementNS(svg.namespaceURI,"text");tx.setAttribute("x",p[0]);tx.setAttribute("y",p[1]+(s.key==="high"?-22:s.key==="low"?26:(Number.isFinite(pageRows[i].high)&&Number.isFinite(pageRows[i].low)&&pageRows[i].feel>=pageRows[i].high?-54:Number.isFinite(pageRows[i].low)&&pageRows[i].feel<pageRows[i].low?58:-12)));tx.setAttribute("text-anchor","middle");tx.setAttribute("font-size","30");tx.setAttribute("font-weight","800");tx.setAttribute("fill",s.color);tx.textContent=pageRows[i][s.key].toFixed(0)+"°";svg.append(tx)})});
  }
  graph.append(svg);const legend=node("div",undefined,"seven-day-legend");legend.append(node("span",historical?"● 歷史平均最高溫":"● 最高溫","legend-high"),node("span",historical?"● 歷史平均最低溫":"● 最低溫","legend-low"));if(!historical)legend.append(node("span","● 體感溫度","legend-feel"));graph.append(legend);strip.append(graph);
  pageRows.forEach(r=>{const wd=new Date(r.date+"T12:00:00Z").getUTCDay(),weekend=[0,6].includes(wd),clickable=!!onSelectDate&&r.clickable===true;const w=node("div",undefined,"taiwan-seven-cell"+(weekend?" weekend":"")+(clickable?" seven-day-hourly-cell":""));if(clickable){w.dataset.hourlyDate=r.date;w.setAttribute("role","button");w.tabIndex=0;w.setAttribute("aria-label",r.date+" 天氣狀況，點選查看逐時天氣");w.title="點選此天氣狀況查看逐時天氣"}const code=Number.isFinite(r.code)?r.code:null;const isHistorical=!r.actual;const label=isHistorical?(!Number.isFinite(r.prob)?"歷史資料不足":r.prob>=60?"歷史常有雨":r.prob>=30?"歷史偶有雨":"歷史較少雨"):(r.label||"資料不足");w.append(createWeatherIcon(code,isHistorical,r.prob),node("strong",label));if(clickable)w.addEventListener("click",()=>onSelectDate(r.date));weather.append(w);const rr=node("div",undefined,"taiwan-seven-cell"+(weekend?" weekend":"")+(clickable?" seven-day-hourly-cell":""));if(clickable){rr.dataset.hourlyDate=r.date;rr.setAttribute("role","button");rr.tabIndex=0;rr.setAttribute("aria-label",r.date+" 降雨資料，點選查看逐時天氣");rr.title="點選此日期資料查看逐時天氣"}rr.append(node("small",isHistorical?"歷史降雨頻率":"降雨機率"),node("strong",Number.isFinite(r.prob)?r.prob.toFixed(0)+"%":"—","taiwan-rain-prob"),node("small",isHistorical?"歷史日均雨量":"累積雨量"),node("strong",Number.isFinite(r.rain)?r.rain.toFixed(1)+" mm":"—","taiwan-rain-mm"));if(clickable)rr.addEventListener("click",()=>onSelectDate(r.date));rain.append(rr)});
  strip.append(weather,rain);const sectionPage=node("section",undefined,"selected-week-five-page");sectionPage.append(node("h4","第 "+(pageIndex+1)+" 頁｜"+pageRows[0].date+" ～ "+pageRows[pageRows.length-1].date,"selected-week-page-title"),strip);
  pages.append(sectionPage);
 };
 const activateHourlyCell=target=>{if(!target||!pages.contains(target)||!target.dataset.hourlyDate)return;onSelectDate(target.dataset.hourlyDate)};
  pages.addEventListener("click",e=>{const target=e.target.closest("[data-hourly-date]");if(!target||!pages.contains(target))return;e.preventDefault();e.stopPropagation();activateHourlyCell(target)},true);
  pages.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-hourly-date]")){e.preventDefault();activateHourlyCell(e.target)}},true);
 let touchStartX=0,touchStartY=0;
 pages.addEventListener("touchstart",e=>{const t=e.touches[0];touchStartX=t.clientX;touchStartY=t.clientY},{passive:true});
 pages.addEventListener("touchend",e=>{const t=e.changedTouches[0],dx=t.clientX-touchStartX,dy=t.clientY-touchStartY;if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.25)return;const maxPage=Math.ceil(rows.length/5)-1;if(dx<0&&pageIndex<maxPage){pageIndex++;renderPage()}else if(dx>0&&pageIndex>0){pageIndex--;renderPage()}},{passive:true});
 pages.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"&&pageIndex>0){pageIndex--;renderPage()}else if(e.key==="ArrowRight"&&pageIndex<Math.ceil(rows.length/5)-1){pageIndex++;renderPage()}});
 pages.tabIndex=0;renderPage();host.append(pages);
}
async function showReport(){
 const host=$("report");host.replaceChildren();const course=S.course,date=$("departure").value;
 if(!course||!date)return;
 host.append(node("h2",course.name+"｜"+formatCourseDate(date,course.timezone)+" ～ "+formatCourseDate(add(date,6),course.timezone)));
 await renderCourseSevenDayReport(host,course,date);
}
async function renderCourseSevenDayReport(host,course,startDate,onBack=null,monthlyContext=null){
 const dates=Array.from({length:7},(_,i)=>add(startDate,i));
 const leadFor=date=>Math.floor((Date.parse(date+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);
 const report=section(host,"出發日 7 天摘要");report.classList.add("departure-week-summary");

 const daily=S.forecast?.courses?.find(x=>x.course.id===course.id)?.daily;
 let historical=[],seasonal=[];
 if(monthlyContext){
  historical=monthlyContext.historicalNormals?.flatMap(x=>x.days||[])||[];
  seasonal=monthlyContext.seasonalDailyRows||[];
 }else{
  const needsHistory=dates.some(date=>leadFor(date)>15||leadFor(date)<0||!(daily?.time||[]).includes(date));
  if(needsHistory){
   try{const result=await fetchCourseHistoricalWeekNormals(course,dates);historical=result.days||[]}
   catch(e){report.append(node("p","部分日期歷史資料暫時無法取得："+e.message,"risk-summary"))}
  }
  if(dates.some(date=>leadFor(date)>=18&&leadFor(date)<=89)){
   try{const raw=await fetchCourseSeasonalForecast(course);seasonal=buildDailyClimateOutlook(raw,historical,today(),90)}
   catch(e){report.append(node("p","季節模式逐日資料暫時無法取得："+e.message,"risk-summary"))}
  }
 }
 const wxLabel=c=>!Number.isFinite(c)?"歷史氣候參考":c===0?"晴朗":c<=2?"晴時多雲":c===3?"陰天":c>=51&&c<=57?"毛毛雨":c>=61&&c<=67?"降雨":c>=80&&c<=82?"陣雨":c>=95?"雷雨":"多雲";
 const mean=(values)=>{const v=values.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null};
 const mode=(values)=>{const v=values.filter(Number.isFinite);if(!v.length)return null;const counts=new Map();v.forEach(x=>counts.set(x,(counts.get(x)||0)+1));return [...counts.entries()].sort((x,y)=>y[1]-x[1])[0][0]};
 const modeText=(values)=>{const v=values.filter(x=>typeof x==="string"&&x.length);if(!v.length)return null;const counts=new Map();v.forEach(x=>counts.set(x,(counts.get(x)||0)+1));return [...counts.entries()].sort((x,y)=>y[1]-x[1])[0][0]};
 const rows=dates.map(date=>{
  const lead=leadFor(date),dailyEntries=monthlyContext?.forecastCourses
   ?monthlyContext.forecastCourses.map(f=>{const i=(f.daily?.time||[]).indexOf(date);return i<0?null:{code:f.daily.weather_code?.[i],high:f.daily.temperature_2m_max?.[i],low:f.daily.temperature_2m_min?.[i],feel:f.daily.apparent_temperature_max?.[i],prob:f.daily.precipitation_probability_max?.[i],rain:f.daily.precipitation_sum?.[i]}}).filter(Boolean)
   :[];
  const i=(daily?.time||[]).indexOf(date),hRows=monthlyContext?.historicalNormals?.map(n=>n.days?.find(x=>x.date===date)).filter(Boolean)||[],h=monthlyContext?hRows[0]:historical.find(x=>x.date===date);
  const actual=monthlyContext?lead>=0&&lead<16&&dailyEntries.length>0:lead>=0&&lead<=15&&i>=0;
  const seasonalEntries=seasonal.filter(x=>x.date===date),sd=seasonalEntries[0];
  if(actual){
   const entries=monthlyContext?dailyEntries:[{code:daily.weather_code?.[i],high:daily.temperature_2m_max?.[i],low:daily.temperature_2m_min?.[i],feel:daily.apparent_temperature_max?.[i],prob:daily.precipitation_probability_max?.[i],rain:daily.precipitation_sum?.[i]}];
   const code=mode(entries.map(x=>x.code));
   return {date,actual:true,seasonal:false,code,high:mean(entries.map(x=>x.high)),low:mean(entries.map(x=>x.low)),feel:mean(entries.map(x=>x.feel)),prob:mean(entries.map(x=>x.prob)),rain:mean(entries.map(x=>x.rain)),rainKind:"forecast",label:wxLabel(code)};
  }
  if(sd){
   const code=mode(seasonalEntries.map(x=>x.code));
   return {date,actual:false,seasonal:true,seasonalData:sd,code,high:mean(seasonalEntries.map(x=>x.highEstimate)),low:mean(seasonalEntries.map(x=>x.lowEstimate)),feel:null,prob:mean(seasonalEntries.map(x=>x.rainChanceEstimate)),rain:mean(seasonalEntries.map(x=>x.rainEstimate)),wetDayRain:mean(seasonalEntries.map(x=>x.wetDayRainEstimate)),rainConsistency:modeText(seasonalEntries.map(x=>x.rainConsistency)),rainKind:"seasonal-frequency",label:modeText(seasonalEntries.map(x=>x.weather))||sd.weather};
  }
  const histRows=monthlyContext?hRows:(h?[h]:[]);
  const rainFrequency=monthlyContext?mean(histRows.map(x=>x.rainFrequency)):h?.rainFrequency;
  const high=monthlyContext?mean(histRows.map(x=>x.highMean)):h?.highMean;
  const low=monthlyContext?mean(histRows.map(x=>x.lowMean)):h?.lowMean;
  const rain=monthlyContext?mean(histRows.map(x=>x.rainMean)):h?.rainMean;
  return {date,actual:false,seasonal:false,code:null,high,low,feel:null,prob:rainFrequency,rain,rainKind:"historical-frequency",label:!Number.isFinite(rainFrequency)?"歷史資料不足":rainFrequency>=60?"歷史常有雨":rainFrequency>=30?"歷史偶有雨":"歷史較少雨"};
 });
 const pages=node("div",undefined,"departure-week-pages");let pageIndex=0;
 const renderPage=()=>{
  pages.replaceChildren();const pageRows=rows.slice(pageIndex*5,pageIndex*5+5);
  const page=node("section",undefined,"departure-five-day-page");
  page.append(node("h4","第 "+(pageIndex+1)+" 頁｜"+pageRows[0].date+" ～ "+pageRows[pageRows.length-1].date));
  const datesRow=node("div",undefined,"departure-five-dates");
  pageRows.forEach(r=>{const wd=new Date(r.date+"T12:00:00Z").getUTCDay(),canOpen=!!r.actual,d=node(canOpen?"button":"div",undefined,"departure-five-date"+([0,6].includes(wd)?" weekend-red":"")+(canOpen?" departure-hourly-target":""));if(canOpen){d.type="button";d.dataset.hourlyDate=r.date;d.setAttribute("aria-label",r.date+" 點選查看逐時天氣");d.title="點選查看"+r.date+"逐時天氣";d.addEventListener("click",()=>renderDepartureDayPage(host,course,r,onBack))}d.append(node("strong",r.date.slice(5).replace("-","/")),node("small","週"+["日","一","二","三","四","五","六"][wd]));datesRow.append(d)});
  page.append(datesRow);
  const chartWrap=node("div",undefined,"departure-five-chart");
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 700 220");svg.setAttribute("role","img");svg.setAttribute("aria-label","每日最高溫、最低溫及最高體感溫度曲線");svg.style.width="100%";svg.style.display="block";
  const values=pageRows.flatMap(r=>[r.high,r.low,r.feel].filter(Number.isFinite));
  if(values.length){const lo=Math.min(...values)-2,hi=Math.max(...values)+2,x=i=>70+i*140,y=v=>150-(v-lo)/(hi-lo||1)*80;
   [20,82,144].forEach(yy=>{const l=document.createElementNS(svg.namespaceURI,"line");l.setAttribute("x1",35);l.setAttribute("x2",670);l.setAttribute("y1",yy);l.setAttribute("y2",yy);l.setAttribute("stroke","#dce5e9");svg.append(l)});
   [{key:"high",color:"#ef6b54"},{key:"low",color:"#3198dc"},{key:"feel",color:"#d49b22"}].filter(s=>pageRows.some(r=>Number.isFinite(r[s.key]))).forEach(s=>{const pts=pageRows.map((r,i)=>Number.isFinite(r[s.key])?{x:x(i),y:y(r[s.key]),index:i}:null).filter(Boolean);if(pts.length>1){const p=document.createElementNS(svg.namespaceURI,"polyline");p.setAttribute("points",pts.map(p=>p.x+","+p.y).join(" "));p.setAttribute("fill","none");p.setAttribute("stroke",s.color);p.setAttribute("stroke-width","4");p.setAttribute("stroke-linecap","round");p.setAttribute("stroke-linejoin","round");svg.append(p)}pts.forEach(p=>{const dot=document.createElementNS(svg.namespaceURI,"circle");dot.setAttribute("cx",p.x);dot.setAttribute("cy",p.y);dot.setAttribute("r","4.5");dot.setAttribute("fill",s.color);svg.append(dot);const tx=document.createElementNS(svg.namespaceURI,"text");tx.setAttribute("x",p.x);const labelOffset=s.key==="high"?-22:s.key==="low"?26:(Number.isFinite(pageRows[p.index].high)&&Number.isFinite(pageRows[p.index].low)&&pageRows[p.index].feel>=pageRows[p.index].high?-54:Number.isFinite(pageRows[p.index].low)&&pageRows[p.index].feel<pageRows[p.index].low?58:-12);tx.setAttribute("y",p.y+labelOffset);tx.setAttribute("text-anchor","middle");tx.setAttribute("font-size","30");tx.setAttribute("font-weight","900");tx.setAttribute("fill",s.color);tx.textContent=pageRows[p.index][s.key].toFixed(0)+"°";svg.append(tx)})});
  }
  chartWrap.append(svg);const legend=node("div",undefined,"departure-five-legend");legend.append(node("span","● 最高溫","legend-high"),node("span","● 最低溫","legend-low"),node("span","● 體感溫度","legend-feel"));chartWrap.append(legend);page.append(chartWrap);
  const cards=node("div",undefined,"departure-five-cards");
  pageRows.forEach(r=>{const wd=new Date(r.date+"T12:00:00Z").getUTCDay(),day=node("button",undefined,"departure-five-card"+(r.date===startDate?" is-departure":"")+(r.actual?" departure-hourly-target":""));day.type="button";day.dataset.hourlyDate=r.date;day.setAttribute("aria-label",r.date+" 天氣狀況，點選查看逐時天氣");day.title=r.actual?"點選查看"+r.date+"逐時天氣":r.seasonal?"點選查看"+r.date+"季節模式逐日估計":"點選查看"+r.date+"歷史氣候資料";day.append(createWeatherIcon(r.code,!r.actual&&!r.seasonal,r.prob),node("strong",r.label));day.append(node("small",r.actual?"降雨機率":r.seasonal?"雨日頻率（季節調整）":"歷史雨日頻率"),node("b",Number.isFinite(r.prob)?r.prob.toFixed(0)+"%":"—","departure-rain-prob"),node("small",r.actual?"累積雨量":r.seasonal?"季節估計日雨量":"歷史日均雨量"),node("b",Number.isFinite(r.rain)?r.rain.toFixed(1)+" mm":"—","departure-rain-mm"));if([0,6].includes(wd))day.classList.add("weekend");day.addEventListener("click",()=>renderDepartureDayPage(host,course,r,onBack));cards.append(day)});
  page.append(cards);
  if(pageIndex===0){
   const assessment=node("section",undefined,"departure-week-analysis");
   assessment.append(node("h4","七天天氣總覽與適打分析"));
   const actualDays=rows.filter(r=>r.actual),rainy=actualDays.filter(r=>(Number.isFinite(r.prob)&&r.prob>=40)||(Number.isFinite(r.rain)&&r.rain>=1)).length;
   const temps=actualDays.map(r=>r.high).filter(Number.isFinite),rainMax=actualDays.map(r=>r.prob).filter(Number.isFinite);
   const overview=actualDays.length
    ? `本週可用逐日預報 ${actualDays.length} 天；${rainy} 天有較明顯降雨訊號。最高溫約 ${temps.length?Math.min(...temps).toFixed(0)+"–"+Math.max(...temps).toFixed(0)+"°C":"資料不足"}，降雨機率最高約 ${rainMax.length?Math.max(...rainMax).toFixed(0)+"%":"資料不足"}。安排球敘時，建議優先避開降雨機率及雨量較高的日期，並於出發前再次確認更新預報。`
    : "本週資料以歷史同期統計為主，以下只能反映季節氣候傾向，不能視為實際七天天氣預報。";
   assessment.append(node("p",overview));
   const suitability=node("div",undefined,"departure-suitability-list");
   const teeHour=Number($("tee").value||10);
   const hourly=S.forecast?.courses?.find(x=>x.course.id===course.id)?.hourly;
   rows.slice(1,4).forEach((r,idx)=>{
    const historicalDay=!r.actual;
    let status,reason;
    if(historicalDay){
     const freq=r.prob,rain=r.rain;
     status=Number.isFinite(freq)&&freq>=60||Number.isFinite(rain)&&rain>=5?"歷史上較不利":Number.isFinite(freq)&&freq>=30||Number.isFinite(rain)&&rain>=2?"歷史上需留意降雨":"歷史上相對較有利";
     reason=`歷史降雨頻率 ${Number.isFinite(freq)?freq.toFixed(0)+"%":"資料不足"}，日均雨量 ${Number.isFinite(rain)?rain.toFixed(1)+" mm":"資料不足"}；此為氣候統計，不能判定當日實際適打情況。`;
    }else{
     const indices=(hourly?.time||[]).map((t,i)=>String(t).slice(0,10)===r.date&&Number(String(t).slice(11,13))>=teeHour&&Number(String(t).slice(11,13))<teeHour+6?i:-1).filter(i=>i>=0);
     const vals=key=>indices.map(i=>hourly?.[key]?.[i]).filter(v=>Number.isFinite(v));
     const probs=vals("precipitation_probability"),rainValues=vals("precipitation"),temps=vals("temperature_2m"),codes=vals("weather_code");
     const maxProb=probs.length?Math.max(...probs):null,totalRain=rainValues.length?rainValues.reduce((sum,v)=>sum+v,0):null;
     const minTemp=temps.length?Math.min(...temps):null,maxTemp=temps.length?Math.max(...temps):null;
     const thunder=codes.some(c=>c>=95),rainCode=codes.some(c=>c>=51&&c<=82);
     const wet=thunder||(maxProb!==null&&maxProb>=60)||(totalRain!==null&&totalRain>=3);
     const caution=(maxProb!==null&&maxProb>=30)||(totalRain!==null&&totalRain>=1)||rainCode;
     status=wet?"較不適合":caution?"可打但需留意":"較適合打球";
     const windowLabel=String(teeHour).padStart(2,"0")+":00–"+String(teeHour+6).padStart(2,"0")+":00";
     reason=indices.length
      ? `開球後六小時（${windowLabel}）：最高降雨機率 ${maxProb!==null?maxProb.toFixed(0)+"%":"資料不足"}，累積預報雨量 ${totalRain!==null?totalRain.toFixed(1)+" mm":"資料不足"}，氣溫 ${minTemp!==null&&maxTemp!==null?minTemp.toFixed(0)+"–"+maxTemp.toFixed(0)+"°C":"資料不足"}。`
      : `開球後六小時（${windowLabel}）逐時資料不足，暫無法判斷適打性。`;
    }
    const item=node("article",undefined,"departure-suitability-item");
    item.append(node("strong",`第 ${idx+2} 天｜${r.date}｜${status}`),node("p",reason));suitability.append(item);
   });
   assessment.append(suitability);
   assessment.append(node("small","適打判斷依目前可取得的降雨機率、雨量、天氣現象及氣溫作初步評估；未納入球場即時積水、雷擊警報及當地風況，請於開球前再確認。","data-note"));
   const reselect=node("button","重新選擇出發日","departure-reselect-button");reselect.type="button";reselect.addEventListener("click",()=>showDepartureForm(startDate));
   assessment.append(reselect);
   page.append(assessment);
  }
  pages.append(page);
 };
 let touchStartX=0,touchStartY=0;
 pages.addEventListener("touchstart",e=>{const t=e.touches[0];touchStartX=t.clientX;touchStartY=t.clientY},{passive:true});
 pages.addEventListener("touchend",e=>{const t=e.changedTouches[0],dx=t.clientX-touchStartX,dy=t.clientY-touchStartY;if(Math.abs(dx)<45||Math.abs(dx)<Math.abs(dy)*1.25)return;const maxPage=Math.ceil(rows.length/5)-1;if(dx<0&&pageIndex<maxPage){pageIndex++;renderPage()}else if(dx>0&&pageIndex>0){pageIndex--;renderPage()}},{passive:true});
 pages.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"&&pageIndex>0){pageIndex--;renderPage()}else if(e.key==="ArrowRight"&&pageIndex<Math.ceil(rows.length/5)-1){pageIndex++;renderPage()}});
 pages.tabIndex=0;renderPage();
 report.append(pages);
 report.append(node("p","每頁最多顯示 5 天；左右滑動切換日期，點選任一天即可展開逐時預報或歷史資料。前 16 天使用逐日預報，超出範圍以歷史同期資料補充。","long-range-note"));
}
async function renderDepartureDayPage(host,course,row,onBack=null){
 host.replaceChildren();
 const back=node("button","← 返回出發日 7 天摘要","departure-detail-back");back.type="button";
 back.addEventListener("click",()=>{if(onBack)onBack();else showReport()});
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
  if(row.seasonal&&row.seasonalData){
   const s=row.seasonalData;
   card.append(node("p","第 19–90 日綜合估計：季節模式與歷史同期每日資料融合，屬於旅遊決策參考，不是確定性天氣預報；不提供虛構逐時資料或降雨機率。","long-range-note"));
   const stats=node("div",undefined,"results");
   for(const [label,value,unit] of [["綜合估計最高溫",s.highEstimate," °C"],["綜合估計最低溫",s.lowEstimate," °C"],["估計日均雨量（含無雨日）",s.rainEstimate," mm"],["估計有雨日平均雨量",s.wetDayRainEstimate," mm／有雨日"],["歷史同期雨日頻率（季節調整）",s.rainChanceEstimate,"%"],["歷史同期第90百分位日雨量",s.rainP90Estimate," mm"],["季節模式平均風速",s.windMean," m/s"],["資料完整度",s.dataCompleteness*100,"%"]]){
    const item=node("article",undefined,"result-card");item.append(node("p",label),node("strong",Number.isFinite(value)?value.toFixed(1)+unit:"資料不足"));stats.append(item);
   }
   card.append(stats);
   const provenance=node("div",undefined,"monthly-source-note");
   provenance.append(node("p","資料來源："+(s.sourceLabel||"長期氣候估計")+"。歷史樣本："+(Number.isFinite(s.historicalSampleYears)?s.historicalSampleYears+" 年":"未取得")+"；季節訊號指標："+(Number.isFinite(s.seasonalEvidenceCount)?s.seasonalEvidenceCount:"0")+" 項。"));
   provenance.append(node("p","欄位來源：氣溫 "+(s.fieldQuality?.temperature||"未標示")+"；雨日頻率 "+(s.fieldQuality?.rainfallFrequency||"未標示")+"；雨量 "+(s.fieldQuality?.rainfallAmount||"未標示")+"；風速 "+(s.fieldQuality?.wind||"未標示")+"。"));
   provenance.append(node("p","降雨一致性檢查："+(s.rainConsistency||"尚未計算")+"；有雨日平均雨量為估計日均雨量除以雨日頻率，僅作量級解讀，不是單次降雨預報。"));
   card.append(provenance,node("p","適打趨勢："+s.playability+"｜資料信心："+s.confidence+"｜模式："+s.band+"。"+s.confidenceNote,"data-note"));
   return;
  }
  card.append(node("p","此日期超出短期預報範圍，以下提供歷史同期統計，不代表該日實際天氣，也不提供虛構逐時資料。","long-range-note"));
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
 const hourly=forecast.hourly,teeHour=Number($("tee").value||10),endHour=teeHour+6,indices=hourly.time.map((t,i)=>String(t).slice(0,10)===row.date&&Number(String(t).slice(11,13))>=teeHour&&Number(String(t).slice(11,13))<endHour?i:-1).filter(i=>i>=0);
 if(!indices.length){card.append(node("p",`此日期未取得 ${String(teeHour).padStart(2,"0")}:00–${String(endHour).padStart(2,"0")}:00 逐時預報。`,"risk-summary"));return}
 const records=indices.map(i=>({
  time:String(hourly.time[i]).slice(11,16),
  code:hourly.weather_code?.[i]??null,
  rain:hourly.precipitation_probability?.[i]??null,
  mm:hourly.precipitation?.[i]??hourly.rain?.[i]??null,
  temp:hourly.temperature_2m?.[i]??null,
  feel:hourly.apparent_temperature?.[i]??null,
  wind:Number.isFinite(hourly.wind_speed_10m?.[i])?hourly.wind_speed_10m[i]*3.6:null,
  gust:Number.isFinite(hourly.wind_gusts_10m?.[i])?hourly.wind_gusts_10m[i]*3.6:null,
  dir:hourly.wind_direction_10m?.[i]??null,
  rh:hourly.relative_humidity_2m?.[i]??null,
  cloud:hourly.cloud_cover?.[i]??null,
  uv:hourly.uv_index?.[i]??null
 }));
 renderTaiwanPwaHourly(card,course,row.date,records);
}

async function run(){
 const button=$("run"),reportHost=$("report");button.disabled=true;reportHost.replaceChildren();reportHost.hidden=false;
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
 // View navigation is managed by climateBackAction, not browser history.
 let nav=$("flow-nav");if(!nav){nav=node("div",undefined,"flow-nav");nav.id="flow-nav";$("climate-explorer").insertBefore(nav,out)}
 nav.replaceChildren();
 const h=node("h2",title,"flow-title");nav.append(h);
 const actions=node("div",undefined,"flow-actions");
 if(backAction){const back=node("button","← 返回上一層","flow-back");back.type="button";back.addEventListener("click",()=>{const action=climateBackAction;climateBackAction=null;if(action)action()});actions.append(back)}
 const home=node("button","⌂ 回首頁","flow-home");home.type="button";home.addEventListener("click",()=>{climateBackAction=null;showCountryOverview()});actions.append(home);
 nav.append(actions);
 out.hidden=false;status.hidden=false;
 // Every subpage transition starts at the destination page header, not the previous scroll position.
 window.scrollTo(0,0);
 requestAnimationFrame(()=>window.scrollTo(0,0));
}
function showCountryOverview(){
 climateBackAction=null;
 ensureHomeExitGuard();
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
 cc.value="JP";cc.addEventListener("change",renderRegionClimate);$("region-report").hidden=true;$("climate-status").textContent="請選擇國家，進入該國地理分區。";ensureHomeExitGuard();
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
 showClimateScreen("② "+(S.directory.countries.find(c=>c.code===country)?.nameZh||country)+"｜"+scopeName+"｜\n三個月天氣總表",()=>renderSubregionMenu(country,region));
 const loading=node("div",undefined,"region-month-loading");
 loading.setAttribute("role","status");loading.setAttribute("aria-live","polite");
 loading.append(node("div",undefined,"region-month-spinner"),node("strong","正在整理三個月份的天氣資料…"),node("span","正在讀取季節模式與歷史氣候資料，請稍候"));
 out.append(loading);
 const valid=courses.filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude));
 const records=(await Promise.allSettled(valid.map(c=>fetchCourseSeasonalForecast(c)))).filter(x=>x.status==="fulfilled").map(x=>x.value);
 const table=node("div",undefined,"region-table-wrap"),tbl=node("table",undefined,"region-table region-matrix"),thead=node("thead"),hr=node("tr");
 ["天氣指標",...months.map(m=>m)].forEach(t=>hr.append(node("th",t)));thead.append(hr);tbl.append(thead);
 const body=node("tbody");
 const historicalResults=(await Promise.allSettled(valid.map(c=>fetchCourseHistoricalMonthlyClimate(c)))).filter(x=>x.status==="fulfilled").map(x=>x.value);
 loading.remove();
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
  // Historical-month description is based on historical monthly rainfall,
  // rainy-day frequency and mean temperatures, not a fabricated daily forecast.
  const historicalOutlook=()=>{
   const parts=[];
   if(Number.isFinite(historicalRain)||Number.isFinite(rainDays)){
    if((Number.isFinite(historicalRain)&&historicalRain>=250)||(Number.isFinite(rainDays)&&rainDays>=16))parts.push("雨季多雨");
    else if((Number.isFinite(historicalRain)&&historicalRain>=150)||(Number.isFinite(rainDays)&&rainDays>=12))parts.push("偏濕");
    else if((Number.isFinite(historicalRain)&&historicalRain<=60)&&(Number.isFinite(rainDays)&&rainDays<=8))parts.push("乾季偏乾");
    else if((Number.isFinite(historicalRain)&&historicalRain<100)||(Number.isFinite(rainDays)&&rainDays<10))parts.push("降雨較少");
    else parts.push("降雨接近常態");
   }
   if(Number.isFinite(low)&&Number.isFinite(high)){
    const meanTemp=(low+high)/2;
    if(meanTemp<=12)parts.push("寒冷");
    else if(meanTemp<=18)parts.push("偏冷");
    else if(meanTemp>=28)parts.push("炎熱");
    else if(meanTemp>=24)parts.push("溫暖");
   }
   return parts.length?parts.join("、"):"歷史氣候資料不足";
  };
  // Use the same descriptive climate wording in every month column.
  // For the first two forecast months, retain the seasonal signal as a short qualifier.
  let outlook=historicalOutlook();
  if(Number.isFinite(seasonRain)&&Number.isFinite(seasonAnomaly)){
   const baseline=seasonRain-seasonAnomaly;
   const forecastTrend=baseline>0?(seasonRain/baseline>=1.2?"季節預測偏濕":seasonRain/baseline<=.8?"季節預測偏乾":"季節預測接近常態"):"";
   if(forecastTrend)outlook+="（"+forecastTrend+"）";
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
 const group={region:scopeName,rootRegion:region,subregion,country,courses:valid,months};
 const actionRow=node("tr");actionRow.append(node("th","下一步"));for(const item of monthData){const td=node("td"),monthLabel=Number(item.month.slice(5,7))+"月",btn=node("button",monthLabel+"週分析","region-select");btn.type="button";btn.addEventListener("click",()=>{if(records.length){renderRegionTopWeeks(group,records,item.month)}else{renderEmptyWeekAnalysis(country,scopeName,item.month,()=>renderRegionMonths(country,region,months,valid,subregion))}});td.append(btn);actionRow.append(td)}body.append(actionRow);
 const monthlyAnalysisRow=node("tr");monthlyAnalysisRow.append(node("th","本月分析"));for(const item of monthData){const td=node("td"),monthLabel=Number(item.month.slice(5,7))+"月",btn=node("button",monthLabel+"分析","monthly-analysis-open");btn.type="button";btn.addEventListener("click",()=>renderMonthlyClimateAnalysis(group,item.month,records,historicalResults));td.append(btn);monthlyAnalysisRow.append(td)}body.append(monthlyAnalysisRow);
 tbl.append(body);table.append(tbl);out.append(table);
 status.textContent=valid.length?"已選擇 "+scopeName+"｜球場 "+courses.length+" 個，其中 "+valid.length+" 個具有效座標，成功取得季節資料 "+records.length+" 組。":"已選擇 "+scopeName+"。此次分區尚無球場／天氣資料，但月份及週分析操作仍可使用。";
}


async function openMonthlyDateSevenDayReport(host,group,month,seasonalRecords,historicalRecords,course,date,monthlyContext=null){
 if(!course){const note=node("p","此分區沒有可用座標的代表球場，無法開啟逐日七天天氣報告。","risk-summary");host.append(note);return}
 const back=()=>renderMonthlyClimateAnalysis(group,month,seasonalRecords,historicalRecords);
 host.replaceChildren();
 showClimateScreen("出發日 7 天摘要",back);
 const heading=node("h3",course.name+"｜"+date+" ～ "+add(date,6),"monthly-linked-report-title");
 const note=node("p","本報告以此分區第一個已核實座標的代表球場「"+course.name+"」計算；點選報告中的逐日卡片，可繼續查看逐時天氣。","monthly-analysis-note");
 host.append(heading,note);
 const loading=node("p","正在讀取所選日期的七天天氣資料…","data-note");host.append(loading);
 try{
  S.course=course;
  const lead=Math.floor((Date.parse(date+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);
  if(monthlyContext?.forecastCourses)S.forecast={courses:monthlyContext.forecastCourses};
  else S.forecast=lead>=0&&lead<16?await fetchCourseForecast([course]):null;
  await renderCourseSevenDayReport(host,course,date,back,monthlyContext);
 }catch(error){host.append(node("p","七天天氣報告暫時無法產生："+(error?.message||String(error)),"risk-summary"))}
 finally{loading.remove()}
 host.scrollIntoView({behavior:"smooth",block:"start"});
}
async function renderMonthlyClimateAnalysis(group,month,seasonalRecords,historicalRecords){
 const host=$("region-report");host.replaceChildren();
 const back=()=>renderRegionMonths(group.country,group.rootRegion,group.months||monthOptions(),group.courses,group.subregion||"");
 showClimateScreen(month+"｜"+group.region+"天氣分析",back);
 // Keep the destination page header visible immediately while monthly data is assembled.
 const pageLoading=node("div",undefined,"monthly-page-loading");
 pageLoading.setAttribute("role","status");pageLoading.setAttribute("aria-live","polite");
 pageLoading.append(node("div",undefined,"monthly-page-spinner"),node("strong","正在開啟月分析…"),node("span","正在整理本月氣象與逐日資料"));
 $("flow-nav").append(pageLoading);
 const jumpNav=node("nav",undefined,"monthly-jump-nav");
 jumpNav.setAttribute("aria-label","月分析區塊快速跳轉");
 [
  ["本月\n高爾夫適打評估","monthly-section-3"],
  ["全月逐日\n天氣簡表","monthly-section-2"],
  ["本月氣象\n分析","monthly-section-1"]
 ].forEach(([label,target])=>{
  const button=node("button",label,"monthly-jump-button");button.type="button";
  button.addEventListener("click",()=>{
   const section=document.getElementById(target);
   if(section)section.scrollIntoView({behavior:"smooth",block:"start"});
  });
  jumpNav.append(button);
 });
 const weekButton=node("button","本月週分析","monthly-jump-button");weekButton.type="button";
 weekButton.addEventListener("click",()=>{
  if((seasonalRecords||[]).length)renderRegionTopWeeks(group,seasonalRecords,month);
  else renderEmptyWeekAnalysis(group.country,group.region,month,()=>renderMonthlyClimateAnalysis(group,month,seasonalRecords,historicalRecords));
 });
 jumpNav.append(weekButton);
 $("flow-nav").append(jumpNav);
 const title=section(host,"① "+month+"｜地區月氣象分析");title.id="monthly-section-1";title.classList.add("monthly-analysis-section");
 const monthIndex=Number(month.slice(5,7)),season=[];
 for(const rec of seasonalRecords||[]){const m=rec.monthly||{},i=(m.time||[]).findIndex(t=>String(t).slice(0,7)===month);if(i<0)continue;const get=k=>Number.isFinite(m[k]?.[i])?m[k][i]:null;season.push({rain:get("precipitation_mean"),rainAnomaly:get("precipitation_anomaly"),temp:get("temperature_2m_mean"),tempAnomaly:get("temperature_2m_anomaly"),wind:get("wind_speed_10m_mean"),cloud:get("cloud_cover_mean")})}
 const hist=(historicalRecords||[]).map(r=>r.monthly?.find(x=>x.month===monthIndex)).filter(Boolean);
 const avg=(arr,key)=>{const values=arr.map(x=>x?.[key]).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null};
 const seasonRain=avg(season,"rain"),rainAnomaly=avg(season,"rainAnomaly"),seasonTemp=avg(season,"temp"),tempAnomaly=avg(season,"tempAnomaly"),wind=avg(season,"wind"),cloud=avg(season,"cloud");
 const historicalRain=avg(hist,"rain"),rainDays=avg(hist,"rainDays"),low=avg(hist,"low"),high=avg(hist,"high"),dailyRain=avg(hist,"avgDailyRain"),maxRain=hist.length?Math.max(...hist.map(x=>x.maxDailyRain).filter(Number.isFinite)):null;
 // Seasonal-model fields and ERA5 historical normals are different evidence.
 // When the seasonal endpoint omits a field, show the available historical
 // analogue explicitly rather than presenting every seasonal tile as "資料不足".
 const historicalMeanTemp=Number.isFinite(high)&&Number.isFinite(low)?(high+low)/2:null;
 const stats=node("div",undefined,"monthly-analysis-stats"),statItems=[
  [Number.isFinite(seasonRain)?"季節模式月均降雨":"歷史月平均降雨（季節模式未提供）",Number.isFinite(seasonRain)?seasonRain:historicalRain," mm"],
  ["季節模式降雨距平",rainAnomaly," mm"],
  [Number.isFinite(seasonTemp)?"季節模式月均氣溫":"歷史月均溫估計（高低溫平均）",Number.isFinite(seasonTemp)?seasonTemp:historicalMeanTemp," °C"],
  ["季節模式氣溫距平",tempAnomaly," °C"],
  ["季節模式平均風速（歷史資料未擷取）",wind," m/s"],
  ["季節模式雲量（歷史資料未擷取）",cloud," %"],
  ["歷史月平均最高溫",high," °C"],["歷史月平均最低溫",low," °C"],
  ["歷史月降雨量",historicalRain," mm"],["歷史月降雨日數（≥1 mm）",rainDays," 日"],
  ["歷史月平均日雨量",dailyRain," mm／日"],["歷史月最高單日雨量",maxRain," mm"]
 ];
 for(const [label,value,unit] of statItems){const item=node("article",undefined,"monthly-analysis-stat");const shown=Number.isFinite(value)?value.toFixed(1)+unit:(label.includes("距平")?"無歷史距平可替代":"此資料來源未提供");item.append(node("small",label),node("strong",shown));stats.append(item)}
 title.append(stats);
 const coverage=node("p","資料覆蓋：季節模式月資料 "+season.length+"/"+(group.courses||[]).filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)).length+" 個球場；ERA5 歷史月統計 "+hist.length+"/"+(group.courses||[]).filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)).length+" 個球場。季節模式缺值時以歷史統計作參考，不代表季節預報。","monthly-source-note");
 title.append(coverage);
 const narrative=node("div",undefined,"monthly-analysis-narrative");
 narrative.append(node("p","正在彙整本月逐日天氣、降雨風險及歷史／季節模式訊號，完成後將計算適合打球的日期與建議時段。","monthly-analysis-note"));
 title.append(narrative,node("p","季節預報來源：Open-Meteo Seasonal Forecast API｜ECMWF seasonal seamless（EC46 + SEAS5）。歷史氣候來源：Open-Meteo Historical Weather API｜ERA5 reanalysis，使用最近十個完整年度。","monthly-source-note"));
 const dailySection=section(host,"② "+month+"｜全月逐日天氣簡表");dailySection.id="monthly-section-2";dailySection.classList.add("monthly-calendar-section");
 const daysInMonth=new Date(Date.UTC(Number(month.slice(0,4)),monthIndex,0)).getUTCDate(),dates=Array.from({length:daysInMonth},(_,i)=>month+"-"+String(i+1).padStart(2,"0"));
 const sampleCourses=(group.courses||[]).filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)).slice(0,3),startForecast=today(),endForecast=add(startForecast,15),overlaps=dates.some(d=>d>=startForecast&&d<=endForecast);
 let forecastCourses=[],historicalNormals=[],seasonalDailyRows=[];
 const loadNote=node("p","正在整理全月逐日資料…","data-note");dailySection.append(loadNote);
 const tasks=[];
 if(overlaps&&sampleCourses.length)tasks.push(fetchCourseForecast(sampleCourses).then(r=>{forecastCourses=r.courses||[]}).catch(e=>{loadNote.textContent="即時逐日預報暫時無法取得，將以氣候資料呈現："+(e?.message||String(e))}));
 if(sampleCourses.length){
  tasks.push((async()=>{
   const historyResults=await Promise.allSettled(sampleCourses.map(c=>fetchCourseHistoricalWeekNormals(c,dates)));
   const historyErrors=[];
   historyResults.forEach((result,index)=>{
    if(result.status==="fulfilled")historicalNormals.push(result.value);
    else historyErrors.push(sampleCourses[index].name+"：歷史資料讀取失敗（"+(result.reason?.message||String(result.reason))+"）");
   });
   const hasLongRangeDates=dates.some(d=>{const lead=Math.floor((Date.parse(d+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);return lead>=18&&lead<=89});
   if(hasLongRangeDates){
    const seasonalResults=await Promise.allSettled(sampleCourses.map(c=>fetchCourseSeasonalForecast(c)));
    const seasonalErrors=[];
    seasonalResults.forEach((result,index)=>{
     const course=sampleCourses[index],history=historicalNormals.find(x=>x.course?.id===course.id)||historicalNormals[index]||null;
     const raw=result.status==="fulfilled"?result.value:{};
     if(result.status==="rejected")seasonalErrors.push(course.name+"：季節訊號讀取失敗（"+(result.reason?.message||String(result.reason))+"）");
     // Historical ERA5 normals remain usable when the seasonal endpoint is unavailable.
     if(history||result.status==="fulfilled")seasonalDailyRows.push(...buildDailyClimateOutlook(raw,history?.days||[],today(),90));
    });
    if(historyErrors.length||seasonalErrors.length){
     const issues=[...historyErrors,...seasonalErrors];
     loadNote.textContent="資料來源狀態："+issues.join("；")+"。已使用成功取得的歷史資料與季節訊號產生可用估計；缺少來源的欄位不會填入虛構數值。";
     loadNote.classList.add("risk-summary");
    }
   }else if(historyErrors.length){
    loadNote.textContent="歷史資料來源暫時無法取得："+historyErrors.join("；");
    loadNote.classList.add("risk-summary");
   }
  })());
 }
 await Promise.all(tasks);
 pageLoading.remove();
 // Aggregate the complete month into a practical golf-planning assessment.
 const dailyAssessment=dates.map(date=>{
  const lead=Math.floor((Date.parse(date+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);
  const actual=forecastCourses.map(f=>{const i=(f.daily?.time||[]).indexOf(date);return i<0?null:{rain:f.daily.precipitation_sum?.[i],prob:f.daily.precipitation_probability_max?.[i],high:f.daily.temperature_2m_max?.[i],low:f.daily.temperature_2m_min?.[i]}}).filter(Boolean);
  const seasonal=seasonalDailyRows.filter(x=>x.date===date),historical=historicalNormals.map(n=>n.days?.find(x=>x.date===date)).filter(Boolean);
  const mean=(arr,key)=>{const v=arr.map(x=>x?.[key]).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  const isForecast=lead>=0&&lead<16&&actual.length>0;
  const rainChance=isForecast?mean(actual,"prob"):seasonal.length?mean(seasonal,"rainChanceEstimate"):mean(historical,"rainFrequency");
  const rainAmount=isForecast?mean(actual,"rain"):seasonal.length?mean(seasonal,"rainEstimate"):mean(historical,"rainMean");
  const highTemp=isForecast?mean(actual,"high"):seasonal.length?mean(seasonal,"highEstimate"):mean(historical,"highMean");
  if(!Number.isFinite(rainChance)&&!Number.isFinite(rainAmount))return {date,valid:false};
  const chance=Number.isFinite(rainChance)?rainChance:100,amount=Number.isFinite(rainAmount)?rainAmount:0;
  const grade=chance<30&&amount<1?0:chance<45&&amount<2?1:chance<60&&amount<4?2:3;
  return {date,valid:true,grade,playable:grade<=1&&(!Number.isFinite(highTemp)||highTemp<=33),chance,amount,source:isForecast?"逐日預報":seasonal.length?"歷史＋季節模式估計":"歷史氣候參考"};
 }).filter(x=>x.valid);
 const playable=dailyAssessment.filter(x=>x.playable),watch=dailyAssessment.filter(x=>x.grade===2),wet=dailyAssessment.filter(x=>x.grade===3);
 const seasonBaseline=Number.isFinite(seasonRain)&&Number.isFinite(rainAnomaly)?seasonRain-rainAnomaly:null;
 const seasonRatio=Number.isFinite(seasonBaseline)&&seasonBaseline>0?seasonRain/seasonBaseline:null;
 // Historical seasonal character and current model tendency are described separately.
 const historicalMonthType=Number.isFinite(historicalRain)?
  ((historicalRain>=250||rainDays>=16)?"雨季（歷史同期降雨多、雨日多）":
   (historicalRain<=60&&rainDays<=8)?"乾季（歷史同期降雨少、雨日少）":
   (historicalRain>=150||rainDays>=12)?"偏濕季（歷史同期雨量或雨日較多）":
   (historicalRain<=90&&rainDays<=10)?"偏乾季（歷史同期雨量及雨日較少）":
   "季節轉換型（歷史同期雨量與雨日介於乾、濕季之間）"):
  "歷史同期資料不足，無法判定";
 const historicalTypeLabel=Number.isFinite(historicalRain)?
  (historicalRain>=250||rainDays>=16?"雨季":
   historicalRain<=60&&rainDays<=8?"乾季":
   historicalRain>=150||rainDays>=12?"偏濕季":
   historicalRain<=90&&rainDays<=10?"偏乾季":"季節轉換型"):"資料不足";
 const modelType=Number.isFinite(seasonRatio)?
  (seasonRatio>=1.35?"明顯偏濕":seasonRatio>=1.15?"偏濕":seasonRatio<=.75?"偏乾":"季節訊號不明顯"):
  "季節模式資料不足";
 const seasonLabel=Number.isFinite(seasonRatio)?
  (modelType==="明顯偏濕"||modelType==="偏濕"?"偏濕季":
   modelType==="偏乾"?"偏乾季":historicalTypeLabel):
  historicalTypeLabel;
 const best=[...dailyAssessment].sort((a,b)=>a.grade-b.grade||a.chance-b.chance||a.amount-b.amount||a.date.localeCompare(b.date)).slice(0,5);
 const datesText=best.length?best.map(x=>Number(x.date.slice(8,10))+"日").join("、"):"資料不足，暫無推薦日期";
 // Recommend a continuous five-day travel window only when all five dates have usable data.
 const byDate=new Map(dailyAssessment.map(x=>[x.date,x]));
 const fiveDayWindows=[];
 for(let i=0;i<=dates.length-5;i++){
  const window=dates.slice(i,i+5).map(d=>byDate.get(d));
  if(window.some(x=>!x))continue;
  fiveDayWindows.push({days:window,grade:window.reduce((s,x)=>s+x.grade,0)/5,chance:window.reduce((s,x)=>s+x.chance,0)/5,amount:window.reduce((s,x)=>s+x.amount,0)/5});
 }
 fiveDayWindows.sort((a,b)=>a.grade-b.grade||a.chance-b.chance||a.amount-b.amount||a.days[0].date.localeCompare(b.days[0].date));
 const preferredWindow=fiveDayWindows[0]||null;
 const dateRange=preferredWindow?Number(preferredWindow.days[0].date.slice(5,7))+"月"+Number(preferredWindow.days[0].date.slice(8,10))+"日 ～ "+Number(preferredWindow.days[4].date.slice(5,7))+"月"+Number(preferredWindow.days[4].date.slice(8,10))+"日":"資料不足，無法推薦連續5天";
 const modelDescription=Number.isFinite(seasonRatio)?
  (modelType==="明顯偏濕"?"本月雨勢明顯偏多，屬偏濕型態。":
   modelType==="偏濕"?"本月雨勢較多，屬偏濕型態。":
   modelType==="偏乾"?"本月雨勢較少，屬偏乾型態。":
   "無明顯季節模式訊號，依歷史推估。"):
  "無，依歷史推估。";
 const playableRatio=dailyAssessment.length?playable.length/dailyAssessment.length:null;
 const playableDescription=Number.isFinite(playableRatio)?
  (playableRatio>=.5?"適打天數：偏多（本月較多日期具較佳打球條件）":
   playableRatio>=.3?"適打天數：普通（仍有部分日期適合安排）":
   "適打天數：偏少（較容易受降雨影響）"):
  "適打天數：資料不足，暫無法判定";
 const historyDescription=historicalMonthType==="歷史同期資料不足，無法判定"?
  "資料不足，無法判定季節型態。":
  historicalTypeLabel==="雨季"?"雨季，降雨多、雨日多。":
  historicalTypeLabel==="乾季"?"乾季，降雨少、雨日少。":
  historicalTypeLabel==="偏濕季"?"偏濕季，雨量或雨日較多。":
  historicalTypeLabel==="偏乾季"?"偏乾季，降雨相對較少。":
  "季節轉換型，雨量介於乾季與雨季之間。";
 const suitabilitySection=section(host,"③ "+month+"｜本月高爾夫適打評估");suitabilitySection.id="monthly-section-3";suitabilitySection.classList.add("monthly-suitability-section");
 const summary=node("div",undefined,"monthly-playability-card");
 const reportHeader=node("header",undefined,"monthly-playability-header");
 const headerTitle=node("strong",month.slice(0,4)+"年"+monthIndex+"月適打評估");
 const countryName=String(group.country||"").replace(/^[A-Z]{2,3}[・\\s]*/,"");
 const regionParts=String(group.region||"").split(/[・|｜]/).map(x=>x.trim()).filter(Boolean);
 const regionName=regionParts.length>1?regionParts[0]+"（"+regionParts.slice(1).join("・")+"）":(regionParts[0]||"");
 const headerRegion=node("span",[countryName,regionName].filter(Boolean).join("・"));
 reportHeader.append(headerTitle,headerRegion);
 summary.append(reportHeader);
 const seasonBanner=node("div",undefined,"monthly-playability-season");
 const seasonMain=node("div",undefined,"monthly-playability-season-main");
 seasonMain.append(node("div","🌦️ 本月型態","monthly-playability-kicker"),node("strong",seasonLabel,"monthly-playability-season-label"));
 const seasonPoints=node("div",undefined,"monthly-playability-season-points");
 const pointRows=[
  ["歷史同期",historyDescription,"history"],
  ["模式推估",modelDescription,"model"],
  ["✓",playableDescription,"playable"]
 ];
 pointRows.forEach(([label,detail,tone])=>{const row=node("div",undefined,"monthly-playability-season-point "+tone);row.append(node("strong",label),node("span",detail));seasonPoints.append(row)});
 seasonBanner.append(seasonMain,seasonPoints);
 summary.append(seasonBanner);
 const counts=node("div",undefined,"monthly-playability-counts");
 const countItems=[
  {label:"較適合",count:playable.length,desc:"降雨風險低且雨量少",tone:"good",icon:"😊"},
  {label:"需留意",count:watch.length,desc:"有一定降雨風險",tone:"watch",icon:"😐"},
  {label:"不優先",count:wet.length,desc:"降雨頻率或雨量偏高",tone:"poor",icon:"🌧️"}
 ];
 countItems.forEach(item=>{const card=node("div",undefined,"monthly-playability-count "+item.tone);card.append(node("span",item.icon,"monthly-playability-icon"),node("strong",item.label),node("b","約 "+item.count+" 天"),node("small",item.desc));counts.append(card)});
 summary.append(counts);
 const priority=node("div",undefined,"monthly-playability-priority");
 priority.append(node("strong","📅 優先日期"),node("span",datesText));
 const week=node("div",undefined,"monthly-playability-week");
 week.append(node("strong","🗓️ 優先週數"),node("span",dateRange));
 summary.append(priority,week);
 const notes=node("div",undefined,"monthly-playability-notes");
 const noteRows=[
  ["🎯 日期評估","依降雨頻率及估計雨量排序，並非保證晴天。"],
  ["📊 資料來源","優先使用前16天逐日預報；其他日期採 ERA5 歷史同期統計與可取得的週／月季節模式訊號。"],
  ["⛳ 適打天數","僅列入資料完整且可評估的日期；出發前仍須確認最新降雨、風勢及雷雨警示。"],
  ["ⓘ 說明","推薦優先日期為全月條件較佳的5天；優先週數為連續5天的建議出發時段，適合安排五天四夜行程。資料不足的日期不列入評估。"]
 ];
 noteRows.forEach(([label,detail])=>{const row=node("div",undefined,"monthly-playability-note-row");row.append(node("strong",label),node("span",detail));notes.append(row)});
 summary.append(notes);
 suitabilitySection.append(summary);
 // Display the three report blocks in the requested order: suitability, daily calendar, monthly climate analysis.
 host.insertBefore(suitabilitySection,title);
 host.insertBefore(dailySection,title);
 const expectedClimateDates=dates.filter(d=>{const lead=Math.floor((Date.parse(d+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);return lead>=18&&lead<=89});
 const producedDates=new Set(seasonalDailyRows.map(x=>x.date));
 const missingClimateDates=expectedClimateDates.filter(d=>!producedDates.has(d));
 if(missingClimateDates.length){
  const summary="逐日估計資料覆蓋 "+(expectedClimateDates.length-missingClimateDates.length)+"/"+expectedClimateDates.length+" 天；缺少 "+missingClimateDates.length+" 天。請查看資料來源狀態，未取得的日期不會以虛構數值補齊。";
  loadNote.textContent=loadNote.textContent==="正在整理全月逐日資料…"?summary:loadNote.textContent+" "+summary;
  loadNote.classList.add("risk-summary");
 }else if(loadNote.textContent==="正在整理全月逐日資料…")loadNote.remove();
 const calendar=node("div",undefined,"monthly-calendar-grid");["一","二","三","四","五","六","日"].forEach((d,i)=>calendar.append(node("div",d,"monthly-calendar-weekday"+(i>=5?" monthly-weekend":""))));
 dailySection.append(calendar); // Mount before enriching dates so later rendering errors cannot hide the month.
 const offset=(new Date(dates[0]+"T12:00:00Z").getUTCDay()+6)%7;for(let i=0;i<offset;i++)calendar.append(node("div","","monthly-calendar-empty"));
 const weatherLabel=code=>!Number.isFinite(code)?"資料不足":code===0?"晴朗":code<=2?"晴時多雲":code===3?"陰天":code>=51&&code<=57?"毛毛雨":code>=61&&code<=67?"降雨":code>=80&&code<=82?"陣雨":code>=95?"雷雨":"多雲";
 const mode=values=>{const nums=values.filter(Number.isFinite);if(!nums.length)return null;const counts=new Map();nums.forEach(v=>counts.set(v,(counts.get(v)||0)+1));return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0][0]};
 const modeText=values=>{const items=values.filter(v=>typeof v==="string"&&v.length);if(!items.length)return null;const counts=new Map();items.forEach(v=>counts.set(v,(counts.get(v)||0)+1));return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0][0]};
 dates.forEach(date=>{
  const lead=Math.floor((Date.parse(date+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);
  const actualEntries=forecastCourses.map(f=>{const i=(f.daily?.time||[]).indexOf(date);return i<0?null:{code:f.daily.weather_code?.[i],high:f.daily.temperature_2m_max?.[i],low:f.daily.temperature_2m_min?.[i],prob:f.daily.precipitation_probability_max?.[i]}}).filter(Boolean);
  const isForecast=lead>=0&&lead<16&&actualEntries.length>0,historicalEntries=historicalNormals.map(n=>n.days?.find(d=>d.date===date)).filter(Boolean);
  const seasonalEntries=seasonalDailyRows.filter(x=>x.date===date);
  const useSeasonal=!isForecast&&lead>=18&&lead<=89&&seasonalEntries.length>0;
  const dayOfWeek=new Date(date+"T12:00:00Z").getUTCDay(),isWeekend=dayOfWeek===0||dayOfWeek===6;
  const card=node("button",undefined,"monthly-calendar-day "+(isForecast?"monthly-day-forecast":useSeasonal?"monthly-day-seasonal":"monthly-day-history")+(isWeekend?" monthly-weekend":""));
  card.type="button";
  // Apply the non-forecast date fills directly to each card. This bypasses
  // inherited .panel button theme rules that previously painted seasonal
  // dates dark green on the deployed mobile calendar.
  if(useSeasonal){
   card.style.setProperty("background-color",isWeekend?"#fff2e8":"#fff8e9","important");
   card.style.setProperty("border-color",isWeekend?"#d6a08a":"#d8b36b","important");
   card.style.setProperty("color","#29483c","important");
  }else if(!isForecast){
   card.style.setProperty("background-color",isWeekend?"#f7eeeb":"#f1f4f6","important");
   card.style.setProperty("border-color",isWeekend?"#ead9d4":"#d8e0e5","important");
   card.style.setProperty("color","#29483c","important");
  }
  card.setAttribute("aria-label",date+" 天氣摘要，點選查看出發日七天天氣摘要");
  card.title="點選查看 "+date+" 出發日七天天氣摘要";
  card.addEventListener("click",()=>openMonthlyDateSevenDayReport(host,group,month,seasonalRecords,historicalRecords,sampleCourses[0],date,{forecastCourses,historicalNormals,seasonalDailyRows}))
  const code=mode(isForecast?actualEntries.map(x=>x.code):useSeasonal?seasonalEntries.map(x=>x.code):[]),highValue=isForecast?avg(actualEntries,"high"):useSeasonal?avg(seasonalEntries,"highEstimate"):avg(historicalEntries,"highMean"),lowValue=isForecast?avg(actualEntries,"low"):useSeasonal?avg(seasonalEntries,"lowEstimate"):avg(historicalEntries,"lowMean"),rainProb=isForecast?avg(actualEntries,"prob"):useSeasonal?avg(seasonalEntries,"rainChanceEstimate"):avg(historicalEntries,"rainFrequency"),rainValue=useSeasonal?avg(seasonalEntries,"rainEstimate"):null,confidenceLabel=useSeasonal?seasonalEntries.map(x=>x.confidence).filter(Boolean).sort((a,b)=>({ "中低":0,"偏低":1,"低":2,"資料不足":3 }[b]??4)-({ "中低":0,"偏低":1,"低":2,"資料不足":3 }[a]??4))[0]:null;
  const icon=createWeatherIcon(code,!isForecast&&!useSeasonal,rainProb);icon.classList.add("monthly-day-icon");
  card.append(node("strong",String(Number(date.slice(8,10))),"monthly-day-date"),icon,node("span",isForecast?weatherLabel(code):useSeasonal?(modeText(seasonalEntries.map(x=>x.weather))||"長期氣候估計"):(Number.isFinite(rainProb)?rainProb>=60?"歷史常有雨":rainProb>=30?"歷史偶有雨":"歷史較少雨":"歷史資料不足"),"monthly-day-condition"));
  card.append(node("b",Number.isFinite(highValue)?highValue.toFixed(0)+"°":"—","monthly-day-high"),node("span",Number.isFinite(lowValue)?lowValue.toFixed(0)+"°":"—","monthly-day-low"));
  card.append(node("small",isForecast?"雨機率 "+(Number.isFinite(rainProb)?rainProb.toFixed(0)+"%":"—"):useSeasonal?"雨日頻率 "+(Number.isFinite(rainProb)?rainProb.toFixed(0)+"%":"—"):"歷史雨頻 "+(Number.isFinite(rainProb)?rainProb.toFixed(0)+"%":"—"),"monthly-day-rain"));
  if(useSeasonal){
   card.append(node("small","雨量 "+(Number.isFinite(rainValue)?rainValue.toFixed(1)+" mm":"—"),"monthly-day-rain"));
   const sampleYears=seasonalEntries.map(x=>x.historicalSampleYears).filter(Number.isFinite);
   const meanYears=sampleYears.length?avg(sampleYears.map(x=>({v:x})),"v"):null;

  }
  calendar.append(card);
 });
 const legend=node("div",undefined,"monthly-calendar-legend");legend.append(node("span","● 逐日預報（前16天）","monthly-legend-forecast"),node("span","● 歷史＋季節訊號估計（第19–90天）","monthly-legend-seasonal"));dailySection.append(legend);
 dailySection.append(node("p","全表說明：前16天優先採逐日預報；第17–18天若無季節估計則以歷史同期參考；第19–90天採 ERA5 歷史同期統計結合可取得的週／月季節訊號估計。卡片中的雨日頻率是長期風險指標，不等同當日實際降雨機率；雨量為日均估計量。信心等級及歷史樣本年數不逐日重複顯示，統一由本說明交代：信心反映歷史樣本與季節訊號覆蓋，不是預報命中率；歷史樣本以最近十個完整年度為基礎。","monthly-source-note"));
 if(!sampleCourses.length)dailySection.append(node("p","此分區尚無具有效 GPS 座標的球場，無法產生逐日天氣簡表。","risk-summary"));
 host.scrollIntoView({behavior:"smooth",block:"start"});
}

async function renderEmptyWeekAnalysis(country,region,month,backAction){
 const out=$("region-report");out.replaceChildren();showClimateScreen("③ "+region+"｜"+month+"｜週次預覽",backAction||(()=>showCountryOverview()));
 const pageLoading=node("div",undefined,"monthly-page-loading");pageLoading.setAttribute("role","status");pageLoading.setAttribute("aria-live","polite");
 pageLoading.append(node("div",undefined,"monthly-page-spinner"),node("strong","正在開啟週分析…"),node("span","正在準備週次分析頁面"));
 $("flow-nav").append(pageLoading);
 await new Promise(resolve=>requestAnimationFrame(resolve));
 const panel=node("section",undefined,"week-recommendations");
 panel.append(node("h3","③ "+region+"｜"+month+" 週天氣分析"),node("p","此分區目前尚無球場座標或天氣資料。以下提供週次版面預覽；資料建置完成後會自動以該區實際季節資料取代。","long-range-note"));
 const grid=node("div",undefined,"week-grid");
 const first=month+"-01";
 for(let i=0;i<3;i++){const start=add(first,i*7),end=add(start,6),card=node("article",undefined,"week-card");card.append(node("div","週次 "+(i+1),"week-rank"),node("h4",start+" ～ "+end),node("strong","天氣資料待建置"),node("p","降雨、溫度及適打分析暫無資料。"),node("button","查看七天報告","week-open"));card.lastChild.type="button";card.lastChild.addEventListener("click",()=>renderEmptySevenDay(country,region,start));grid.append(card)}
 panel.append(grid);out.append(panel);
 pageLoading.remove();
}
function renderEmptySevenDay(country,region,start){
 const out=$("region-report");out.replaceChildren();showClimateScreen("④ "+region+"｜七天天氣報告預覽",()=>renderEmptyWeekAnalysis(country,region,start.slice(0,7)));const panel=node("section",undefined,"selected-week-report");
 panel.append(node("h3","④ "+region+"｜七天天氣報告"),node("h4",start+" ～ "+add(start,6)),node("p","此分區尚無球場／天氣資料。此畫面為版面預覽，並非實際天氣預報。","long-range-note"));
 const strip=node("div",undefined,"seven-day-strip");
 for(let i=0;i<7;i++){const date=add(start,i),tile=node("div",undefined,"seven-day-item");tile.append(node("strong",date.slice(5)),node("span","待建置"));strip.append(tile)}
 panel.append(strip);const choose=node("button","前往選擇出發日期及球場","week-back");choose.type="button";choose.addEventListener("click",()=>{$("departure").value=start;$("departure").scrollIntoView({behavior:"smooth",block:"center"})});panel.append(choose);out.append(panel);
}

async function renderRegionTopWeeks(group,records,month){
 const out=$("region-report");out.replaceChildren();showClimateScreen("③ "+group.region+"｜"+month+"｜本月推薦週次",()=>renderRegionMonths(group.country||$("climate-country").value,group.rootRegion||group.region,group.months||monthOptions(),group.courses,group.subregion||""));
 const pageLoading=node("div",undefined,"monthly-page-loading");pageLoading.setAttribute("role","status");pageLoading.setAttribute("aria-live","polite");
 pageLoading.append(node("div",undefined,"monthly-page-spinner"),node("strong","正在開啟週分析…"),node("span","正在整理所選月份的推薦週次"));
 $("flow-nav").append(pageLoading);
 await new Promise(resolve=>requestAnimationFrame(resolve));
 const panel=node("section",undefined,"week-recommendations");
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
   else if(Number.isFinite(mean))signals.push({efi:Number.isFinite(anomaly)&&mean>0?anomaly/mean:0,source:"monthly"});
  }
  if(!signals.length)continue;
  const mean=signals.reduce((s,x)=>s+x.efi,0)/signals.length,rank=mean<=-.2?0:mean<=.05?1:mean<=.2?2:3;
  candidates.push({start,end:weekEnd,rank,signal:mean,coverage:signals.length,source:signals.every(x=>x.source==="weekly")?"weekly":"monthly"});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.signal-b.signal||a.start.localeCompare(b.start));
 const picked=[];for(const item of candidates){if(picked.every(x=>Math.abs((Date.parse(item.start)-Date.parse(x.start))/86400000)>=7)){picked.push(item);if(picked.length===3)break}}
 if(!picked.length){panel.append(node("div","目前沒有取得可用的 2 月週／月尺度降雨資料，因此暫時無法排序推薦週次。請檢查球場季節資料覆蓋。","risk-summary"))}
 else{
  const grid=node("div",undefined,"week-grid top-week-grid");
  picked.forEach((x,i)=>{const card=node("article",undefined,"week-card");const heading=node("div",undefined,"week-card-heading");heading.append(node("div","TOP "+(i+1),"week-rank"),node("h4",x.start.slice(5).replace("-","/")+" – "+x.end.slice(5).replace("-","/")));const summary=node("div",undefined,"week-card-summary");summary.append(node("span","降雨趨勢："+["偏乾","接近基準","偏濕","顯著偏濕"][x.rank],"week-rain-summary"),node("span","資料可信度："+(x.source==="weekly"?"週尺度":"月尺度參考")+"｜覆蓋 "+x.coverage+"/"+records.length,"week-confidence"));card.append(heading,summary);const choose=node("button","查看此週 7 天報告","week-open");choose.type="button";choose.addEventListener("click",()=>renderSelectedWeekReport(group,x,records,month));card.append(choose);grid.append(card)});
  panel.append(grid);
 }
 out.append(panel);
 pageLoading.remove();
 const coursePanel=node("section",undefined,"cluster-course-panel");
 coursePanel.append(node("h3","選擇出發日期及球場"));
 const choose=node("button","前往選擇出發日期及球場","cluster-course-use");
 choose.type="button";
 choose.addEventListener("click",()=>showDepartureForm($("departure").value||today(),()=>renderRegionTopWeeks(group,records,month)));
 coursePanel.append(choose);out.append(coursePanel);
}


function makeSelectedWeekHourlyRecords(forecast,date,teeHour){
 const hourly=forecast?.hourly;
 if(!hourly?.time?.length)return [];
 const indices=hourly.time.map((t,i)=>String(t).slice(0,10)===date&&Number(String(t).slice(11,13))>=teeHour&&Number(String(t).slice(11,13))<teeHour+6?i:-1).filter(i=>i>=0);
 return indices.map(i=>({
  time:String(hourly.time[i]).slice(11,16),
  code:hourly.weather_code?.[i]??null,
  rain:hourly.precipitation_probability?.[i]??null,
  mm:hourly.precipitation?.[i]??null,
  temp:hourly.temperature_2m?.[i]??null,
  feel:hourly.apparent_temperature?.[i]??null,
  wind:Number.isFinite(hourly.wind_speed_10m?.[i])?hourly.wind_speed_10m[i]*3.6:null,
  gust:Number.isFinite(hourly.wind_gusts_10m?.[i])?hourly.wind_gusts_10m[i]*3.6:null,
  dir:hourly.wind_direction_10m?.[i]??null,
  rh:hourly.relative_humidity_2m?.[i]??null,
  cloud:hourly.cloud_cover?.[i]??null,
  uv:hourly.uv_index?.[i]??null
 }));
}
async function renderSelectedWeekHourlyPage(host,group,week,records,month,date,cachedForecasts=[]){
 const courses=(group.courses||[]).filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)).slice(0,3);
 const back=()=>renderSelectedWeekReport(group,week,records,month,cachedForecasts);
 showClimateScreen("⑤ "+group.region+"｜"+date+"｜逐時天氣",back);
 host.replaceChildren();
 const intro=node("p","已帶入所選日期及此分區球場資料。請選擇要查看的球場；逐時資料依球場 GPS 與當地時區讀取。","data-note");
 host.append(intro);
 let forecasts=Array.isArray(cachedForecasts)?cachedForecasts:[];
 if(!forecasts.length){
  const loading=node("p","正在讀取球場逐時預報…","data-note");host.append(loading);
  try{const result=await fetchCourseForecast(courses);forecasts=result.courses||[]}
  catch(error){loading.textContent="逐時預報讀取失敗："+(error?.message||String(error));return}
  loading.remove();
 }
 const available=forecasts.filter(f=>(f.hourly?.time||[]).some(t=>String(t).slice(0,10)===date));
 if(!available.length){host.append(node("p","所選日期目前沒有可用的逐時預報資料。","risk-summary"));return}
 const selectorWrap=node("div",undefined,"controls");
 const label=node("label","球場");const selector=node("select");selector.setAttribute("aria-label","選擇逐時天氣球場");
 available.forEach(f=>selector.add(new Option(f.course.name,f.course.id)));
 label.append(selector);selectorWrap.append(label);host.append(selectorWrap);
 const detail=node("div");host.append(detail);
 const renderCourse=()=>{
  detail.replaceChildren();
  const forecast=available.find(f=>f.course.id===selector.value)||available[0];
  const teeHour=Number($("tee")?.value||10);
  const hourlyRecords=makeSelectedWeekHourlyRecords(forecast,date,teeHour);
  if(!hourlyRecords.length){detail.append(node("p","此球場在所選日期沒有 "+String(teeHour).padStart(2,"0")+":00 起六小時的逐時資料。","risk-summary"));return}
  const note=node("p","已選日期："+date+"｜球場："+forecast.course.name+"｜開球時間："+String(teeHour).padStart(2,"0")+":00（顯示開球後六小時）","data-note");
  detail.append(note);
  renderTaiwanPwaHourly(detail,forecast.course,date,hourlyRecords);
 };
 selector.addEventListener("change",renderCourse);
 renderCourse();
 host.scrollIntoView({behavior:"smooth",block:"start"});
}
async function renderSelectedWeekReport(group,week,records,month,cachedForecasts=null){
 const host=$("region-report");host.replaceChildren();showClimateScreen("④ "+group.region+"｜"+week.start+"｜七天天氣報告",()=>renderRegionTopWeeks(group,records,month));
 const dates=Array.from({length:7},(_,i)=>add(week.start,i));
 const leadFor=date=>Math.floor((Date.parse(date+"T12:00:00Z")-Date.parse(today()+"T12:00:00Z"))/86400000);
 const courses=(group.courses||[]).filter(c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)).slice(0,3);
 const report=section(host,(dates.some(date=>leadFor(date)>=0&&leadFor(date)<16)?"七天逐日天氣預報｜":"歷史同期七天天氣參考｜")+week.start+" ～ "+week.end);
 const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
 const wxLabel=code=>{if(!Number.isFinite(code))return "資料不足";if(code===0)return "晴朗";if(code<=2)return "晴時多雲";if(code===3)return "陰天";if(code>=51&&code<=57)return "毛毛雨";if(code>=61&&code<=67)return "降雨";if(code>=80&&code<=82)return "陣雨";if(code>=95)return "雷雨";return "多雲"};
 const wxIcon=code=>!Number.isFinite(code)?"—":code===0?"☀️":code<=2?"🌤️":code===3?"☁️":code>=51&&code<=67?"🌧️":code>=80&&code<=82?"🌦️":code>=95?"⛈️":"☁️";
 let forecasts=Array.isArray(cachedForecasts)?cachedForecasts:[];
 const hasNearTermDate=dates.some(date=>leadFor(date)>=0&&leadFor(date)<16);
 if(hasNearTermDate&&courses.length&&!forecasts.length){
  try{const result=await fetchCourseForecast(courses);forecasts=result.courses||[]}
  catch(e){report.append(node("p","逐日預報暫時無法取得："+e.message,"risk-summary"))}
 }
 let rows=dates.map(date=>{
  const entries=forecasts.map(f=>{const i=(f.daily?.time||[]).indexOf(date);return i<0?null:{code:f.daily.weather_code?.[i],rain:f.daily.precipitation_sum?.[i],prob:f.daily.precipitation_probability_max?.[i],low:f.daily.temperature_2m_min?.[i],high:f.daily.temperature_2m_max?.[i],feel:f.daily.apparent_temperature_max?.[i]}}).filter(Boolean);
  const codes=entries.map(x=>x.code).filter(Number.isFinite);
  const code=codes.length?codes.sort((a,b)=>codes.filter(x=>x===b).length-codes.filter(x=>x===a).length)[0]:null;
  const actual=entries.length>0;
  return {date,actual,clickable:leadFor(date)>=0&&leadFor(date)<16,code,icon:wxIcon(code),label:actual?wxLabel(code):"歷史資料待補",rain:median(entries.map(x=>x.rain)),prob:median(entries.map(x=>x.prob)),low:median(entries.map(x=>x.low)),high:median(entries.map(x=>x.high)),feel:median(entries.map(x=>x.feel))};
 });
 const historicalDates=rows.filter(r=>!r.actual).map(r=>r.date);
 if(historicalDates.length&&courses.length){
  const results=await Promise.allSettled(courses.map(c=>fetchCourseHistoricalWeekNormals(c,historicalDates)));
  const normals=results.filter(x=>x.status==="fulfilled").map(x=>x.value);
  rows=rows.map(r=>{
   if(r.actual)return r;
   const samples=normals.map(n=>n.days?.find(d=>d.date===r.date)).filter(Boolean);
   const get=k=>median(samples.map(x=>x[k]));
   const prob=get("rainFrequency");
   return {...r,high:get("highMean"),low:get("lowMean"),prob,rain:get("rainMean"),label:!Number.isFinite(prob)?"歷史資料不足":prob>=60?"歷史常有雨":prob>=30?"歷史偶有雨":"歷史較少雨"};
  });
 }
 if(rows.some(r=>r.actual)&&historicalDates.length)report.append(node("p","本週逐日預報僅適用於未來16天範圍內的日期；其餘日期以過去十年歷史同期統計補充，不代表該日實際天氣。","long-range-note"));
 if(!rows.some(r=>r.actual))report.append(node("p","以下為過去十年相同月日的 ERA5 歷史同期統計；降雨頻率不是未來降雨機率，氣溫與雨量不是該週預報。","long-range-note"));
 report.append(node("p","點選未來16天內的日期，可查看該日逐時天氣。","data-note"));
  renderSevenDayVisual(report,rows,!rows.some(r=>r.actual),date=>renderSelectedWeekHourlyPage(host,group,week,records,month,date,forecasts));
 const choose=node("button","選擇出發日期及球場","week-back");choose.type="button";choose.addEventListener("click",()=>showDepartureForm(week.start,()=>renderSelectedWeekReport(group,week,records,month,forecasts)));host.append(choose);host.scrollIntoView({behavior:"smooth",block:"start"});
}

function returnFromDepartureForm(){
 const form=$("departure")?.closest(".panel");
 if(!form||form.hidden)return false;
 form.hidden=true;
 const report=$("report");report.replaceChildren();report.hidden=true;
 $("climate-explorer").hidden=false;
 const action=departureFormReturnAction;departureFormReturnAction=null;
 if(action)action();
 else{const fallback=climateBackAction;climateBackAction=null;if(fallback)fallback();else showCountryOverview()}
 return true;
}
function showDepartureForm(startDate,returnAction=null){
 departureFormReturnAction=returnAction;
 const previousReport=$("report");previousReport.replaceChildren();previousReport.hidden=true;
 $("departure").value=startDate;$("departure").min=today();$("departure").max=add(today(),89);
 $("course-note").textContent="已帶入所選週次起始日；請選擇球場及開球時間。";
 $("climate-explorer").hidden=true;
 const form=$("departure").closest(".panel");form.hidden=false;
 let nav=$("departure-form-nav");
 if(!nav){nav=node("div",undefined,"departure-form-nav");nav.id="departure-form-nav";form.insertBefore(nav,form.firstChild)}
 nav.replaceChildren();
 const back=node("button","← 返回上一層","departure-form-back");back.type="button";
 back.addEventListener("click",()=>returnFromDepartureForm());
 const home=node("button","⌂ 返回首頁","departure-form-home");home.type="button";
 home.addEventListener("click",()=>{
  form.hidden=true;departureFormReturnAction=null;$("report").replaceChildren();$("report").hidden=true;$("climate-explorer").hidden=false;
  climateBackAction=null;showCountryOverview();
 });
 nav.append(back,home);
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