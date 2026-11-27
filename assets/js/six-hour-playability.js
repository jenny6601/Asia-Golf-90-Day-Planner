import {scoreGolfRainWindow} from "./rain-risk.js";
import {scoreGolfSuitabilityWindow} from "./suitability-engine.js";
import {scorePwaStylePlayability} from "./pwa-playability.js";

const REQUIRED_FIELDS=["precipitation_probability","precipitation","temperature_2m","apparent_temperature","wind_speed_10m","wind_gusts_10m","weather_code"];
const finite=x=>typeof x==="number"&&Number.isFinite(x);

export function evaluateSixHourPlayability(hourly,date,teeHour,durationHours=6){
 if(!hourly||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)||!Number.isInteger(teeHour)||teeHour<0||teeHour>23||!Number.isInteger(durationHours)||durationHours<1||durationHours>12)throw new TypeError("Invalid hourly data, date, teeHour or durationHours");
 const indexes=[];
 for(let h=0;h<durationHours;h++){const target=date+"T"+String(teeHour+h).padStart(2,"0")+":00";const i=(hourly.time||[]).indexOf(target);if(i<0)return {status:"insufficient-data",reason:"missing-hour",missingHour:target};indexes.push(i);}
 const missingFields=REQUIRED_FIELDS.filter(field=>indexes.some(i=>!finite(hourly[field]?.[i])));
 if(missingFields.length)return {status:"insufficient-data",reason:"missing-required-values",missingFields};
 const rain=scoreGolfRainWindow(hourly,date,teeHour,durationHours);
 const environment=scoreGolfSuitabilityWindow(hourly,date,teeHour,durationHours);
 const playability=scorePwaStylePlayability(hourly,date,teeHour,durationHours);
 if(rain.status!=="scored"||environment.status!=="scored"||playability.status!=="scored")return {status:"insufficient-data",reason:"sub-engine-incomplete",rain,environment,playability};
 const values=field=>indexes.map(i=>hourly[field][i]);
 const rainfall=values("precipitation"),probability=values("precipitation_probability"),temperature=values("temperature_2m"),feels=values("apparent_temperature"),wind=values("wind_speed_10m"),gust=values("wind_gusts_10m"),codes=values("weather_code");
 return {status:"scored",date,teeHour,durationHours,windowStart:hourly.time[indexes[0]],windowEnd:hourly.time[indexes.at(-1)],sampleCount:indexes.length,
  inputs:{rainfallTotalMm:Number(rainfall.reduce((a,b)=>a+b,0).toFixed(2)),peakHourlyRainMm:Math.max(...rainfall),averageRainProbability:Number((probability.reduce((a,b)=>a+b,0)/probability.length).toFixed(1)),maximumRainProbability:Math.max(...probability),temperatureMinC:Math.min(...temperature),temperatureMaxC:Math.max(...temperature),feelsLikeMinC:Math.min(...feels),feelsLikeMaxC:Math.max(...feels),averageWindMs:Number((wind.reduce((a,b)=>a+b,0)/wind.length).toFixed(2)),peakWindMs:Math.max(...wind),peakGustMs:Math.max(...gust),thunderstormSignal:codes.some(x=>[95,96,99].includes(x))},
  rain,environment,playability,calibration:"transparent-threshold-prototypes-not-hindcast-calibrated"};
}

export const SIX_HOUR_REQUIRED_FIELDS=Object.freeze([...REQUIRED_FIELDS]);