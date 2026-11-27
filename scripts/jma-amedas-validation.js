export function parseAmedasReading(entry){
 if(!Array.isArray(entry)||entry.length<2)return {value:null,quality:null,usable:false};
 const [value,quality]=entry;
 const usable=(quality===0||quality===1)&&typeof value==="number"&&Number.isFinite(value);
 return {value:usable?value:null,quality,usable};
}

export function parseAmedasPointBlock(payload){
 return Object.entries(payload||{}).filter(([key])=>/^\\d{14}$/.test(key)).map(([key,row])=>({
  time:key.slice(0,4)+"-"+key.slice(4,6)+"-"+key.slice(6,8)+"T"+key.slice(8,10)+":"+key.slice(10,12),
  temperature:parseAmedasReading(row.temp),
  humidity:parseAmedasReading(row.humidity),
  precipitation1h:parseAmedasReading(row.precipitation1h),
  windSpeed:parseAmedasReading(row.wind),
  windDirection:parseAmedasReading(row.windDirection),
  gust:parseAmedasReading(row.gust),
  qualityCounts:Object.fromEntries(["temp","humidity","precipitation1h","wind","windDirection","gust"].map(k=>[k,row[k]?.[1]??null]))
 })).sort((a,b)=>a.time.localeCompare(b.time));
}

export function regressionMetrics(pairs){
 const rows=pairs.filter(x=>Number.isFinite(x.forecast)&&Number.isFinite(x.observed));
 if(!rows.length)return {n:0,mae:null,bias:null,rmse:null};
 const errors=rows.map(x=>x.forecast-x.observed);
 return {n:rows.length,mae:errors.reduce((s,x)=>s+Math.abs(x),0)/rows.length,bias:errors.reduce((s,x)=>s+x,0)/rows.length,rmse:Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/rows.length)};
}

export function rainEventMetrics(pairs,threshold){
 const rows=pairs.filter(x=>Number.isFinite(x.forecast)&&Number.isFinite(x.observed));
 let hits=0,misses=0,falseAlarms=0,correctNegatives=0;
 for(const x of rows){const f=x.forecast>=threshold,o=x.observed>=threshold;if(f&&o)hits++;else if(!f&&o)misses++;else if(f&&!o)falseAlarms++;else correctNegatives++;}
 const pod=hits+misses?hits/(hits+misses):null,far=hits+falseAlarms?falseAlarms/(hits+falseAlarms):null,csi=hits+misses+falseAlarms?hits/(hits+misses+falseAlarms):null;
 return {thresholdMmPerHour:threshold,n:rows.length,hits,misses,falseAlarms,correctNegatives,pod,far,csi};
}