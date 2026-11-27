const REGIONS=["north","central","south"];
const isoDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T00:00:00Z"));
const monthIndex=value=>Number(value.slice(0,4))*12+Number(value.slice(5,7));
function inspectSequence(values,scale){
 const valid=values.filter(isoDate),duplicates=valid.filter((v,i)=>valid.indexOf(v)!==i);
 const gaps=[];
 for(let i=1;i<valid.length;i++){
  const delta=scale==="weekly"?(Date.parse(valid[i]+"T00:00:00Z")-Date.parse(valid[i-1]+"T00:00:00Z"))/86400000:monthIndex(valid[i])-monthIndex(valid[i-1]);
  const expected=scale==="weekly"?7:1;
  if(delta!==expected)gaps.push({from:valid[i-1],to:valid[i],observedStep:delta,expectedStep:expected});
 }
 return {labels:values.length,validDateLabels:valid.length,invalidLabels:values.length-valid.length,duplicateLabels:[...new Set(duplicates)],sequenceGaps:gaps,firstLabel:valid[0]??null,lastLabel:valid.at(-1)??null,labelSpacingConsistent:valid.length>1&&gaps.length===0&&duplicates.length===0};
}
function alignedArrays(container,keys){
 const lengths=keys.map(key=>({key,length:Array.isArray(container?.[key])?container[key].length:null}));
 const known=lengths.map(x=>x.length).filter(Number.isInteger);
 return {lengths,allPresent:known.length===keys.length,aligned:known.length===keys.length&&new Set(known).size<=1};
}
export function auditSeasonalForecastSnapshot(snapshot){
 const regions=[];
 for(const id of REGIONS){
  const p=snapshot?.points?.find(x=>x.point?.id===id);
  if(!p){regions.push({region:id,present:false});continue;}
  const weeklySequence=inspectSequence(p.weekly?.time||[],"weekly");
  const monthlySequence=inspectSequence(p.monthly?.time||[],"monthly");
  const weeklyArrays=alignedArrays(p.weekly,["time","precipitation_mean","precipitation_anomaly","precipitation_efi"]);
  const monthlyArrays=alignedArrays(p.monthly,["time","precipitation_mean","precipitation_anomaly"]);
  regions.push({region:id,present:true,weekly:{sequence:weeklySequence,arrays:weeklyArrays,units:{precipitationMean:p.weeklyUnits?.precipitation_mean??null,precipitationAnomaly:p.weeklyUnits?.precipitation_anomaly??null},timestampSemantics:"UNVERIFIED_LABEL_ONLY"},monthly:{sequence:monthlySequence,arrays:monthlyArrays,units:{precipitationMean:p.monthlyUnits?.precipitation_mean??null,precipitationAnomaly:p.monthlyUnits?.precipitation_anomaly??null},timestampSemantics:"UNVERIFIED_LABEL_ONLY"}});
 }
 const errors=[];
 for(const r of regions){if(!r.present){errors.push(r.region+" missing");continue;}for(const scale of ["weekly","monthly"]){const x=r[scale];if(x.sequence.invalidLabels)errors.push(r.region+" "+scale+" has invalid date labels");if(x.sequence.duplicateLabels.length)errors.push(r.region+" "+scale+" has duplicate date labels");if(!x.arrays.aligned)errors.push(r.region+" "+scale+" arrays missing or length-misaligned");if(!x.units.precipitationMean||!x.units.precipitationAnomaly)errors.push(r.region+" "+scale+" missing precipitation units");}}
 return {archiveDate:snapshot?.archiveDate??null,retrievedAt:snapshot?.retrievedAt??null,model:snapshot?.model??null,regionCount:regions.filter(x=>x.present).length,regions,validForStructuralReview:errors.length===0,errors,issueTimeKnown:false,periodBoundariesVerified:false,scoringAllowed:false,notes:["This audit validates date-label syntax, label cadence, duplicate labels, array alignment, and units only.","A seven-day spacing between weekly labels does not establish whether each label denotes week start, week end, or another aggregation anchor.","Calendar-month spacing between monthly labels does not independently prove provider aggregation boundaries.","Snapshot retrieval time is not model initialization or issue time.","No forecast skill, error, probability, or daily rainfall is calculated."]};
}
export function summarizeSeasonalSnapshotAudits(audits){
 const rows=audits.flatMap(a=>a.regions||[]);
 return {schemaVersion:1,archiveType:"okinawa-seasonal-time-semantics-audit",snapshotsAudited:audits.length,structurallyValidSnapshots:audits.filter(x=>x.validForStructuralReview).length,regionsAudited:rows.length,regionsWithWeeklySequence:rows.filter(x=>x.weekly?.sequence?.labelSpacingConsistent).length,regionsWithMonthlySequence:rows.filter(x=>x.monthly?.sequence?.labelSpacingConsistent).length,weeklyArrayAligned:rows.filter(x=>x.weekly?.arrays?.aligned).length,monthlyArrayAligned:rows.filter(x=>x.monthly?.arrays?.aligned).length,issueTimeKnownRecords:0,periodBoundariesVerifiedRecords:0,scoringAllowed:false,audits,globalGate:"STRUCTURE_CAN_BE_CHECKED_BUT_PROVIDER_PERIOD_BOUNDARIES_AND_MODEL_INITIALIZATION_TIME_REMAIN_UNVERIFIED"};
}
