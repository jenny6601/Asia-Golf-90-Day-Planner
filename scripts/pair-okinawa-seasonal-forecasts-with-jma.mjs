import fs from "node:fs/promises";
const forecastDir="data/okinawa/seasonal-forecast-archive",observationDir="data/okinawa/jma-observation-archive",outputDir="data/okinawa/seasonal-observation-pairs";
const list=async dir=>(await fs.readdir(dir).catch(()=>[])).filter(x=>x.endsWith(".json")).sort();
const read=async(dir,file)=>JSON.parse(await fs.readFile(dir+"/"+file,"utf8"));
const addDays=(date,n)=>new Date(Date.parse(date+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
const monthDays=date=>new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),0)).getUTCDate();
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const stationsByRegion={
 north:["91107","91021","91066","91046"],
 central:["91121","91161","91166"],
 south:["91197","91236","91241"]
};
const [forecastFiles,observationFiles]=await Promise.all([list(forecastDir),list(observationDir)]);
const observations=new Map();
for(const file of observationFiles){
 const archive=await read(observationDir,file);
 for(const station of archive.stations||[])for(const row of station.rows||[]){
  const key=station.station.id+"|"+row.time;
  const old=observations.get(key);
  if(!old||archive.retrievedAt>old.archiveRetrievedAt)observations.set(key,{station:station.station,row,archiveRetrievedAt:archive.retrievedAt});
 }
}
const allRows=[...observations.values()];
const latestObservationDate=allRows.map(x=>x.row.time.slice(0,10)).sort().at(-1)||null;
function aggregateRegion(region,startDate,endDate){
 const stationResults=[];
 for(const stationId of stationsByRegion[region]){
  const rows=allRows.filter(x=>x.station.id===stationId&&x.row.time.slice(0,10)>=startDate&&x.row.time.slice(0,10)<=endDate);
  const expectedDays=(Date.parse(endDate+"T12:00:00Z")-Date.parse(startDate+"T12:00:00Z"))/86400000+1;
  const expectedHours=expectedDays*24;
  const valid=rows.filter(x=>x.row.precipitation1h?.usable&&finite(x.row.precipitation1h.value));
  const coverage=expectedHours?valid.length/expectedHours:0;
  stationResults.push({stationId,name:rows[0]?.station.name||stationId,area:rows[0]?.station.area||region,expectedHours,validHours:valid.length,coverage:Number(coverage.toFixed(4)),rainTotalMm:coverage>=0.9?valid.reduce((s,x)=>s+x.row.precipitation1h.value,0):null});
 }
 const eligible=stationResults.filter(x=>x.coverage>=0.9&&finite(x.rainTotalMm));
 return {region,startDate,endDate,stationCount:stationResults.length,eligibleStationCount:eligible.length,stations:stationResults,observedRegionalMeanTotalMm:eligible.length>=2?eligible.reduce((s,x)=>s+x.rainTotalMm,0)/eligible.length:null,complete:eligible.length>=2};
}
const pairs=[];
for(const file of forecastFiles){
 const archive=await read(forecastDir,file);
 if(archive.archiveType!=="okinawa-ecmwf-seasonal-snapshot"||!archive.retrievedAt)continue;
 for(const point of archive.points||[]){
  const region=point.point?.id;
  if(!stationsByRegion[region])continue;
  for(let i=0;i<(point.weekly?.time||[]).length;i++){
   const periodStart=point.weekly.time[i],periodEnd=addDays(periodStart,6);
   if(!latestObservationDate||periodEnd>latestObservationDate||periodStart<archive.archiveDate)continue;
   const actual=aggregateRegion(region,periodStart,periodEnd);
   pairs.push({archiveDate:archive.archiveDate,retrievedAt:archive.retrievedAt,model:archive.model,region,temporalScale:"weekly",periodStart,periodEnd,forecast:{precipitationMean:point.weekly.precipitation_mean?.[i]??null,precipitationMeanUnit:point.weeklyUnits?.precipitation_mean??null,precipitationAnomaly:point.weekly.precipitation_anomaly?.[i]??null,precipitationAnomalyUnit:point.weeklyUnits?.precipitation_anomaly??null,precipitationEfi:point.weekly.precipitation_efi?.[i]??null},observation:actual,status:actual.complete?"OBSERVATION_COVERAGE_COMPLETE_SEMANTICS_UNVERIFIED":"INCOMPLETE_OBSERVATION_COVERAGE",issueTimeKnown:false,periodBoundaryVerified:false});
  }
  for(let i=0;i<(point.monthly?.time||[]).length;i++){
   const periodStart=point.monthly.time[i].slice(0,7)+"-01",days=monthDays(periodStart),periodEnd=periodStart.slice(0,8)+String(days).padStart(2,"0");
   if(!latestObservationDate||periodEnd>latestObservationDate||periodStart<archive.archiveDate)continue;
   const actual=aggregateRegion(region,periodStart,periodEnd);
   pairs.push({archiveDate:archive.archiveDate,retrievedAt:archive.retrievedAt,model:archive.model,region,temporalScale:"monthly",periodStart,periodEnd,forecast:{precipitationMean:point.monthly.precipitation_mean?.[i]??null,precipitationMeanUnit:point.monthlyUnits?.precipitation_mean??null,precipitationAnomaly:point.monthly.precipitation_anomaly?.[i]??null,precipitationAnomalyUnit:point.monthlyUnits?.precipitation_anomaly??null},observation:actual,status:actual.complete?"OBSERVATION_COVERAGE_COMPLETE_SEMANTICS_UNVERIFIED":"INCOMPLETE_OBSERVATION_COVERAGE",issueTimeKnown:false,periodBoundaryVerified:false});
  }
 }
}
const dedup=new Map();
for(const pair of pairs){
 const key=[pair.archiveDate,pair.region,pair.temporalScale,pair.periodStart].join("|");
 const old=dedup.get(key);if(!old||pair.retrievedAt>old.retrievedAt)dedup.set(key,pair);
}
const output=[...dedup.values()].sort((a,b)=>a.periodStart.localeCompare(b.periodStart)||a.region.localeCompare(b.region)||a.temporalScale.localeCompare(b.temporalScale));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),archiveType:"okinawa-seasonal-forecast-observation-pairs",forecastSnapshotsRead:forecastFiles.length,observationSnapshotsRead:observationFiles.length,uniqueObservationStationHours:observations.size,latestObservationDate,pairedRecords:output.length,coverageCompleteRecords:output.filter(x=>x.observation.complete).length,semanticsVerifiedRecords:output.filter(x=>x.periodBoundaryVerified===true).length,incompleteRecords:output.filter(x=>!x.observation.complete).length,regions:stationsByRegion,aggregationRules:{stationEligibility:"At least 90% of expected hourly precipitation observations in the target period for each station.",regionalEligibility:"At least two eligible stations per region; regional total is the arithmetic mean of eligible station period totals.",missingData:"No missing hours are imputed as zero. Incomplete station totals are excluded.",weeklyPeriod:"Provider timestamp boundary semantics are not explicitly defined in the reviewed API documentation; provisional start-through-start+6 aggregation is retained for inspection only and is not eligible for skill scoring.",monthlyPeriod:"Monthly timestamps are provisionally normalized to calendar months for inspection only; provider timestamp boundary semantics are not explicitly documented and scoring remains disabled.",forecastVintage:"Each archived retrieval is retained as a forecast vintage only if retrieval date is before the target period. Provider model issue time is not exposed and is not inferred."},limitations:["This output pairs raw forecast fields with JMA regional observed precipitation totals; it deliberately does not calculate forecast error, hit rate, or accuracy yet.","Forecast units are copied from weekly_units/monthly_units in the API response. The API documentation identifies weekly/monthly precipitation Mean and Anomaly but does not specify the exact timestamp boundary convention in the reviewed text; period matching is provisional and no skill metrics are allowed.","Seasonal forecast issue/initialization time is unavailable; retrieval timestamp is retained as a vintage timestamp only.","JMA station totals are regional proxies, not golf-course observations; the two-station minimum and 90% hourly coverage rule reduce but do not remove representativeness uncertainty.","Monthly pairs will remain incomplete until observation archives have accumulated the entire calendar month."]};
const dir=outputDir;await fs.mkdir(dir,{recursive:true});const date=new Date().toISOString().slice(0,10);
await fs.writeFile(dir+"/"+date+".json",JSON.stringify({...report,pairs:output},null,2));
const md=["# Okinawa Seasonal Forecast–JMA Observation Pairing","", "Generated: "+report.generatedAt,"Latest observation date: "+(latestObservationDate||"none"),"Forecast snapshots: "+forecastFiles.length,"Observation snapshots: "+observationFiles.length,"Unique station-hour observations: "+observations.size,"Pair records: "+output.length+" (coverage complete but semantics unverified "+output.filter(x=>x.status==="OBSERVATION_COVERAGE_COMPLETE_SEMANTICS_UNVERIFIED").length+", incomplete "+report.incompleteRecords+")","","## Records","", "| Forecast vintage | Region | Scale | Target period | Forecast precip mean | EFI | JMA regional total | Eligible stations | Status |","|---|---|---|---|---:|---:|---:|---:|---|",...output.map(x=>"| "+x.archiveDate+" | "+x.region+" | "+x.temporalScale+" | "+x.periodStart+"–"+x.periodEnd+" | "+(x.forecast.precipitationMean??"—")+" | "+(x.forecast.precipitationEfi??"—")+" | "+(x.observation.observedRegionalMeanTotalMm??"—")+" | "+x.observation.eligibleStationCount+"/"+x.observation.stationCount+" | "+x.status+" |"),"","## Rules and limitations","",...report.limitations.map(x=>"- "+x)].join("\n");
await fs.writeFile(dir+"/"+date+".md",md);
console.log(md);
