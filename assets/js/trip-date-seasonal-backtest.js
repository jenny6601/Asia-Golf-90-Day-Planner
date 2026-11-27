const finite=value=>typeof value==="number"&&Number.isFinite(value);
const dayNumber=date=>Date.parse(date+"T00:00:00Z")/86400000;
const addDays=(date,n)=>new Date((dayNumber(date)+n)*86400000).toISOString().slice(0,10);
const monthStart=value=>String(value).slice(0,7)+"-01";
const monthEnd=value=>{
  const [year,month]=String(value).slice(0,7).split("-").map(Number);
  return new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
};
export function summarizeSeasonalArchive(snapshots=[],asOf){
  if(!Array.isArray(snapshots))throw new TypeError("snapshots must be an array");
  if(typeof asOf!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw new TypeError("asOf must be YYYY-MM-DD");
  const regions=["north","central","south"];
  const summary=Object.fromEntries(regions.map(region=>[region,{
    ec46:{archivedPeriods:0,maturedPeriods:0,unitVerifiedPeriods:0},
    seas5:{archivedPeriods:0,maturedPeriods:0,unitVerifiedPeriods:0}
  }]));
  for(const snapshot of snapshots){
    const issue=snapshot.localDate;
    if(typeof issue!=="string")continue;
    for(const region of regions){
      const seasonal=snapshot.seasonal?.[region];
      if(!seasonal)continue;
      const weekly=seasonal.weekly||{};
      for(let i=0;i<(weekly.time||[]).length;i++){
        const start=String(weekly.time[i]).slice(0,10);
        const value=weekly.precipitation_mean?.[i];
        if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!finite(value))continue;
        const bucket=summary[region].ec46;
        bucket.archivedPeriods++;
        if(start>issue&&addDays(start,6)<asOf){
          bucket.maturedPeriods++;
          if(weekly.precipitation_mean_units==="mm"||seasonal.weeklyUnits?.precipitation_mean==="mm")bucket.unitVerifiedPeriods++;
        }
      }
      const monthly=seasonal.monthly||{};
      for(let i=0;i<(monthly.time||[]).length;i++){
        const month=String(monthly.time[i]).slice(0,7);
        const value=monthly.precipitation_mean?.[i];
        if(!/^\d{4}-\d{2}$/.test(month)||!finite(value))continue;
        const bucket=summary[region].seas5;
        bucket.archivedPeriods++;
        if(monthStart(month)>issue&&monthEnd(month)<asOf){
          bucket.maturedPeriods++;
          if(seasonal.monthlyUnits?.precipitation_mean==="mm")bucket.unitVerifiedPeriods++;
        }
      }
    }
  }
  return {
    asOf,snapshotCount:snapshots.length,byRegion:summary,
    totals:Object.fromEntries(["ec46","seas5"].map(source=>[source,regions.reduce((acc,region)=>{
      for(const key of ["archivedPeriods","maturedPeriods","unitVerifiedPeriods"])acc[key]+=summary[region][source][key];
      return acc;
    },{archivedPeriods:0,maturedPeriods:0,unitVerifiedPeriods:0})])),
    readiness:"collecting",
    guidance:"Only fully completed valid periods are eligible. Do not fit source weights until each region/source has at least 30 matured, unit-verified periods and sufficient wet/dry outcome diversity."
  };
}
