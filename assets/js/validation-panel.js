import {buildRegionalCoverage} from "./regional-coverage.js";
const finite=value=>typeof value==="number"&&Number.isFinite(value);
const fmt=value=>finite(value)?value.toFixed(3):"資料累積中";
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
function metric(label,value){const item=node("article",undefined,"validation-metric");item.append(node("span",label),node("strong",value));return item;}
async function renderRegionalCoverage(host){
 const section=node("section",undefined,"validation-section regional-coverage");
 section.append(node("h3","亞洲八國次分區資料覆蓋"));
 host.append(section);
 try{
  const [countryResponse,courseResponse,registryResponse]=await Promise.all([
   fetch("./config/global/countries.json",{cache:"no-store"}),
   fetch("./config/global/courses.json",{cache:"no-store"}),
   fetch("./config/global/weather-subregions.json",{cache:"no-store"})
  ]);
  if(!countryResponse.ok||!courseResponse.ok||!registryResponse.ok)throw new Error("國家、球場或次分區主檔讀取失敗");
  const coverage=buildRegionalCoverage(await countryResponse.json(),await courseResponse.json(),(await registryResponse.json()).countries||[]);
  const summary=node("div",undefined,"validation-metrics");
  summary.append(metric("國家資料",coverage.countryCount+" 國"),metric("已有代表球場",coverage.readySubregionCount+" 區"),metric("登錄次分區",coverage.subregionCount+" 區"));
  section.append(summary);
  for(const country of coverage.countries){
   const card=node("article",undefined,"coverage-country-card");
   const title=node("div",undefined,"coverage-country-heading");
   title.append(node("strong",country.nameZh),node("span",country.subregionCount?country.readySubregionCount+"/"+country.subregionCount+" 區已配置":"尚未規劃次分區","coverage-state"));
   card.append(title);
   if(country.subregions.length){
    for(const region of country.subregions){
     const row=node("p",undefined,"coverage-region-row");
     const representative=region.representative;
     row.textContent=region.label+"｜"+(representative?"候選 "+region.candidateCount+" 座｜代表："+(representative.nameLocal||representative.name):region.candidateCourseName?"代表球場候選："+region.candidateCourseName+"｜待核座標與營運狀態":"尚待選定代表球場")+(region.coverageStatus==="unregistered-subregion"?"｜未登錄":"");
     card.append(row);
    }
   }else{
    card.append(node("p","尚未建立可用球場座標及氣象次分區。","validation-note"));
   }
   section.append(card);
  }
  section.append(node("p","已登錄分區優先使用主檔指定的代表球場 ID；未指定時才以球場群地理中心最近者作為暫定代表。同區其他球場共用代表點天氣資料。尚未登錄的國家或分區不會產生假資料，也不代表已完成預報回測。","validation-note"));
 }catch(error){
  section.append(node("p","分區覆蓋盤點尚未完成："+(error?.message||String(error)),"validation-empty"));
 }
}
export async function mountValidationPanel(host){
 if(!host)return;
 host.replaceChildren();
 const disclosure=node("details",undefined,"validation-disclosure");
 const heading=node("summary",undefined,"validation-heading validation-summary");
 heading.append(node("h2","90 天預報驗證"),node("span","沖繩試點資料","validation-tag"));
 const content=node("div",undefined,"validation-disclosure-content");
 const scopeNote=node("p","目前回測範圍僅包含沖繩北部、中部、南部三個次分區；不代表亞洲八國整體驗證。其他國家及次分區尚未納入本回測。","validation-scope-note");
 const body=node("div",undefined,"validation-body");
 content.append(scopeNote,body);
 disclosure.append(heading,content);
 host.append(disclosure);
 renderRegionalCoverage(body);
 try{
  const response=await fetch("./assets/data/90day-validation.json",{cache:"no-store"});
  if(!response.ok)throw new Error("尚未發布驗證報告");
  const report=await response.json();
  if(!report||typeof report!=="object")throw new Error("驗證資料格式不正確");
  const updated=report.generatedAt?new Date(report.generatedAt):null;
  body.append(node("p","資料基準日："+(report.asOf||"—")+"｜更新時間："+(updated&&!Number.isNaN(updated.valueOf())?updated.toLocaleString("zh-TW",{timeZone:"Asia/Taipei"}):"—"),"validation-updated"));
  const archive=report.archive||{};
  const top=node("div",undefined,"validation-metrics");
  top.append(metric("歷史快照",String(archive.snapshotCount??0)+" 日"),metric("已驗證短期樣本",String(report.overall?.overall?.probabilitySampleCount??0)+" 筆"),metric("推薦成熟窗口",String(report.recommendationQuality?.issueDatesWithThreeMaturedWindows??0)+" 個發佈日"));
  body.append(top);
  const maturity=report.verificationMaturity?.daily?.groups||{};
  const horizons=[["1-16","1～16 天"],["17-46","17～46 天"],["47-90","47～90 天"]];
  const section=node("section",undefined,"validation-section");
  section.append(node("h3","預報資料成熟度"));
  const grid=node("div",undefined,"validation-horizon-grid");
  for(const [bucket,label] of horizons){
   const rows=Object.entries(maturity).filter(([key])=>key.endsWith("."+bucket)).map(([,value])=>value);
   const ready=rows.filter(x=>x.ready).length;
   const best=rows.reduce((max,x)=>Math.max(max,x.uniqueValidDates||0),0);
   const wet=rows.reduce((max,x)=>Math.max(max,x.wetDates||0),0),dry=rows.reduce((max,x)=>Math.max(max,x.dryDates||0),0);
   const card=node("article",undefined,"validation-horizon-card");
   card.append(node("strong",label),node("b",rows.length?ready+"/"+rows.length+" 組達標":"尚無資料"),node("small","最多獨立日期 "+best+"｜濕日 "+wet+"｜乾日 "+dry));
   grid.append(card);
  }
  section.append(grid, node("p","達標門檻：每個來源／分區／期間至少 30 個獨立有效日期，且至少 5 個濕日及 5 個乾日。重複預報日期不重複計數。","validation-note"));
  body.append(section);
  const trip=report.verificationMaturity?.tripWindows?.groups||{};
  const tripSection=node("section",undefined,"validation-section");
  tripSection.append(node("h3","5 天 4 夜推薦模型成熟度"));
  const tripGrid=node("div",undefined,"validation-model-grid");
  const modelNames={baseline:"V1 正式模型",historyEnhanced:"歷史加權候選",longRangeEnhanced:"長期預報加權候選"};
  for(const id of ["baseline","historyEnhanced","longRangeEnhanced"]){
   const x=trip[id]||{};
   const card=node("article",undefined,"validation-model-card");
   card.append(node("strong",modelNames[id]),node("b",x.ready?"已達驗證門檻":"資料累積中"),node("small","成熟窗口 "+(x.uniqueMaturedWindows??0)+"｜濕窗 "+(x.wetWindows??0)+"｜乾窗 "+(x.dryWindows??0)));
   tripGrid.append(card);
  }
  tripSection.append(tripGrid,node("p","模型比較至少需要 30 個成熟且具濕／乾結果的獨立行程窗口。候選模型只做影子比較，不會改變正式 V1 權重。","validation-note"));
  body.append(tripSection);
  const quality=report.recommendationQuality||{};
  const q=node("section",undefined,"validation-section");
  q.append(node("h3","推薦品質回測"));
  const controls=node("div",undefined,"validation-metrics");
  controls.append(metric("歷史氣候基準",fmt(quality.historicalClimatology?.meanRainMmPerRegionDay)+" mm／區域球日"),metric("隨機基準",fmt(quality.randomControl?.meanRainMmPerRegionDay)+" mm／區域球日"));
  for(const [id,label] of [["baseline","V1"],["historyEnhanced","歷史加權"],["longRangeEnhanced","長期加權"]]){
   const x=quality.candidates?.[id];
   if(x)controls.append(metric(label,fmt(x.meanRainMmPerRegionDay)+" mm／區域球日"));
  }
  q.append(controls,node("p","數值為已成熟窗口的 ERA5 回溯平均雨量，不是未來降雨機率；越低代表回測期間雨量越少。","validation-note"));
  body.append(q);
  if(report.caveats?.length)body.append(node("p","資料限制："+report.caveats[0],"validation-note"));
 }catch(error){
  body.append(node("p","驗證報告尚未就緒："+(error?.message||String(error))+"。目前不會以模擬數據填補。","validation-empty"));
 }
}