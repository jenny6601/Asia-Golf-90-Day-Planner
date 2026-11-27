export function haversineKm(a,b){
 const rad=x=>x*Math.PI/180,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude),lat1=rad(a.latitude),lat2=rad(b.latitude);
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function stationWeights(stations){
 const raw=stations.map(s=>({ ...s, rawWeight:1/Math.max(s.distanceKm,1)**2 }));
 const total=raw.reduce((n,s)=>n+s.rawWeight,0);
 return raw.map(({rawWeight,...s})=>({...s,weight:total?rawWeight/total:0,representativeness:s.distanceKm>15?"WEAK_OVER_15KM":"DISTANCE_PROXY"}));
}
export function sampleEligibility(metric,variable){
 const n=metric?.n??0,days=metric?.uniqueValidDays??0,wet=metric?.wetObserved??0;
 return n>=200&&days>=30&&(variable!=="precipitation"||wet>=10);
}
export function summarizeStationMetric(metric,variable){
 if(!metric)return null;
 return {n:metric.n??0,uniqueValidDays:metric.uniqueValidDays??0,mae:metric.mae??null,bias:metric.bias??null,rmse:metric.rmse??null,...(variable==="precipitation"?{wetObserved:metric.wetObserved??0,pod:metric.pod??null,far:metric.far??null,csi:metric.csi??null,rainThresholdMmPerHour:1}:{})};
}
