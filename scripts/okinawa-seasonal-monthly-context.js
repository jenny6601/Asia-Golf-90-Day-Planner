export function classifyModelPrecipitationAnomaly(value){
 if(typeof value!=="number"||!Number.isFinite(value))return {code:"UNKNOWN",label:"資料不足",direction:null};
 if(value>0)return {code:"WETTER_THAN_MODEL_CLIMATE",label:"高於模式氣候基準",direction:"wetter"};
 if(value<0)return {code:"DRIER_THAN_MODEL_CLIMATE",label:"低於模式氣候基準",direction:"drier"};
 return {code:"NEAR_MODEL_CLIMATE",label:"接近模式氣候基準",direction:"neutral"};
}
export function summarizeEra5MonthlyContext(monthlyBaseline,month){
 const row=monthlyBaseline?.months?.find(x=>x.month===month);
 if(!row||!Number.isFinite(row.monthlyPrecipitationP50Mm)||!Number.isFinite(row.monthlyPrecipitationP10Mm)||!Number.isFinite(row.monthlyPrecipitationP90Mm)){
  return {code:"INSUFFICIENT_ERA5_BASELINE",label:"ERA5 歷史樣本不足",sampleYears:row?.sampleYears??0};
 }
 return {code:"ERA5_REFERENCE_ONLY",label:"ERA5 歷史分布參考",sampleYears:row.sampleYears,p10Mm:row.monthlyPrecipitationP10Mm,medianMm:row.monthlyPrecipitationP50Mm,p90Mm:row.monthlyPrecipitationP90Mm,meanMm:row.monthlyPrecipitationMeanMm};
}
export function buildSeasonalMonthlyContext({region,forecastMonthly,era5Baseline}){
 const records=[];
 for(let i=0;i<(forecastMonthly?.time||[]).length;i++){
  const date=forecastMonthly.time[i],month=Number(String(date).slice(5,7)),anomaly=forecastMonthly.precipitation_anomaly?.[i];
  records.push({region,targetMonth:String(date).slice(0,7),modelAnomalyMm:Number.isFinite(anomaly)?anomaly:null,modelAnomalyUnit:forecastMonthly.precipitation_anomaly_unit??null,modelSignal:classifyModelPrecipitationAnomaly(anomaly),era5Context:summarizeEra5MonthlyContext(era5Baseline,month),scalesCombined:false,calibrated:false});
 }
 return records;
}
