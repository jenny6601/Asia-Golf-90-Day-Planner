/**
 * D17-D90 historical-only daily climate outlook.
 * Uses 1991-2020 ERA5 31-day rolling calendar normals; no seasonal-model blend.
 * Outputs are regional climate estimates, not deterministic daily forecasts.
 */
const finite=value=>typeof value==="number"&&Number.isFinite(value);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=value=>finite(value)?Math.round(value*10)/10:null;
const addDays=(date,count)=>{
 const value=new Date(date+"T12:00:00Z");
 value.setUTCDate(value.getUTCDate()+count);
 return value.toISOString().slice(0,10);
};
function climateDescription(rainFrequency,rainMean,rainP90){
 if(!finite(rainFrequency)||!finite(rainMean))return "歷史氣候資料不足";
 if(rainFrequency>=55&&rainMean>=3)return "歷史同期偏濕，雨日及雨量均較多";
 if(rainFrequency>=55)return "歷史同期雨日偏多";
 if(rainFrequency>=30&&rainMean>=2)return "歷史同期偶有較明顯降雨";
 if(rainFrequency<30&&finite(rainP90)&&rainP90>=10)return "歷史同期偏乾，但仍有偶發大雨";
 if(rainFrequency<30)return "歷史同期相對乾燥";
 return "歷史同期降雨接近常態";
}
function playability(rainFrequency,rainMean){
 if(!finite(rainFrequency)||!finite(rainMean))return "資料不足";
 if(rainFrequency>=55||rainMean>=5)return "偏濕／較不利趨勢";
 if(rainFrequency>=30||rainMean>=2)return "需留意降雨";
 return "相對有利趨勢";
}
function confidence(sampleYears,hasRain,hasTemperature,hasFeelsLike){
 const score=Math.min(80,Math.round((sampleYears/30)*55+(hasRain?10:0)+(hasTemperature?10:0)+(hasFeelsLike?5:0)));
 const label=sampleYears>=24&&hasRain&&hasTemperature?"中低":
  sampleYears>=15?"偏低":sampleYears>=8?"低":"資料不足";
 return {score,label};
}

/**
 * historicalDays are produced by fetchCourseHistoricalWeekNormals().
 * seasonalPayload is retained in the signature for compatibility but is ignored.
 */
export function buildDailyClimateOutlook(seasonalPayload,historicalDays=[],today,days=90){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(today||""))throw new TypeError("today must be YYYY-MM-DD");
 if(!Number.isInteger(days)||days<17||days>120)throw new TypeError("days must be between 17 and 120");
 const history=new Map((historicalDays||[]).map(row=>[row.date,row]));
 const output=[];
 for(let day=17;day<=Math.min(days,90);day++){
  const date=addDays(today,day-1),h=history.get(date)||{};
  const samples=finite(h.sampleYears)?h.sampleYears:0;
  const rainSamples=finite(h.rainSampleYears)?h.rainSampleYears:0;
  const temperatureSamples=finite(h.temperatureSampleYears)?h.temperatureSampleYears:0;
  const feelsLikeSamples=finite(h.feelsLikeSampleYears)?h.feelsLikeSampleYears:0;
  const high=finite(h.highMean)?h.highMean:null,low=finite(h.lowMean)?h.lowMean:null;
  const feelsLikeMin=finite(h.feelsLikeMinMeanC)?h.feelsLikeMinMeanC:null;
  const feelsLikeMax=finite(h.feelsLikeMaxMeanC)?h.feelsLikeMaxMeanC:null;
  const rainMean=finite(h.rainMean)?h.rainMean:null;
  const rainFrequency=finite(h.rainFrequency)?h.rainFrequency:null;
  const rainP90=finite(h.rainP90)?h.rainP90:null;
  const wind=finite(h.windMean)?h.windMean:null;
  const humidity=finite(h.humidityMean)?h.humidityMean:null;
  const weather=climateDescription(rainFrequency,rainMean,rainP90);
  const quality=confidence(Math.min(rainSamples,temperatureSamples),finite(rainFrequency)&&finite(rainMean),finite(high)&&finite(low),finite(feelsLikeMin)&&finite(feelsLikeMax));
  const hasHistory=finite(rainMean)||finite(high)||finite(low)||finite(feelsLikeMin)||finite(feelsLikeMax);
  output.push({
   date,lead:day,band:day<=46?"D17–D46":day<=60?"D47–D60":"D61–D90",
   highEstimate:round(high),lowEstimate:round(low),
   feelsLikeMinEstimateC:round(feelsLikeMin),feelsLikeMaxEstimateC:round(feelsLikeMax),
   feelsLikeMinP10C:round(h.feelsLikeMinP10C),feelsLikeMinP90C:round(h.feelsLikeMinP90C),
   feelsLikeMaxP10C:round(h.feelsLikeMaxP10C),feelsLikeMaxP90C:round(h.feelsLikeMaxP90C),
   rainEstimate:round(rainMean),rainChanceEstimate:round(rainFrequency),
   rainChanceLabel:"歷史同期雨日頻率（不是未來逐日降雨機率）",
   rainAmountBand:finite(rainMean)?rainMean>=3?"high":rainMean>=1?"medium":"low":"unknown",
   rainFrequencyBand:finite(rainFrequency)?rainFrequency>=55?"high":rainFrequency>=30?"medium":"low":"unknown",
   rainP90Estimate:round(rainP90),
   wetDayRainEstimate:finite(rainMean)&&finite(rainFrequency)&&rainFrequency>0?round(rainMean/(rainFrequency/100)):null,
   windMeanEstimate:round(wind),humidityMeanEstimate:round(humidity),
   weather,code:null,playability:playability(rainFrequency,rainMean),
   historical:{
    sampleYears:samples,rainSampleYears:rainSamples,temperatureSampleYears:temperatureSamples,
    feelsLikeSampleYears:feelsLikeSamples,rainFrequency,rainMean,rainP10:round(h.rainP10),rainP90,
    highMean:high,lowMean:low,humidityMean:humidity,windMean:wind,
    feelsLikeMinMeanC:feelsLikeMin,feelsLikeMaxMeanC:feelsLikeMax,
    windowDays:31,referencePeriod:"1991-2020"
   },
   seasonal:{disabled:true,evidenceCount:0,source:"not-used"},
   confidence:quality.label,confidenceScore:quality.score,
   confidenceNote:hasHistory?
    "僅依 ERA5 1991-2020 歷史同期 31 日統計估算；不是未來逐日預報。體感溫度由每日最低／最高溫、平均露點及平均風速推算，非同一時刻配對值。":
    "歷史樣本不足，未填補或虛構天氣數值。",
   sourceType:hasHistory?"historical-climate-estimate":"insufficient-data",
   sourceLabel:hasHistory?"ERA5 1991-2020 歷史同期統計":"歷史資料不足",
   fieldQuality:{
    temperature:finite(high)&&finite(low)?"historical-daily-min-max":"missing",
    feelsLike:finite(feelsLikeMin)&&finite(feelsLikeMax)?"derived-from-historical-daily-aggregates":"missing",
    rainfallFrequency:finite(rainFrequency)?"historical-wet-day-frequency":"missing",
    rainfallAmount:finite(rainMean)?"historical-daily-rainfall-mean":"missing",
    wind:finite(wind)?"historical-daily-mean":"missing"
   },
   seasonalEvidenceCount:0,historicalSampleYears:samples,
   historicalRainSampleYears:rainSamples,historicalTemperatureSampleYears:temperatureSamples,
   rainProbability:null
  });
 }
 return output;
}
