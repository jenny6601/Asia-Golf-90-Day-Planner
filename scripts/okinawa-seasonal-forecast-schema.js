export const REQUIRED_SEASONAL_REGIONS=["north","central","south"];
export function validateSeasonalSnapshot(snapshot){
 const errors=[];
 if(snapshot?.archiveType!=="okinawa-ecmwf-seasonal-snapshot")errors.push("invalid archiveType");
 if(!Array.isArray(snapshot?.points)||snapshot.points.length!==3)errors.push("expected exactly three regional points");
 for(const id of REQUIRED_SEASONAL_REGIONS){
  const point=snapshot?.points?.find(x=>x.point?.id===id);
  if(!point){errors.push("missing region "+id);continue;}
  if(!point.weekly?.time?.length)errors.push(id+" missing weekly time");
  if(!point.weeklyUnits||typeof point.weeklyUnits.precipitation_mean!=="string")errors.push(id+" missing weekly precipitation_mean unit metadata");
  if(!point.weeklyUnits||typeof point.weeklyUnits.precipitation_anomaly!=="string")errors.push(id+" missing weekly precipitation_anomaly unit metadata");
  if(!point.monthlyUnits||typeof point.monthlyUnits.precipitation_mean!=="string")errors.push(id+" missing monthly precipitation_mean unit metadata");
  if(!point.monthlyUnits||typeof point.monthlyUnits.precipitation_anomaly!=="string")errors.push(id+" missing monthly precipitation_anomaly unit metadata");
  if(!point.weekly?.precipitation_efi?.length)errors.push(id+" missing weekly precipitation_efi");
  if(!point.weekly?.precipitation_mean?.length)errors.push(id+" missing weekly precipitation_mean");
  if(!point.monthly?.time?.length)errors.push(id+" missing monthly time");
  if(!point.monthly?.precipitation_mean?.length)errors.push(id+" missing monthly precipitation_mean");
  if(!point.monthly?.precipitation_anomaly?.length)errors.push(id+" missing monthly precipitation_anomaly");
 }
 return {valid:errors.length===0,errors};
}
