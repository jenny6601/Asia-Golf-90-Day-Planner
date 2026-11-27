/**
 * Verification metrics for archived daily rain forecasts.
 * The reference event is ERA5 reanalysis precipitation >= 1 mm/day.
 * Brier score is valid for the archived precipitation probability field;
 * precipitation amount is evaluated separately with MAE.
 */
const finite = value => typeof value === "number" && Number.isFinite(value);
const BUCKETS = Object.freeze([
  {id:"1-3",label:"1–3 days",min:1,max:3},
  {id:"4-7",label:"4–7 days",min:4,max:7},
  {id:"8-16",label:"8–16 days",min:8,max:16}
]);
function metrics(rows){
  const probabilityRows=rows.filter(x=>finite(x.probability)&&x.probability>=0&&x.probability<=100&&finite(x.observedRainMm)&&x.observedRainMm>=0);
  const amountRows=rows.filter(x=>finite(x.forecastRainMm)&&x.forecastRainMm>=0&&finite(x.observedRainMm)&&x.observedRainMm>=0);
  const brier=probabilityRows.length?probabilityRows.reduce((sum,x)=>{
    const forecast=x.probability/100,observed=x.observedRainMm>=1?1:0;
    return sum+(forecast-observed)**2;
  },0)/probabilityRows.length:null;
  const mae=amountRows.length?amountRows.reduce((sum,x)=>sum+Math.abs(x.forecastRainMm-x.observedRainMm),0)/amountRows.length:null;
  const wetRows=probabilityRows.filter(x=>x.observedRainMm>=1);
  const dryRows=probabilityRows.filter(x=>x.observedRainMm<1);
  return {
    probabilitySampleCount:probabilityRows.length,
    amountSampleCount:amountRows.length,
    wetDayCount:wetRows.length,
    dryDayCount:dryRows.length,
    brierScore:brier===null?null:Number(brier.toFixed(4)),
    rainfallAmountMaeMm:mae===null?null:Number(mae.toFixed(2))
  };
}
export function scoreForecastSamples(samples=[]){
  if(!Array.isArray(samples))throw new TypeError("samples must be an array");
  for(const row of samples){
    if(!Number.isInteger(row.leadDays)||row.leadDays<1||row.leadDays>16)throw new TypeError("leadDays must be 1..16");
  }
  return {
    reference:"Open-Meteo ERA5 reanalysis daily precipitation; wet day threshold >=1.0 mm",
    totalArchivedForecastRows:samples.length,
    overall:metrics(samples),
    byLeadBucket:BUCKETS.map(bucket=>({
      id:bucket.id,label:bucket.label,
      ...metrics(samples.filter(x=>x.leadDays>=bucket.min&&x.leadDays<=bucket.max))
    })),
    interpretation:[
      "Brier score evaluates archived precipitation probability against an ERA5 wet/dry reference; lower is better.",
      "Rainfall amount MAE is reported separately in mm/day and is not a probability metric.",
      "ERA5 is a reanalysis reference, not an independent rain-gauge observation.",
      "Small samples are descriptive only; do not claim forecast skill until each lead bucket has adequate sample size."
    ]
  };
}
