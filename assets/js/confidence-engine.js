/**
 * Forecast confidence classification, deliberately separate from weather risk.
 * No numeric probability of correctness is emitted. Until Okinawa hindcasts are
 * validated, the system never labels any horizon "high confidence".
 */
const DAY=86400000;
function leadDays(validDate,referenceDate){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(validDate)||!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate))return null;
 return Math.round((Date.parse(validDate+"T00:00:00Z")-Date.parse(referenceDate+"T00:00:00Z"))/DAY);
}
export function classifyForecastConfidence({
 validDate,referenceDate,dataAvailable=true,completeness=1,
 temporalResolution="daily",ensembleSpreadAvailable=false,hindcastValidated=false
}){
 const lead=leadDays(validDate,referenceDate);
 if(lead===null||lead<0||!Number.isFinite(completeness)||completeness<0||completeness>1)
  return {level:"unknown",label:"無法判定",leadDays:lead,reason:"日期或資料完整度無效"};
 if(!dataAvailable||completeness===0)
  return {level:"very-low",label:"極低",leadDays:lead,reason:"缺少有效預報資料"};
 if(completeness<0.8)
  return {level:"very-low",label:"極低",leadDays:lead,reason:"資料欄位不完整"};
 let level,label,reason;
 if(lead<=16){
  level="medium";label="中等（未校準）";
  reason="短期逐日／逐時預報；尚未完成沖繩歷史回測，因此不標示高可信度";
 }else if(lead<=46){
  level="low";label="低";
  reason="EC46 週尺度展望；時間解析度較粗，非逐日預報";
 }else if(lead<=90){
  level="very-low";label="極低";
  reason="SEAS5 月尺度季節展望；僅能判讀區域季節趨勢";
 }else{
  level="unknown";label="範圍外";reason="超出本系統90天規劃範圍";
 }
 if(!ensembleSpreadAvailable)reason+="；目前未取得／未呈現集合離散度";
 if(!hindcastValidated)reason+="；尚未完成歷史回測校準";
 // Hindcast validation is a prerequisite for any future high-confidence label.
 return {level,label,leadDays:lead,reason,temporalResolution,ensembleSpreadAvailable,hindcastValidated};
}
export function summarizeWindowConfidence(days){
 if(!Array.isArray(days)||days.length===0)return {level:"unknown",label:"無法判定",reason:"沒有候選日期"};
 const ranks={"high":4,"medium":3,"low":2,"very-low":1,"unknown":0};
 const assessed=days.map(x=>x?.level??"unknown");
 const weakest=assessed.reduce((a,b)=>ranks[a]<=ranks[b]?a:b);
 const level=assessed.every(x=>x==="medium")?"medium":weakest;
 const labels={medium:"中等（未校準）",low:"低", "very-low":"極低",unknown:"無法判定",high:"高"};
 return {level,label:labels[level]??"無法判定",dailyLevels:assessed,reason:"整趟行程採最弱打球日的可信度，不以平均值掩蓋較低可信度日期"};
}
