import {buildProviderConsistencyReport} from "./lib/provider-consistency.mjs";
import {buildRawFieldDiagnostics} from "./lib/raw-field-diagnostics.mjs";
import {buildOutdoorThermalScreening} from "./lib/outdoor-thermal-screening.mjs";
import fs from "node:fs/promises";
import {OKINAWA_COURSES} from "../assets/js/okinawa-courses.js";
import {fetchIndependentProviderForecasts} from "./lib/provider-fetchers.mjs";

const GENERATED_AT = new Date().toISOString();
const OUT = "artifacts/okinawa-live-weather";
const REQUIRED_HOURS = Array.from({length:13},(_,i)=>String(i+6).padStart(2,"0")+":00");
const finite = value => typeof value === "number" && Number.isFinite(value) ? value : null;

async function getJson(url, provider) {
  const response = await fetch(url, {headers:{"user-agent":"Asia-Golf-90-Day-Planner-live-validation/1.0"}});
  if (!response.ok) throw new Error(provider+" HTTP "+response.status);
  return response.json();
}

async function fetchOpenMeteo(course) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude:String(course.latitude), longitude:String(course.longitude),
    timezone:course.timezone, forecast_days:"7",
    temperature_unit:"celsius", wind_speed_unit:"ms", precipitation_unit:"mm",
    hourly:[
      "temperature_2m","apparent_temperature","relative_humidity_2m",
      "precipitation_probability","precipitation","wind_speed_10m",
      "wind_gusts_10m","wind_direction_10m","weather_code",
      "shortwave_radiation","uv_index"
    ].join(",")
  }).toString();
  const payload = await getJson(url,"Open-Meteo");
  if (!Array.isArray(payload.hourly?.time) || !payload.hourly.time.length) {
    throw new Error("Open-Meteo response has no hourly timeline");
  }
  const hourly = payload.hourly.time.map((time,i)=>({
    time,
    temperatureC:finite(payload.hourly.temperature_2m?.[i]),
    feelsLikeC:finite(payload.hourly.apparent_temperature?.[i]),
    relativeHumidityPct:finite(payload.hourly.relative_humidity_2m?.[i]),
    precipitationProbabilityPct:finite(payload.hourly.precipitation_probability?.[i]),
    precipitationMm:finite(payload.hourly.precipitation?.[i]),
    precipitationAccumulationPeriodHours:1,
    windSpeedMs:finite(payload.hourly.wind_speed_10m?.[i]),
    windGustMs:finite(payload.hourly.wind_gusts_10m?.[i]),
    windDirectionDeg:finite(payload.hourly.wind_direction_10m?.[i]),
    weatherCode:payload.hourly.weather_code?.[i] ?? null,
    shortwaveRadiationWm2:finite(payload.hourly.shortwave_radiation?.[i]),
    uvIndex:finite(payload.hourly.uv_index?.[i])
  }));
  return {
    provider:"Open-Meteo", product:"Forecast API", fetchedAt:GENERATED_AT,
    course:{id:course.id,name:course.name,latitude:course.latitude,longitude:course.longitude,timezone:course.timezone},
    timezone:payload.timezone, temporalResolution:"hourly",
    returnedCoordinates:{latitude:payload.latitude,longitude:payload.longitude},
    elevationM:finite(payload.elevation), hourly
  };
}

async function safeProvider(name, task) {
  try { return {status:"available",data:await task()}; }
  catch(error) { return {status:"unavailable",error:String(error?.message??error)}; }
}

await fs.mkdir(OUT,{recursive:true});
const courses = [];
for (const course of OKINAWA_COURSES) {
  const base = {
    id:course.id,name:course.name,area:course.area,city:course.city,
    latitude:course.latitude,longitude:course.longitude,timezone:"Asia/Tokyo",
    coordinateStatus:course.coordinateStatus,
    coordinateSource:course.coordinateSource??null,
    coordinateSourceUrl:course.coordinateSourceUrl??null
  };
  if (!Number.isFinite(course.latitude) || !Number.isFinite(course.longitude)) {
    courses.push({...base,collectionStatus:"skipped-coordinate-pending",providers:{
      openMeteo:{status:"skipped",reason:"Course GPS is pending; no city or proxy coordinate substitution."},
      visualCrossing:{status:"skipped",reason:"Course GPS is pending; no city or proxy coordinate substitution."},
      foreca:{status:"skipped",reason:"Course GPS is pending; no city or proxy coordinate substitution."}
    }});
    continue;
  }
  const courseInput = {...base,countryCode:"JP"};
  const [openMeteo,independent] = await Promise.all([
    safeProvider("Open-Meteo",()=>fetchOpenMeteo(courseInput)),
    fetchIndependentProviderForecasts(courseInput,{
      visualCrossingApiKey:process.env.VISUAL_CROSSING_API_KEY,
      forecaApiKey:process.env.FORECA_API_KEY,
      includeRawDiagnostics:true
    }).catch(error=>({course:courseInput,providers:{
      visualCrossing:{status:"unavailable",error:String(error?.message??error)},
      foreca:{status:"unavailable",error:String(error?.message??error)}
    }}))
  ]);
  const providers = {
    openMeteo,
    visualCrossing:independent.providers.visualCrossing,
    foreca:independent.providers.foreca,
    jmaMsm:{status:"not-configured",reason:"No verified operational MSM point-data retrieval adapter is configured. JMA GSM or JMA Seamless will not be substituted."}
  };
  const rows = Object.values(providers).filter(x=>x.status==="available");
  const hourCoverage = {};
  for (const provider of ["openMeteo","visualCrossing","foreca"]) {
    const data=providers[provider].data;
    const hours = Array.isArray(data?.hourly)
      ? data.hourly
      : Array.isArray(data?.days)
        ? data.days.flatMap(day => Array.isArray(day.hours) ? day.hours : [])
        : Array.isArray(data?.hourly?.forecast)
          ? data.hourly.forecast
          : Array.isArray(data?.forecast)
            ? data.forecast
            : [];
    const times=new Set(hours.map(h=>(h.time??"").slice(11,16)));
    hourCoverage[provider]={
      returnedRows:hours.length,
      requiredLocalHours:REQUIRED_HOURS.length,
      requiredHourLabelsPresent:REQUIRED_HOURS.filter(t=>times.has(t)).length
    };
  }
  courses.push({...base,collectionStatus:rows.length?"collected":"no-provider-data",providers,hourCoverage});
}
const report = {
  schemaVersion:"1.0.0",generatedAt:GENERATED_AT,timezone:"Asia/Tokyo",
  requestedWindow:{display:"06:00–18:00",teeTime:"10:00",playability:"10:00–16:00"},
  courseCount:OKINAWA_COURSES.length,
  providerPolicy:"independent-no-fallback; missing values remain null; no city proxy substitution",
  summary:{},
  courses,
  limitations:[
    "This is a live API connectivity and coverage smoke test, not forecast-accuracy verification.",
    "Four named sources are tracked: Open-Meteo, Visual Crossing, Foreca and JMA MSM. JMA MSM remains not configured until a verified MSM data adapter is available.",
    "PGM Golf Resort Okinawa is skipped because its course-point GPS remains pending.",
    "Four provisional course coordinates are used only for prototype connectivity checks, not operational trip ranking.",
    "Provider forecast issue times and native model metadata are retained only where returned by the existing normalizers; compare forecast values only after confirming timestamp and accumulation semantics.",
    "Visual Crossing and Foreca require repository Actions secrets VISUAL_CROSSING_API_KEY and FORECA_API_KEY."
  ]
};
for (const provider of ["openMeteo","visualCrossing","foreca","jmaMsm"]) {
  report.summary[provider] = {
    available:courses.filter(c=>c.providers?.[provider]?.status==="available").length,
    unavailable:courses.filter(c=>c.providers?.[provider]?.status==="unavailable").length,
    skipped:courses.filter(c=>c.providers?.[provider]?.status==="skipped").length,
    notConfigured:courses.filter(c=>c.providers?.[provider]?.status==="not-configured").length
  };
}
report.consistencyAnalysis = buildProviderConsistencyReport(courses.filter(c=>c.collectionStatus==="collected"), {
  startHour:10,
  endHour:16
});
report.outdoorThermalScreening = buildOutdoorThermalScreening(courses.filter(c=>c.collectionStatus==="collected"), {
  startHour:6,
  endHour:18
});
await fs.writeFile(OUT+"/outdoor-thermal-screening.json",JSON.stringify(report.outdoorThermalScreening,null,2));
const thermalLines = [
  "# Outdoor thermal screening",
  "",
  "Timezone: Asia/Tokyo",
  "Window: 06:00–18:00",
  "",
  "Humidex is derived independently from each provider's temperature and relative humidity. It is not WBGT, UTCI, a medical assessment or a validated golf-specific index.",
  "",
  "| Course | Provider | Hours | Humidex samples | Maximum Humidex | Peak category |",
  "|---|---|---:|---:|---:|---|",
  ...report.outdoorThermalScreening.courses.flatMap(course =>
    ["openMeteo","visualCrossing","foreca"].map(provider => {
      const d=course.providers[provider];
      return "| "+course.courseName+" | "+provider+" | "+(d.sampleCount??0)+" | "+(d.humidexAvailableCount??0)+" | "+(d.maxHumidexC??"—")+" | "+(d.peakCategory??"—")+" |";
    })
  ),
  "",
  "## Exposure context",
  "",
  "Per-hour JSON retains wind speed, gust, and Open-Meteo shortwave solar radiation and UV index where available. These are shown separately and are not combined into an unvalidated composite score.",
  "",
  "Humidex categories follow Environment and Climate Change Canada: 20–29 little discomfort; 30–39 some discomfort; 40–45 great discomfort/avoid exertion; 46+ dangerous/heat stroke possible."
];
await fs.writeFile(OUT+"/outdoor-thermal-screening.md",thermalLines.join("\n"));
report.rawFieldDiagnostics = buildRawFieldDiagnostics(courses.filter(c=>c.collectionStatus==="collected"));
await fs.writeFile(OUT+"/raw-field-diagnostics.json",JSON.stringify(report.rawFieldDiagnostics,null,2));
const rawDiagnosticLines = [
  "# Raw provider field diagnostics",
  "",
  "Only selected raw fields are retained; credentials and complete provider payloads are excluded.",
  "",
  ...report.rawFieldDiagnostics.courses.flatMap(course => [
    "## "+course.courseName+" ("+course.coordinateStatus+")",
    "",
    "| Provider | Samples | Valid temp/feels pairs | Raw equal count | Equal % | Missing feels-like | Mean feels-like − temp °C | Normalization preserved |",
    "|---|---:|---:|---:|---:|---:|---:|---|",
    ...["visualCrossing","foreca"].map(provider => {
      const d=course[provider];
      return "| "+provider+" | "+(d.rawSampleCount??0)+" | "+(d.validTemperatureFeelsLikePairs??0)+" | "+(d.rawFeelsLikeEqualToTemperatureCount??0)+" | "+(d.rawFeelsLikeEqualToTemperaturePct??"—")+" | "+(d.rawFeelsLikeMissingCount??"—")+" | "+(d.rawFeelsLikeMinusTemperatureMeanC??"—")+" | "+(d.normalizationPreservedAllFeelsLikeValues===true?"yes":d.normalizationPreservedAllFeelsLikeValues===false?"no":"—")+" |";
    }),
    ""
  ]),
  "## Interpretation",
  "",
  "- Raw values equal to air temperature are reported as received; this alone does not establish an API defect.",
  "- The preservation check compares raw feels-like values against the normalized output.",
  "- Humidity and wind fields are included per sample in the JSON for contextual review.",
  "- Pairwise forecast differences are not accuracy scores; observations are required for accuracy."
];
await fs.writeFile(OUT+"/raw-field-diagnostics.md",rawDiagnosticLines.join("\\n"));
await fs.writeFile(OUT+"/consistency-report.json",JSON.stringify(report.consistencyAnalysis,null,2));
const consistencyLines = [
  "# Okinawa provider consistency analysis",
  "",
  "Timezone: Asia/Tokyo",
  "Window: 10:00–16:00 inclusive",
  "",
  "This report measures provider disagreement, not forecast accuracy. Accuracy requires observations.",
  "",
  ...report.consistencyAnalysis.courses.flatMap(course => [
    "## "+course.courseName+" ("+course.coordinateStatus+")",
    "",
    "| Date | Shared hours | OM–VC feels-like MAE | OM–Foreca feels-like MAE | VC–Foreca feels-like MAE |",
    "|---|---:|---:|---:|---:|",
    ...course.days.map(day => {
      const p=day.pairwise;
      return "| "+day.date+" | "+day.matchedCommonHours+" | "+(p.openMeteo__visualCrossing.feelsLikeC.meanAbsoluteDifference??"—")+" | "+(p.openMeteo__foreca.feelsLikeC.meanAbsoluteDifference??"—")+" | "+(p.visualCrossing__foreca.feelsLikeC.meanAbsoluteDifference??"—")+" |";
    }),
    "",
    "| Provider | Feels-like samples | Equal to air temp | Mean feels-like minus air temp (°C) |",
    "|---|---:|---:|---:|",
    ...["openMeteo","visualCrossing","foreca"].map(provider => {
      const values=course.days.map(day=>day.providers[provider].feelsLikeVsAirTemperature);
      const n=values.reduce((s,x)=>s+x.sampleCount,0);
      const eq=values.reduce((s,x)=>s+x.equalCount,0);
      const weighted=values.filter(x=>x.meanDeltaC!==null).reduce((s,x)=>s+x.meanDeltaC*x.sampleCount,0);
      return "| "+provider+" | "+n+" | "+eq+" | "+(n?Number((weighted/n).toFixed(2)):"—")+" |";
    }),
    ""
  ]),
  "## Interpretation",
  "",
  "- Apparent/feels-like values are provider-defined; equality with air temperature is not automatically an error.",
  "- Pairwise differences measure provider disagreement, not forecast accuracy.",
  "- Foreca timestamps retain their +09:00 offset; comparison uses the same Japan local wall-clock hour."
];
await fs.writeFile(OUT+"/consistency-report.md",consistencyLines.join("\n"));
await fs.writeFile(OUT+"/coverage-report.json",JSON.stringify(report,null,2));
const lines=[
"# Okinawa six-course live weather coverage",
"",
"Generated: "+GENERATED_AT+" (UTC)",
"Timezone: Asia/Tokyo",
"",
"| Course | GPS status | Open-Meteo | Visual Crossing | Foreca | JMA MSM |",
"|---|---|---|---|---|---|",
...courses.map(c=>"| "+c.name+" | "+c.coordinateStatus+" | "+(c.providers?.openMeteo?.status??"—")+" | "+(c.providers?.visualCrossing?.status??"—")+" | "+(c.providers?.foreca?.status??"—")+" | "+(c.providers?.jmaMsm?.status??"—")+" |"),
"",
"## Provider coverage",
"",
"| Provider | Available courses | Unavailable | Skipped | Not configured |",
"|---|---:|---:|---:|---:|",
...Object.entries(report.summary).map(([k,v])=>"| "+k+" | "+v.available+" | "+v.unavailable+" | "+v.skipped+" | "+v.notConfigured+" |"),
"",
"## Limitations",...report.limitations.map(x=>"- "+x),
"",
"Raw provider credentials are never written to artifacts."
];
await fs.writeFile(OUT+"/coverage-report.md",lines.join("\n"));
console.log(lines.join("\n"));
if(!courses.some(c=>c.providers?.openMeteo?.status==="available")) process.exitCode=1;
