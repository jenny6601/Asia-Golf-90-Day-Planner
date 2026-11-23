import {generateTripWindows,recommendTripDates} from "./date-engine.js";
const $=id=>document.getElementById(id);
const fmt=s=>new Intl.DateTimeFormat("zh-TW",{dateStyle:"medium",timeZone:"Asia/Taipei"}).format(new Date(s+"T00:00:00+08:00"));
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
$("start-date").value=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Taipei"});
$("run").addEventListener("click",run);run();
