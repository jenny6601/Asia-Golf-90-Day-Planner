const toRad=x=>x*Math.PI/180;
export function haversineKm(aLat,aLon,bLat,bLon){
 if([aLat,aLon,bLat,bLon].some(x=>typeof x!=="number"||!Number.isFinite(x)))return null;
 const dLat=toRad(bLat-aLat),dLon=toRad(bLon-aLon);
 const h=Math.sin(dLat/2)**2+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
/**
 * Compare requested course point with the provider's returned forecast grid point.
 * This is a grid-snap diagnostic, NOT proof that the course GPS is inside the course.
 */
export function auditForecastPoint(course,payload){
 const distanceKm=haversineKm(course.latitude,course.longitude,payload.latitude,payload.longitude);
 return {
  requested:{latitude:course.latitude,longitude:course.longitude},
  providerGrid:{latitude:payload.latitude,longitude:payload.longitude},
  gridOffsetKm:distanceKm===null?null:Math.round(distanceKm*100)/100,
  elevationM:typeof payload.elevation==="number"?payload.elevation:null,
  timezone:payload.timezone??null,
  coordinateStatus:course.coordinateStatus??"unknown",
  source:course.coordinateSource??"未記錄",
  sourceUrl:course.coordinateSourceUrl??null,
  warning:"API 回傳座標是預報網格點，不是球場界線或球道 GPS 驗證。"
 };
}
