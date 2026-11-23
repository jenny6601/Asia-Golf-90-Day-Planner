import fs from "node:fs/promises";
import { regressionMetrics, categoricalRainMetrics, groupByLeadTime } from "../assets/js/hindcast-metrics.js";

const zones = [
  { id:"north", label:"北部", latitude:26.5916, longitude:127.9774 },
  { id:"central", label:"中部", latitude:26.3344, longitude:127.8056 },
  { id:"south", label:"南部", latitude:26.2123, longitude:127.6792 }
];
// Four short, seasonally distributed windows; intentionally a pilot sample, not a climatological study.
const windows = [
  { start:"2025-01-15", end:"2025-01-21", season:"winter" },
  { start:"2025-04-15", end:"2025-04-21", season:"spring" },
  { start:"2025-07-15", end:"2025-07-21", season:"summer" },
  { start:"2025-10-15", end:"2025-10-21", season:"autumn" }
];
const leads = [1,3,7];
const headers = { "User-Agent":"Asia-Golf-90-Day-Planner-hindcast-collector/1.0" };
const cacheDir = "artifacts/hindcast-raw";
await fs.mkdir(cacheDir,{recursive:true});
const samples = [];
const coverage = [];
async function getJson(url) {
  const response = await fetch(url,{headers});
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error("HTTP "+response.status+" "+(body.reason ?? body.error ?? ""));
  return body;
}
function mapHourly(hourly, fields) {
  const map = new Map();
  const times = hourly?.time ?? [];
  for(let i=0;i<times.length;i++) {
    const row = {};
    for(const field of fields) row[field] = hourly?.[field]?.[i] ?? null;
    map.set(times[i],row);
  }
  return map;
}
for(const zone of zones) {
  for(const win of windows) {
    const forecastVars = [];
    for(const lead of leads) {
      for(const v of ["temperature_2m","apparent_temperature","precipitation","wind_speed_10m"]) {
        forecastVars.push(v+"_previous_day"+lead);
      }
    }
    const fp = new URLSearchParams({
      latitude:String(zone.latitude),longitude:String(zone.longitude),
      start_date:win.start,end_date:win.end,
      hourly:forecastVars.join(","),models:"ecmwf_ifs025",
      timezone:"Asia/Tokyo",wind_speed_unit:"ms",precipitation_unit:"mm",temperature_unit:"celsius"
    });
    const forecastUrl="https://previous-runs-api.open-meteo.com/v1/forecast?"+fp;
    const ap = new URLSearchParams({
      latitude:String(zone.latitude),longitude:String(zone.longitude),
      start_date:win.start,end_date:win.end,
      hourly:"temperature_2m,precipitation,wind_speed_10m",
      models:"era5",timezone:"Asia/Tokyo",wind_speed_unit:"ms",
      precipitation_unit:"mm",temperature_unit:"celsius"
    });
    const archiveUrl="https://archive-api.open-meteo.com/v1/archive?"+ap;
    let forecast, verification;
    try {
      [forecast,verification]=await Promise.all([getJson(forecastUrl),getJson(archiveUrl)]);
    } catch(error) {
      coverage.push({zone:zone.id,window:win,ok:false,error:String(error)});
      continue;
    }
    await fs.writeFile(cacheDir+"/"+zone.id+"-"+win.start+"-previous-runs.json",JSON.stringify(forecast));
    await fs.writeFile(cacheDir+"/"+zone.id+"-"+win.start+"-era5.json",JSON.stringify(verification));
    const vMap=mapHourly(verification.hourly,["temperature_2m","precipitation","wind_speed_10m"]);
    const times=forecast.hourly?.time ?? [];
    let matched=0;
    for(let i=0;i<times.length;i++) {
      const validTime=times[i];
      const obs=vMap.get(validTime);
      if(!obs) continue;
      for(const lead of leads) {
        const f={};
        for(const v of ["temperature_2m","apparent_temperature","precipitation","wind_speed_10m"]) {
          f[v]=forecast.hourly?.[v+"_previous_day"+lead]?.[i] ?? null;
        }
        // Keep only paired fields; a row may contain partial variable coverage.
        const anyPair=["temperature_2m","precipitation","wind_speed_10m"].some(k=>Number.isFinite(f[k])&&Number.isFinite(obs[k]));
        if(!anyPair) continue;
        const issueDate=new Date(new Date(validTime+"+09:00").getTime()-lead*24*3600000);
        const sample={
          zoneId:zone.id,zoneLabel:zone.label,latitude:zone.latitude,longitude:zone.longitude,
          coordinateStatus:"regional-proxy-not-course-GPS",season:win.season,
          validTime,timezone:"Asia/Tokyo",issuedAt:issueDate.toISOString(),
          leadHours:lead*24,model:"ecmwf_ifs025",forecastDataset:"Open-Meteo Previous Runs",
          verificationDataset:"Open-Meteo ERA5 reanalysis proxy",
          forecast:f,verification:obs,
          rainEventThresholdMmPerHour:0.1,
          forecastRainEvent:Number.isFinite(f.precipitation)?f.precipitation>=0.1:null,
          observedRainEvent:Number.isFinite(obs.precipitation)?obs.precipitation>=0.1:null
        };
        samples.push(sample); matched++;
      }
    }
    coverage.push({
      zone:zone.id,window:win,ok:true,forecastHours:times.length,
      verificationHours:verification.hourly?.time?.length ?? 0,
      matchedSamples:matched,
      forecastGrid:{latitude:forecast.latitude,longitude:forecast.longitude},
      verificationGrid:{latitude:verification.latitude,longitude:verification.longitude},
      forecastModel:forecast.model ?? "ecmwf_ifs025",
      verificationModel:verification.generationtime_ms!==undefined?"ERA5":"ERA5"
    });
  }
}
const metrics=[];
const keys=["temperature_2m","precipitation","wind_speed_10m"];
for(const lead of leads) {
  for(const zone of zones) {
    const subset=samples.filter(s=>s.leadHours===lead*24&&s.zoneId===zone.id);
    const row={leadDays:lead,zone:zone.id,zoneLabel:zone.label,nSamples:subset.length,variables:{}};
    for(const key of keys) {
      const fKey="forecast."+key, oKey="verification."+key;
      const pairs=subset.filter(s=>Number.isFinite(s.forecast[key])&&Number.isFinite(s.verification[key]));
      const metrics=regressionMetrics(pairs.map(s=>({f:s.forecast[key],o:s.verification[key]})),"f","o");
      row.variables[key]=metrics;
    }
    const rainPairs=subset.filter(s=>typeof s.forecastRainEvent==="boolean"&&typeof s.observedRainEvent==="boolean");
    row.rainEvent=categoricalRainMetrics(rainPairs.map(s=>({f:s.forecastRainEvent,o:s.observedRainEvent})),"f","o");
    metrics.push(row);
  }
}
const report={
  generatedAt:new Date().toISOString(),
  purpose:"Pilot forecast-versus-ERA5 reanalysis comparison; ERA5 is a verification proxy, not direct station truth.",
  model:"ECMWF IFS 0.25 previous runs",
  verification:"ERA5 hourly reanalysis",
  scope:{zones,windows,leadDays:leads},
  rainEventThresholdMmPerHour:0.1,
  sampleCount:samples.length,coverage,metrics,
  limitations:[
    "Regional proxy coordinates are not golf-course surveyed GPS points.",
    "ERA5 reanalysis is a reference proxy, not direct rain-gauge or on-course observation truth.",
    "This small four-window pilot is not a seasonal climatology or a robust model calibration dataset.",
    "No archived precipitation probability is evaluated; no Brier score is calculated.",
    "Gust fields are omitted because the tested Previous Runs gust variables were all-null.",
    "Apparent temperature is retained in raw paired samples only if returned; no ERA5 apparent-temperature verification is inferred."
  ],
  samples
};
await fs.writeFile("artifacts/okinawa-hindcast-pilot.json",JSON.stringify(report,null,2));
const md=[
"# Okinawa Hindcast Pilot Dataset",
"",
"Generated: "+report.generatedAt,
"",
"**Samples:** "+samples.length+" forecast-valid-time-lead rows",
"",
"Verification reference: ERA5 reanalysis (proxy, not station truth).",
"",
"| Lead | Zone | N | Temp MAE / Bias | Rain MAE / Bias | Wind MAE / Bias | Rain POD / FAR / CSI |",
"|---:|---|---:|---|---|---|---|",
...metrics.map(r=>{
 const t=r.variables.temperature_2m,p=r.variables.precipitation,w=r.variables.wind_speed_10m,x=r.rainEvent;
 const fmt=m=>m.n?m.mae.toFixed(2)+" / "+m.bias.toFixed(2):"n/a";
 return "| "+r.leadDays+"d | "+r.zoneLabel+" | "+r.nSamples+" | "+fmt(t)+" | "+fmt(p)+" | "+fmt(w)+" | "+[x.pod,x.far,x.csi].map(v=>v===null?"n/a":v.toFixed(2)).join(" / ")+" |";
}),
"",
"## Coverage",
"",
"| Zone | Window | Forecast hours | ERA5 hours | Matched rows | Status |",
"|---|---|---:|---:|---:|---|",
...coverage.map(c=>"| "+c.zone+" | "+(c.window?.start??"")+"–"+(c.window?.end??"")+" | "+(c.forecastHours??0)+" | "+(c.verificationHours??0)+" | "+(c.matchedSamples??0)+" | "+(c.ok?"ok":c.error)+" |"),
"",
"## Limitations",
...report.limitations.map(x=>"- "+x),
"",
"Rain-event threshold: hourly precipitation >= 0.1 mm. Metrics are pilot diagnostics only and must not be used to recalibrate production thresholds."
].join("\n");
await fs.writeFile("artifacts/okinawa-hindcast-pilot.md",md);
console.log(md);
if(samples.length===0) process.exitCode=1;
