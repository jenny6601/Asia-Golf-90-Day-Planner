const REGIONS=["north","central","south"];
const SCALES=["weekly","monthly"];
const FIELDS={weekly:["precipitation_mean","precipitation_anomaly","precipitation_efi"],monthly:["precipitation_mean","precipitation_anomaly"]};
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const sign=v=>!finite(v)?"UNKNOWN":v>0?"POSITIVE":v<0?"NEGATIVE":"ZERO";
function recordsFromSnapshot(snapshot){
 const out=[];
 for(const region of REGIONS){
  const p=snapshot?.points?.find(x=>x.point?.id===region);if(!p)continue;
  for(const scale of SCALES){
   const block=p[scale];if(!Array.isArray(block?.time))continue;
   for(let i=0;i<block.time.length;i++){
    const values={};for(const field of FIELDS[scale])values[field]=Array.isArray(block[field])?block[field][i]??null:null;
    out.push({region,scale,targetTimeLabel:block.time[i],model:snapshot.model??null,provider:snapshot.provider??"Open-Meteo Seasonal Forecast API",retrievedAt:snapshot.retrievedAt??null,archiveDate:snapshot.archiveDate??null,units:scale==="weekly"?p.weeklyUnits??{}:p.monthlyUnits??{},values});
   }
  }
 }
 return out;
}
function comparable(a,b){
 return a.region===b.region&&a.scale===b.scale&&a.targetTimeLabel===b.targetTimeLabel&&a.model===b.model&&JSON.stringify(a.units)===JSON.stringify(b.units);
}
export function buildSeasonalRevisionHistory(snapshots){
 const ordered=[...snapshots].filter(x=>x?.archiveType==="okinawa-ecmwf-seasonal-snapshot").sort((a,b)=>String(a.retrievedAt??a.archiveDate).localeCompare(String(b.retrievedAt??b.archiveDate)));
 const byKey=new Map(),comparisons=[];
 for(const snapshot of ordered){
  const current=recordsFromSnapshot(snapshot);
  for(const now of current){
   const key=[now.region,now.scale,now.targetTimeLabel,now.model].join("|");
   const previous=byKey.get(key);
   if(previous&&comparable(previous,now)){
    const changes={};
    for(const field of FIELDS[now.scale]){
     const before=previous.values[field],after=now.values[field];
     changes[field]={previous:finite(before)?before:null,current:finite(after)?after:null,delta:finite(before)&&finite(after)?after-before:null,directionChanged:field==="precipitation_anomaly"&&finite(before)&&finite(after)?sign(before)!==sign(after):null};
    }
    comparisons.push({region:now.region,scale:now.scale,targetTimeLabel:now.targetTimeLabel,model:now.model,previousSnapshot:{archiveDate:previous.archiveDate,retrievedAt:previous.retrievedAt},currentSnapshot:{archiveDate:now.archiveDate,retrievedAt:now.retrievedAt},units:now.units,changes,revisionStatus:Object.values(changes).some(x=>x.delta!==null)?"COMPARABLE_REVISION":"NO_COMPARABLE_NUMERIC_CHANGE",periodBoundaryVerified:false,issueTimeKnown:false,forecastSkillClaimed:false});
   }
   byKey.set(key,now);
  }
 }
 const latestByRegionScale={};
 for(const region of REGIONS)for(const scale of SCALES){const rows=comparisons.filter(x=>x.region===region&&x.scale===scale);latestByRegionScale[region+"_"+scale]={comparisonCount:rows.length,latestComparison:rows.at(-1)??null};}
 return {schemaVersion:1,archiveType:"okinawa-seasonal-revision-history",snapshotCount:ordered.length,firstSnapshot:ordered[0]?.retrievedAt??null,lastSnapshot:ordered.at(-1)?.retrievedAt??null,comparisonCount:comparisons.length,latestByRegionScale,comparisons,gate:{sameModelOnly:true,sameRegionScaleAndExactTimeLabelOnly:true,unitMetadataMustMatch:true,periodBoundaryVerified:false,issueTimeKnown:false,forecastSkillClaimed:false},notes:["Revisions compare the same exact provider time label; no weekly/monthly period boundary is inferred.","A revision is a change between archived API snapshots, not necessarily a new ECMWF model initialization.","Missing or non-numeric values are null and never treated as zero.","Only same-model records with identical unit metadata are compared.","No accuracy, skill, daily rainfall, or probability is inferred from revisions."]};
}
