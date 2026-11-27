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
