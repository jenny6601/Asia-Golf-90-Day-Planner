const REGIONS=["north","central","south"],SCALES=["weekly","monthly"];
const sign=v=>typeof v!=="number"||!Number.isFinite(v)?"UNKNOWN":v>0?"WETTER_THAN_MODEL_CLIMATE":v<0?"DRIER_THAN_MODEL_CLIMATE":"NEAR_ZERO_ANOMALY";
const fields=scale=>scale==="weekly"?["precipitation_anomaly","precipitation_efi"]:["precipitation_anomaly"];
function snapshotsOrdered(snapshots){return [...snapshots].filter(x=>x?.archiveType==="okinawa-ecmwf-seasonal-snapshot").sort((a,b)=>String(a.retrievedAt??a.archiveDate).localeCompare(String(b.retrievedAt??b.archiveDate)));}
function seriesFor(snapshots,region,scale,label,field){
 const series=[];
 for(const snapshot of snapshots){
  const p=snapshot.points?.find(x=>x.point?.id===region),block=p?.[scale],i=block?.time?.indexOf(label)??-1;
  if(i<0)continue;
  const value=Array.isArray(block[field])?block[field][i]:null;
  series.push({archiveDate:snapshot.archiveDate??null,retrievedAt:snapshot.retrievedAt??null,value:typeof value==="number"&&Number.isFinite(value)?value:null,direction:sign(value),units:(scale==="weekly"?p.weeklyUnits:p.monthlyUnits)?.[field]??null});
 }
 return series;
}
function summarizeSeries(series){
 const known=series.filter(x=>x.direction!=="UNKNOWN"),directions=[...new Set(known.map(x=>x.direction))];
 let directionChanges=0;
 for(let i=1;i<known.length;i++)if(known[i].direction!==known[i-1].direction)directionChanges++;
 const values=series.filter(x=>x.value!==null).map(x=>x.value);
 return {snapshotCount:series.length,validValueCount:known.length,directionChanges,uniqueDirections:directions,dominantDirection:directions.length===1?directions[0]:"MIXED_OR_UNKNOWN",stabilityStatus:known.length<3?"INSUFFICIENT_SNAPSHOTS":directions.length===1?"CONSISTENT_DIRECTION": "DIRECTION_CHANGED",directionConsistencyRatio:known.length?known.filter(x=>x.direction===directions.sort((a,b)=>known.filter(y=>y.direction===b).length-known.filter(y=>y.direction===a).length)[0]).length/known.length:null,minimumValue:values.length?Math.min(...values):null,maximumValue:values.length?Math.max(...values):null,range:values.length?Math.max(...values)-Math.min(...values):null,series};
}
export function buildSeasonalDirectionStability(snapshots){
 const ordered=snapshotsOrdered(snapshots),targets=new Map();
 for(const snapshot of ordered)for(const region of REGIONS)for(const scale of SCALES){
  const p=snapshot.points?.find(x=>x.point?.id===region),block=p?.[scale];
  for(const label of block?.time??[]){const key=region+"|"+scale+"|"+label;if(!targets.has(key))targets.set(key,{region,scale,label});}
 }
 const records=[];
 for(const target of targets.values())for(const field of fields(target.scale)){
  const series=seriesFor(ordered,target.region,target.scale,target.label,field);
  if(series.length)records.push({region:target.region,scale:target.scale,targetTimeLabel:target.label,field,units:series.find(x=>x.units)?.units??null,...summarizeSeries(series)});
 }
 const regionalAgreement=[];
 const keys=new Set(records.filter(x=>x.field==="precipitation_anomaly").map(x=>x.scale+"|"+x.targetTimeLabel));
 for(const key of keys){
  const [scale,label]=key.split("|");
  const latestSnapshot=[...ordered].reverse().find(snapshot=>REGIONS.some(region=>snapshot.points?.find(p=>p.point?.id===region)?.[scale]?.time?.includes(label)));
  const directions=REGIONS.map(region=>{
   const point=latestSnapshot?.points?.find(p=>p.point?.id===region),block=point?.[scale],index=block?.time?.indexOf(label)??-1;
   const value=index>=0&&Array.isArray(block.precipitation_anomaly)?block.precipitation_anomaly[index]:null;
   return {region,direction:sign(value)};
  }).filter(x=>x.direction!=="UNKNOWN");
  const dirs=[...new Set(directions.map(x=>x.direction))];
  regionalAgreement.push({scale,targetTimeLabel:label,snapshotDate:latestSnapshot?.archiveDate??null,regionCount:directions.length,directions,agreementStatus:directions.length<3?"INCOMPLETE_REGIONAL_COVERAGE":dirs.length===1?"THREE_REGION_DIRECTION_AGREEMENT":"REGIONS_DISAGREE_OR_UNKNOWN"});
 }
 return {schemaVersion:1,archiveType:"okinawa-seasonal-direction-stability",snapshotCount:ordered.length,firstSnapshot:ordered[0]?.retrievedAt??null,lastSnapshot:ordered.at(-1)?.retrievedAt??null,recordCount:records.length,records,regionalAgreement,gate:{minimumSnapshotsForStableClassification:3,anomalyDirectionUsesRawSignOnly:true,efiReportedSeparately:true,periodBoundaryVerified:false,issueTimeKnown:false,calibratedStabilityScore:false,forecastSkillClaimed:false},notes:["Direction stability is based on the sign of provider precipitation anomaly, not on an invented threshold.","EFI is shown as a separate numeric trend series and is not converted into a probability.","At least three valid snapshots are required before a direction can be called consistent or changed.","The consistency ratio is descriptive snapshot frequency, not forecast confidence or calibrated probability.","Regional agreement compares the latest archived direction for the same exact provider label; no aggregation period is inferred.","No daily rainfall, rain probability, accuracy, or forecast skill is calculated."]};
}
