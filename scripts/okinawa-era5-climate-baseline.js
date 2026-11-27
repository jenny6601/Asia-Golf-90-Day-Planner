export function buildMonthlyClimateBaseline(daily,{startYear,endYear,minimumDailyCoverage=.9,rainDayThresholdMm=1}={}){
 const errors=[];
 if(!Array.isArray(daily?.time)||!Array.isArray(daily?.precipitation_sum))errors.push("missing daily time/precipitation arrays");
 if(!Number.isInteger(startYear)||!Number.isInteger(endYear)||endYear<startYear)errors.push("invalid baseline year range");
 if(errors.length)throw new TypeError(errors.join("; "));
 const buckets=Array.from({length:12},(_,i)=>({month:i+1,validYearMonths:[],excludedYearMonths:[]}));
 const byYearMonth=new Map();
 for(let i=0;i<daily.time.length;i++){
  const date=daily.time[i],year=Number(date.slice(0,4)),month=Number(date.slice(5,7));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||year<startYear||year>endYear||month<1||month>12)continue;
  const key=year+"-"+String(month).padStart(2,"0");
  if(!byYearMonth.has(key))byYearMonth.set(key,{year,month,expectedDays:new Date(Date.UTC(year,month,0)).getUTCDate(),validDays:0,rainTotal:0,rainDays:0});
  const row=byYearMonth.get(key),value=daily.precipitation_sum[i];
  if(Number.isFinite(value)){row.validDays++;row.rainTotal+=value;if(value>=rainDayThresholdMm)row.rainDays++;}
 }
 for(const row of byYearMonth.values()){
  const bucket=buckets[row.month-1],coverage=row.validDays/row.expectedDays;
  if(coverage>=minimumDailyCoverage)bucket.validYearMonths.push({year:row.year,coverage:Number(coverage.toFixed(4)),monthlyPrecipitationMm:Number(row.rainTotal.toFixed(2)),rainDays:row.rainDays});
  else bucket.excludedYearMonths.push({year:row.year,coverage:Number(coverage.toFixed(4))});
 }
 const mean=values=>values.length?values.reduce((s,v)=>s+v,0)/values.length:null;
 const quantile=(values,q)=>{if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),p=(a.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return a[lo]+(a[hi]-a[lo])*(p-lo)};
 return {startYear,endYear,minimumDailyCoverage,rainDayThresholdMm,months:buckets.map(b=>{
  const totals=b.validYearMonths.map(x=>x.monthlyPrecipitationMm),days=b.validYearMonths.map(x=>x.rainDays);
  return {month:b.month,sampleYears:totals.length,excludedYears:b.excludedYearMonths,monthlyPrecipitationMeanMm:mean(totals),monthlyPrecipitationP10Mm:quantile(totals,.1),monthlyPrecipitationP50Mm:quantile(totals,.5),monthlyPrecipitationP90Mm:quantile(totals,.9),rainDaysMean:mean(days),rainDaysP50:quantile(days,.5),annualSamples:b.validYearMonths};
 })}
}
