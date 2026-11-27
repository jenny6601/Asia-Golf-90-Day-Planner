import fs from "node:fs/promises";
import {buildMonthlyClimateBaseline} from "./okinawa-era5-climate-baseline.js";
const points=[
 {id:"north",label:"北部",place:"名護市",latitude:26.5916,longitude:127.9774},
 {id:"central",label:"中部",place:"沖繩市",latitude:26.3344,longitude:127.8056},
 {id:"south",label:"南部",place:"那霸市",latitude:26.2123,longitude:127.6792}
];
const now=new Date(),endYear=now.getUTCFullYear()-1,startYear=endYear-9;
async function collect(point){
 const params=new URLSearchParams({latitude:String(point.latitude),longitude:String(point.longitude),start_date:startYear+"-01-01",end_date:endYear+"-12-31",daily:"precipitation_sum",timezone:"Asia/Tokyo",precipitation_unit:"mm",models:"era5"});
 const response=await fetch("https://archive-api.open-meteo.com/v1/archive?"+params,{headers:{"User-Agent":"Asia-Golf-90-Day-Planner-ERA5-Baseline/1.0"},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(point.id+" ERA5 HTTP "+response.status);
 const payload=await response.json();
 if(!payload.daily?.time?.length)throw new Error(point.id+" missing ERA5 daily samples");
 const baseline=buildMonthlyClimateBaseline(payload.daily,{startYear,endYear,minimumDailyCoverage:.9,rainDayThresholdMm:1});
 if(baseline.months.some(x=>x.sampleYears<7))throw new Error(point.id+" has fewer than 7 valid year-month samples in at least one calendar month");
 return {point,provider:"Open-Meteo Historical Weather API",model:"ERA5 reanalysis",grid:{latitude:payload.latitude,longitude:payload.longitude,elevation:payload.elevation},timezone:payload.timezone,baseline};
}
const results=await Promise.allSettled(points.map(collect)),failed=results.map((x,i)=>x.status==="rejected"?{region:points[i].id,error:String(x.reason)}:null).filter(Boolean);
if(failed.length)throw new Error("ERA5 baseline quality gate failed: "+JSON.stringify(failed));
const retrievedAt=new Date().toISOString(),report={schemaVersion:1,archiveType:"okinawa-era5-monthly-climate-baseline",retrievedAt,startYear,endYear,baselineYears:10,regions:results.map(x=>x.value),method:{dailyCoverageMinimum:.9,rainDayThresholdMm:1,monthlyStatistic:"Each year-month total is retained only when at least 90% of calendar days have valid precipitation; missing days are never imputed as zero.",climateInterpretation:"Recent 10-complete-year ERA5 model-reanalysis reference, not JMA station climatology and not an ECMWF seasonal forecast hindcast."},limitations:["ERA5 is a reanalysis product and provides a consistent retrospective estimate; it is not a direct station observation.","This ten-year reference is a recent climate baseline, not a 30-year WMO climate normal.","This archive does not validate EC46/SEAS5 forecast skill or reconstruct historical seasonal forecast vintages.","Regional city grid points are proxies and do not represent course microclimates."]};
const dir="data/okinawa/era5-climate-baseline";await fs.mkdir(dir,{recursive:true});
const date=retrievedAt.slice(0,10);await fs.writeFile(dir+"/"+date+".json",JSON.stringify(report,null,2));
const lines=["# Okinawa ERA5 Monthly Climate Baseline","", "Retrieved: "+retrievedAt,"Reference years: "+startYear+"–"+endYear,"","## Regional monthly precipitation baseline",""];
for(const region of report.regions){lines.push("### "+region.point.label+" ("+region.point.place+")","","| Month | Valid years | Mean mm | P10 mm | Median mm | P90 mm | Mean rain days |","|---:|---:|---:|---:|---:|---:|---:|");for(const m of region.baseline.months)lines.push("| "+m.month+" | "+m.sampleYears+" | "+(m.monthlyPrecipitationMeanMm??"—")+" | "+(m.monthlyPrecipitationP10Mm??"—")+" | "+(m.monthlyPrecipitationP50Mm??"—")+" | "+(m.monthlyPrecipitationP90Mm??"—")+" | "+(m.rainDaysMean??"—")+" |");lines.push("");}
lines.push("## Method and limitations","",report.method.monthlyStatistic,...report.limitations.map(x=>"- "+x));
await fs.writeFile(dir+"/"+date+".md",lines.join("\n"));
console.log("ERA5 baseline archived: "+date+"; "+report.regions.length+" regions; "+startYear+"-"+endYear);
