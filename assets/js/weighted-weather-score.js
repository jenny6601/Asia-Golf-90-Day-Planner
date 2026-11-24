const finite=x=>typeof x==="number"&&Number.isFinite(x);
const clamp=x=>Math.max(0,Math.min(100,x));
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
function rainRisk(hours){
 const p=hours.map(x=>x.prob),r=hours.map(x=>x.rain);
 if(p.some(x=>!finite(x))||r.some(x=>!finite(x)))return null;
 const avg=mean(p),total=r.reduce((a,b)=>a+b,0),peak=Math.max(...r);
 const pi=avg<=20?0:avg<=40?20:avg<=60?45:avg<=80?70:90;
 const ai=total<=.1?0:total<=1?15:total<=3?35:total<=5?60:total<=10?80:100;
 const ii=peak<=.1?0:peak<=.5?15:peak<=1?30:peak<=2.5?55:peak<=5?80:100;
 return clamp(.35*pi+.40*ai+.25*ii);
}
function windRisk(hours){
 const v=hours.map(x=>x.gust??x.wind);
 if(v.some(x=>!finite(x)))return null;
 const peak=Math.max(...v);
 return peak<5?0:peak<8?20:peak<10?45:peak<12?70:peak<15?85:100;
}
function temperatureRisk(hours){
 const v=hours.map(x=>x.feels??x.temp);
 if(v.some(x=>!finite(x)))return null;
 const min=Math.min(...v),max=Math.max(...v);
 const discomfort=x=>x<5?100:x<10?70:x<15?35:x<=27?0:x<=30?25:x<=32?50:x<=35?75:100;
 return Math.max(discomfort(min),discomfort(max));
}
function summarizeSource(hours){
 if(!Array.isArray(hours)||hours.length!==6)return {status:"incomplete",expectedHours:6,actualHours:hours?.length??0};
 const rainfall=rainRisk(hours),wind=windRisk(hours),temperature=temperatureRisk(hours);
 if([rainfall,wind,temperature].some(x=>x===null))return {status:"missing-required-fields"};
 return {status:"scored",rainfallRisk:Math.round(rainfall*10)/10,windRisk:Math.round(wind*10)/10,temperatureRisk:Math.round(temperature*10)/10,
  weightedRisk:Math.round((rainfall*.65+wind*.15+temperature*.20)*10)/10,
  raw:{rainfallTotalMm:Math.round(hours.reduce((s,x)=>s+x.rain,0)*10)/10,peakWindMs:Math.round(Math.max(...hours.map(x=>x.gust??x.wind))*10)/10,temperatureMinC:Math.min(...hours.map(x=>x.temp)),temperatureMaxC:Math.max(...hours.map(x=>x.temp))}};
}
/** Provisional median consensus. Requires at least two complete, comparable providers; does not infer calibrated cancellation probability. */
export function scoreMultiProviderGolfWindow(providerWindows,{minimumProviders=2}={}){
 const names=["openMeteo","visualCrossing","foreca"];
 const sources=Object.fromEntries(names.map(name=>[name,summarizeSource(providerWindows?.[name]?.status==="available"?providerWindows[name].sourceHours:providerWindows?.[name]?.sourceHours??[])]));
 const valid=Object.entries(sources).filter(([,x])=>x.status==="scored");
 if(valid.length<minimumProviders)return {status:"insufficient-provider-coverage",availableProviders:valid.map(([name])=>name),providerCount:valid.length,requiredProviders:minimumProviders,sources,consensus:null};
 const median=key=>{const a=valid.map(([,x])=>x[key]).sort((a,b)=>a-b);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
 const values=valid.map(([,x])=>x.weightedRisk);
 return {status:"scored",model:"multi-provider-weighted-risk-v1",calibration:"provisional-not-hindcast-validated",
  providerCount:valid.length,providers:valid.map(([name])=>name),
  rainfallRisk:Math.round(median("rainfallRisk")*10)/10,windRisk:Math.round(median("windRisk")*10)/10,temperatureRisk:Math.round(median("temperatureRisk")*10)/10,
  weightedRisk:Math.round((median("rainfallRisk")*.65+median("windRisk")*.15+median("temperatureRisk")*.20)*10)/10,
  providerSpread:Math.round((Math.max(...values)-Math.min(...values))*10)/10,
  weights:{rainfall:.65,wind:.15,temperature:.20},sources};
}
