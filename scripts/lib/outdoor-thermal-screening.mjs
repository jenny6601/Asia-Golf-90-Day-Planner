const finite = value => typeof value === "number" && Number.isFinite(value);
const round = value => finite(value) ? Number(value.toFixed(2)) : null;

// Magnus approximation for dew point, followed by the Environment Canada
// humidex vapour-pressure equation. Inputs are Celsius and RH percent.
export function calculateHumidexC(temperatureC, relativeHumidityPct) {
  if (!finite(temperatureC) || !finite(relativeHumidityPct) ||
      relativeHumidityPct <= 0 || relativeHumidityPct > 100) return null;
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(relativeHumidityPct / 100) + (a * temperatureC) / (b + temperatureC);
  const dewPointC = (b * gamma) / (a - gamma);
  const vapourPressureHpa = 6.11 * Math.exp(5417.753 * (1 / 273.16 - 1 / (dewPointC + 273.15)));
  return round(temperatureC + (5 / 9) * (vapourPressureHpa - 10));
}

export function humidexCategory(value) {
  if (!finite(value)) return "unavailable";
  if (value > 45) return "dangerous";
  if (value >= 40) return "great-discomfort";
  if (value >= 30) return "some-discomfort";
  if (value >= 20) return "little-discomfort";
  return "below-published-humidex-discomfort-ranges";
}

function rowsFor(provider, data) {
  if (!data) return [];
  if (provider === "openMeteo") return Array.isArray(data.hourly) ? data.hourly : [];
  if (provider === "visualCrossing") return Array.isArray(data.days) ? data.days.flatMap(d => d.hours ?? []) : [];
  if (provider === "foreca") return Array.isArray(data.hourly?.forecast) ? data.hourly.forecast : [];
  return [];
}

export function buildOutdoorThermalScreening(courses, {startHour=6,endHour=18}={}) {
  return {
    timezone:"Asia/Tokyo",
    method:"Humidex derived independently from each provider's air temperature and relative humidity; wind, gust and Open-Meteo solar radiation are displayed as separate exposure context. This is not WBGT, UTCI, a medical assessment or a golf-specific validated index.",
    humidexCategories:{
      "20-29":"little discomfort",
      "30-39":"some discomfort",
      "40-45":"great discomfort; avoid exertion",
      ">45":"dangerous; heat stroke possible"
    },
    courses:courses.map(course=>{
      const providers={};
      for(const provider of ["openMeteo","visualCrossing","foreca"]){
        const source=course.providers?.[provider];
        if(source?.status!=="available"){providers[provider]={status:source?.status??"unavailable",hours:[]};continue;}
        const hours=rowsFor(provider,source.data).filter(row=>{
          const hour=Number(String(row.time??"").slice(11,13));
          return hour>=startHour&&hour<=endHour;
        }).map(row=>{
          const humidex=calculateHumidexC(row.temperatureC,row.relativeHumidityPct);
          return {
            time:row.time,
            temperatureC:row.temperatureC??null,
            relativeHumidityPct:row.relativeHumidityPct??null,
            derivedHumidexC:humidex,
            humidexCategory:humidexCategory(humidex),
            windSpeedMs:row.windSpeedMs??null,
            windGustMs:row.windGustMs??null,
            solarRadiationWm2:provider==="openMeteo"?(row.shortwaveRadiationWm2??null):null,
            uvIndex:provider==="openMeteo"?(row.uvIndex??null):null
          };
        });
        const valid=hours.filter(x=>finite(x.derivedHumidexC));
        providers[provider]={
          status:"available",
          sampleCount:hours.length,
          humidexAvailableCount:valid.length,
          maxHumidexC:valid.length?Math.max(...valid.map(x=>x.derivedHumidexC)):null,
          peakCategory:valid.length?valid.reduce((best,x)=>x.derivedHumidexC>best.value?{value:x.derivedHumidexC,category:x.humidexCategory}:best,{value:-Infinity,category:"unavailable"}).category:"unavailable",
          hours
        };
      }
      return {courseId:course.id,courseName:course.name,coordinateStatus:course.coordinateStatus,providers};
    })
  };
}
