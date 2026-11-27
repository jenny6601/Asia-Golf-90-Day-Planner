/** Out-of-sample 1-90 day rain-risk ranking verification. AUC is discrimination, not probability calibration. */
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const BUCKETS=[{id:"1-16",min:1,max:16},{id:"17-46",min:17,max:46},{id:"47-90",min:47,max:90}];
function auc(rows){
 const wet=rows.filter(x=>x.wet),dry=rows.filter(x=>!x.wet);
 if(!wet.length||!dry.length)return null;
 const sorted=[...rows].sort((a,b)=>a.score-b.score);let rankSum=0,i=0;
 while(i<sorted.length){let j=i+1;while(j<sorted.length&&sorted[j].score===sorted[i].score)j++;
  const rank=((i+1)+j)/2;for(let k=i;k<j;k++)if(sorted[k].wet)rankSum+=rank;i=j;}
 return (rankSum-wet.length*(wet.length+1)/2)/(wet.length*dry.length);
}
function summarize(rows){
 const valid=rows.filter(x=>finite(x.riskScore)&&x.riskScore>=0&&x.riskScore<=100&&finite(x.observedRainMm)&&x.observedRainMm>=0);
 const data=valid.map(x=>({score:x.riskScore,wet:x.observedRainMm>=1}));
 const wetDays=data.filter(x=>x.wet).length,dryDays=data.length-wetDays,a=auc(data);
 return {sampleCount:data.length,wetDays,dryDays,auc:a===null?null:Number(a.toFixed(4)),ready:data.length>=30&&wetDays>=5&&dryDays>=5};
}
export function scoreRiskRankingSamples(samples=[]){
 if(!Array.isArray(samples))throw new TypeError("samples must be an array");
 for(const x of samples){
  if(!Number.isInteger(x.leadDays)||x.leadDays<1||x.leadDays>90)throw new TypeError("leadDays must be 1..90");
  if(!["north","central","south"].includes(x.region))throw new TypeError("region must be north, central, or south");
  if(typeof x.source!=="string"||!x.source)throw new TypeError("source is required");
 }
 const groups={},sources=[...new Set(samples.map(x=>x.source))].sort();
 const put=(key,rows)=>groups[key]=summarize(rows);
 for(const source of sources){const sr=samples.filter(x=>x.source===source);put(source,sr);
  for(const region of ["north","central","south"]){const rr=sr.filter(x=>x.region===region);put(source+"."+region,rr);
   for(const b of BUCKETS)put(source+"."+region+"."+b.id,rr.filter(x=>x.leadDays>=b.min&&x.leadDays<=b.max));
  }
 }
 return {reference:"ERA5 daily precipitation >=1.0 mm/day",metric:"AUC; higher is better; riskScore is not a probability",minimumGate:{samples:30,wetDays:5,dryDays:5},groups};
}

function averageRanks(values) {
 const sorted=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);
 const ranks=Array(values.length);let i=0;
 while(i<sorted.length){let j=i+1;while(j<sorted.length&&sorted[j].value===sorted[i].value)j++;
  const rank=((i+1)+j)/2;for(let k=i;k<j;k++)ranks[sorted[k].index]=rank;i=j;}
 return ranks;
}
function spearman(rows) {
 if(rows.length<2)return null;
 const x=averageRanks(rows.map(r=>r.predictedScore)),y=averageRanks(rows.map(r=>r.observedGolfRainMm));
 const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
 let numerator=0,dx=0,dy=0;
 for(let i=0;i<x.length;i++){const a=x[i]-mx,b=y[i]-my;numerator+=a*b;dx+=a*a;dy+=b*b;}
 return dx===0||dy===0?null:numerator/Math.sqrt(dx*dy);
}
export function scoreTripWindowRankingSamples(samples=[]) {
 if(!Array.isArray(samples))throw new TypeError("samples must be an array");
 for(const x of samples){
  if(typeof x.model!=="string"||!x.model)throw new TypeError("model is required");
  if(!finite(x.predictedScore)||x.predictedScore<0||x.predictedScore>100)throw new TypeError("predictedScore must be 0..100");
  if(!finite(x.observedGolfRainMm)||x.observedGolfRainMm<0)throw new TypeError("observedGolfRainMm must be non-negative");
 }
 const models=[...new Set(samples.map(x=>x.model))].sort(),groups={};
 for(const model of models){
  const rows=samples.filter(x=>x.model===model),correlation=spearman(rows);
  groups[model]={sampleCount:rows.length,spearman:correlation===null?null:Number(correlation.toFixed(4)),
   ready:rows.length>=30&&correlation!==null};
 }
 return {reference:"Mean ERA5 precipitation across 3 golf days and 3 regional representative points (9 region-days)",metric:"Spearman correlation between predicted window risk score and observed golf-day rainfall; positive is better",minimumGate:{windows:30},groups};
}

const leadBucketId=lead=>lead<=16?"1-16":lead<=46?"17-46":"47-90";
function aucFor(rows){
 const data=rows.map(x=>({score:x.riskScore,wet:x.observedRainMm>=1}));
 return auc(data);
}
/** Paired AUC deltas use only identical issue-date/valid-date/region observations. */
export function compareCandidateRankingSamples(samples=[],baselineSource="composite-baseline"){
 if(!Array.isArray(samples))throw new TypeError("samples must be an array");
 const valid=samples.filter(x=>typeof x.source==="string"&&finite(x.leadDays)
  &&["north","central","south"].includes(x.region)&&typeof x.issueDate==="string"
  &&typeof x.targetDate==="string"&&finite(x.riskScore)&&x.riskScore>=0&&x.riskScore<=100
  &&finite(x.observedRainMm)&&x.observedRainMm>=0);
 const models=[...new Set(valid.map(x=>x.source).filter(x=>x!==baselineSource))].sort();
 const baseline=new Map(valid.filter(x=>x.source===baselineSource).map(x=>[x.issueDate+"|"+x.targetDate+"|"+x.region,x]));
 const groups={};
 for(const model of models){
  const candidate=new Map(valid.filter(x=>x.source===model).map(x=>[x.issueDate+"|"+x.targetDate+"|"+x.region,x]));
  const matched=[...baseline.entries()].flatMap(([key,b])=>{
   const c=candidate.get(key);
   return c&&c.observedRainMm===b.observedRainMm?[{baseline:b,candidate:c}]:[];
  });
  const scopes=[["overall",()=>true],...["north","central","south"].map(region=>[region,x=>x.region===region]),
   ...["1-16","17-46","47-90"].map(bucket=>[bucket,x=>leadBucketId(x.leadDays)===bucket])];
  for(const [scope,predicate] of scopes){
   const rows=matched.filter(pair=>predicate(pair.candidate));
   const bRows=rows.map(x=>x.baseline),cRows=rows.map(x=>x.candidate);
   const wet=rows.filter(x=>x.candidate.observedRainMm>=1).length,dry=rows.length-wet;
   const b=aucFor(bRows),c=aucFor(cRows);
   groups[model+"."+scope]={matchedSamples:rows.length,wetDays:wet,dryDays:dry,
    baselineAuc:b===null?null:Number(b.toFixed(4)),candidateAuc:c===null?null:Number(c.toFixed(4)),
    deltaAuc:b===null||c===null?null:Number((c-b).toFixed(4)),
    ready:rows.length>=30&&wet>=5&&dry>=5&&b!==null&&c!==null};
  }
 }
 return {baselineSource,method:"Paired AUC delta on identical issue date, valid date, region and ERA5 outcome; positive delta favors candidate.",minimumGate:{matchedSamples:30,wetDays:5,dryDays:5},groups};
}
/** Paired Spearman deltas compare candidates on exactly the same matured trip windows. */
export function compareTripWindowModels(samples=[],baselineModel="baseline"){
 if(!Array.isArray(samples))throw new TypeError("samples must be an array");
 const valid=samples.filter(x=>typeof x.model==="string"&&typeof x.issueDate==="string"
  &&typeof x.startDate==="string"&&typeof x.endDate==="string"&&finite(x.predictedScore)
  &&finite(x.observedGolfRainMm)&&x.observedGolfRainMm>=0);
 const baseline=new Map(valid.filter(x=>x.model===baselineModel).map(x=>[x.issueDate+"|"+x.startDate+"|"+x.endDate,x]));
 const groups={};
 for(const model of [...new Set(valid.map(x=>x.model).filter(x=>x!==baselineModel))].sort()){
  const candidate=new Map(valid.filter(x=>x.model===model).map(x=>[x.issueDate+"|"+x.startDate+"|"+x.endDate,x]));
  const pairs=[...baseline.entries()].flatMap(([key,b])=>{const c=candidate.get(key);
   return c&&c.observedGolfRainMm===b.observedGolfRainMm?[{b,c}]:[];});
  const b=spearman(pairs.map(x=>({predictedScore:x.b.predictedScore,observedGolfRainMm:x.b.observedGolfRainMm})));
  const c=spearman(pairs.map(x=>({predictedScore:x.c.predictedScore,observedGolfRainMm:x.c.observedGolfRainMm})));
  groups[model]={matchedWindows:pairs.length,baselineSpearman:b===null?null:Number(b.toFixed(4)),
   candidateSpearman:c===null?null:Number(c.toFixed(4)),deltaSpearman:b===null||c===null?null:Number((c-b).toFixed(4)),
   ready:pairs.length>=30&&b!==null&&c!==null};
 }
 return {baselineModel,method:"Paired Spearman delta on identical issue-date and five-day trip windows; positive delta favors candidate.",minimumGate:{matchedWindows:30},groups};
}
