const REGIONS=["north","central","south"];
const SCALES=["weekly","monthly"];
export function summarizeSeasonalValidationReadiness(pairReports,contextReports){
 const pairs=pairReports.flatMap(x=>x.pairs||[]);
 const contexts=contextReports.flatMap(x=>x.records||[]);
 const groups=[];
 for(const region of REGIONS)for(const scale of SCALES){
  const rows=pairs.filter(x=>x.region===region&&x.temporalScale===scale);
  const complete=rows.filter(x=>x.observation?.complete===true);
  const semanticsVerified=rows.filter(x=>x.periodBoundaryVerified===true&&x.issueTimeKnown===true);
  const validForecast=rows.filter(x=>Number.isFinite(x.forecast?.precipitationMean));
  groups.push({region,temporalScale:scale,pairRecords:rows.length,coverageCompleteRecords:complete.length,incompleteRecords:rows.length-complete.length,forecastValueRecords:validForecast.length,semanticsVerifiedRecords:semanticsVerified.length,scoringEligibleRecords:rows.filter(x=>x.status==="SCORING_ELIGIBLE"&&x.periodBoundaryVerified===true&&x.issueTimeKnown===true&&x.observation?.complete===true&&Number.isFinite(x.forecast?.precipitationMean)).length,readiness:semanticsVerified.length&&complete.length?"REVIEW_REQUIRED":"OBSERVATION_OR_SEMANTICS_GATE_BLOCKED"});
 }
 const contextByRegion=REGIONS.map(region=>{
  const rows=contexts.filter(x=>x.region===region);
  return {region,monthlyContextRecords:rows.length,knownAnomalyRecords:rows.filter(x=>Number.isFinite(x.modelAnomalyMm)).length,era5ReferenceRecords:rows.filter(x=>x.era5Context?.code==="ERA5_REFERENCE_ONLY").length,missingEra5ReferenceRecords:rows.filter(x=>x.era5Context?.code!=="ERA5_REFERENCE_ONLY").length};
 });
 const totalPairs=pairs.length,totalComplete=pairs.filter(x=>x.observation?.complete===true).length;
 return {schemaVersion:1,archiveType:"okinawa-seasonal-validation-readiness",regions:REGIONS,scales:SCALES,totals:{pairRecords:totalPairs,coverageCompleteRecords:totalComplete,incompleteRecords:totalPairs-totalComplete,scoringEligibleRecords:pairs.filter(x=>x.status==="SCORING_ELIGIBLE"&&x.periodBoundaryVerified===true&&x.issueTimeKnown===true&&x.observation?.complete===true&&Number.isFinite(x.forecast?.precipitationMean)).length},groups,monthlyContext:contextByRegion,globalReadiness: "NO_SKILL_SCORING_UNTIL_PROVIDER_PERIOD_BOUNDARIES_AND_FORECAST_ISSUE_TIME_ARE_VERIFIED",rules:{observationCoverage:"Only pair rows marked observation.complete are counted as coverage-complete; station coverage rules are inherited from JMA pairing.",temporalSemantics:"Forecast weekly/monthly period boundaries must be verified against provider documentation or raw product semantics.",forecastVintage:"Retrieval timestamp is not provider issue/initialization time; it cannot be substituted for forecast lead-time validation.",skillScoring:"No error, correlation, hit rate, or accuracy score is computed while period boundaries or issue time remain unknown.",scaleSeparation:"Weekly EC46 and monthly SEAS5 records remain separate; neither is converted into daily rain probability."}};
}
