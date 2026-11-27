const finite=v=>typeof v==="number"&&Number.isFinite(v);
const DAY=86400000;
const dayNumber=d=>Date.parse(d+"T00:00:00Z")/DAY;
const clamp01=x=>Math.max(0,Math.min(1,x));
function chooseDistinct(rows,scoreKey){
 const sorted=[...rows].filter(x=>finite(x[scoreKey])).sort((a,b)=>a[scoreKey]-b[scoreKey]||a.startDate.localeCompare(b.startDate));
 const selected=[];
 for(const row of sorted){
  if(!selected.some(x=>Math.abs(dayNumber(x.startDate)-dayNumber(row.startDate))<5))selected.push(row);
  if(selected.length===3)break;
 }
 return selected;
}
function seeded(seed){
 let state=2166136261;
 for(const ch of seed)state=Math.imul(state^ch.charCodeAt(0),16777619)>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
function randomPortfolio(rows,rng){
 const shuffled=[...rows];
 for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const selected=[];
 for(const row of shuffled){
  if(!selected.some(x=>Math.abs(dayNumber(x.startDate)-dayNumber(row.startDate))<5))selected.push(row);
  if(selected.length===3)break;
 }
 return selected;
}
function metrics(rows){
 const windows=rows.flatMap(x=>x);
 const rain=windows.map(x=>x.observedGolfRainMm);
 const wet=windows.reduce((sum,x)=>sum+x.observedWetRegionDays,0);
 const regionDays=windows.reduce((sum,x)=>sum+x.observedRegionDays,0);
 const wetWindows=windows.filter(x=>x.observedGolfRainMm>=1).length;
 const dryWindows=windows.length-wetWindows;
 return {portfolioCount:rows.length,selectedWindows:windows.length,wetWindows,dryWindows,
  meanRainMmPerRegionDay:rain.length?Number((rain.reduce((a,b)=>a+b,0)/rain.length).toFixed(3)):null,
  wetRegionDayRate:regionDays?Number((wet/regionDays).toFixed(4)):null,
  meanWetRegionDaysPerWindow:rain.length?Number((wet/rain.length).toFixed(3)):null};
}
function percentile(values,p){
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),pos=(sorted.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);
 return Number((sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo)).toFixed(3));
}
/**
 * Retrospective recommendation quality against historical-climate and random
 * portfolios. Only fully ERA5-observed windows enter all three strategies.
 * This is a comparative backtest, not a forecast probability or causal claim.
 */
export function evaluateRecommendationQuality(samples=[],randomDraws=500,expectedModels=[]){
 if(!Array.isArray(samples))throw new TypeError("samples must be an array");
 if(!Number.isInteger(randomDraws)||randomDraws<100)throw new TypeError("randomDraws must be at least 100");
 const valid=samples.filter(x=>typeof x.issueDate==="string"&&typeof x.model==="string"
  &&typeof x.startDate==="string"&&typeof x.endDate==="string"
  &&finite(x.predictedScore)&&finite(x.historicalScore)
  &&finite(x.observedGolfRainMm)&&x.observedGolfRainMm>=0
  &&Number.isInteger(x.observedWetRegionDays)&&x.observedWetRegionDays>=0
  &&x.observedWetRegionDays<=9&&x.observedRegionDays===9);
 const issues=[...new Set(valid.map(x=>x.issueDate))].sort();
 const models=[...new Set([...valid.map(x=>x.model),...expectedModels].filter(x=>typeof x==="string"))].sort();
 const candidatePortfolios=Object.fromEntries(models.map(x=>[x,[]]));
 const historyPortfolios=[],randomPortfolios=[];
 const paired={};
 for(const issueDate of issues){
  const baseline=valid.filter(x=>x.issueDate===issueDate&&x.model==="baseline");
  const pool=baseline;
  if(pool.length<3)continue;
  const history=chooseDistinct(pool,"historicalScore");
  if(history.length<3)continue;
  historyPortfolios.push(history);
  const rng=seeded(issueDate+"|random-control-v1");
  const randomForIssue=[];
  for(let draw=0;draw<randomDraws;draw++){
   const selected=randomPortfolio(pool,rng);
   if(selected.length===3){randomPortfolios.push(selected);randomForIssue.push(selected);}
  }
  const histMean=history.reduce((sum,x)=>sum+x.observedGolfRainMm,0)/history.length;
  const randomMean=randomForIssue.length?randomForIssue.reduce((sum,rows)=>sum+rows.reduce((a,x)=>a+x.observedGolfRainMm,0)/rows.length,0)/randomForIssue.length:null;
  for(const model of models){
   const modelRows=valid.filter(x=>x.issueDate===issueDate&&x.model===model);
   const selected=chooseDistinct(modelRows,"predictedScore");
   if(selected.length<3)continue;
   candidatePortfolios[model].push(selected);
   const modelMean=selected.reduce((sum,x)=>sum+x.observedGolfRainMm,0)/selected.length;
   (paired[model]??=[]).push({deltaVsHistory:modelMean-histMean,deltaVsRandom:randomMean===null?null:modelMean-randomMean});
  }
 }
 const history=metrics(historyPortfolios),random=metrics(randomPortfolios);
 const candidates={};
 for(const model of models){
  const result=metrics(candidatePortfolios[model]);
  const deltas=paired[model]||[];
  result.issueDatesCompared=deltas.length;
  result.meanRainDeltaVsHistorical= deltas.length?Number((deltas.reduce((s,x)=>s+x.deltaVsHistory,0)/deltas.length).toFixed(3)):null;
  const randomDeltas=deltas.filter(x=>finite(x.deltaVsRandom)).map(x=>x.deltaVsRandom);
  result.meanRainDeltaVsRandom=randomDeltas.length?Number((randomDeltas.reduce((s,x)=>s+x,0)/randomDeltas.length).toFixed(3)):null;
  result.ready=deltas.length>=30&&result.wetWindows>=5&&result.dryWindows>=5;
  candidates[model]=result;
 }
 const randomRain= randomPortfolios.map(rows=>rows.reduce((s,x)=>s+x.observedGolfRainMm,0)/rows.length);
 return {reference:"ERA5 daily precipitation at three regional representative points; wet region-day >=1.0 mm",
  strategy:"Three non-overlapping 5-day windows per issue date; only middle three golf days counted; all strategies use the same fully observed eligible window pool.",
  randomControl:{drawsPerIssueDate:randomDraws,...random,ready:history.portfolioCount>=30&&random.wetWindows>=5&&random.dryWindows>=5,portfolioRainP05:percentile(randomRain,.05),portfolioRainP95:percentile(randomRain,.95)},
  historicalClimatology:{...history,ready:history.portfolioCount>=30&&history.wetWindows>=5&&history.dryWindows>=5},
  candidates,minimumGate:{issueDates:30,wetWindows:5,dryWindows:5},issueDatesWithThreeMaturedWindows:history.portfolioCount,
  caveats:["ERA5 is a reanalysis reference, not an independent rain-gauge observation.","Historical-climate strategy ranks windows using the historical risk signals supplied in each archived snapshot.","Random control is deterministic Monte Carlo sampling from the same matured, eligible window pool; it is a benchmark, not a real travel strategy.","Lower mean rainfall and lower wet-region-day rate are better; results are comparative and not probabilities."]};
}
