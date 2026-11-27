export function stationPeriodTotal(rows,startDate,endDate,minimumCoverage=.9){
 const start=Date.parse(startDate+"T00:00:00Z"),end=Date.parse(endDate+"T00:00:00Z"),expectedHours=(end-start)/3600000+24;
 const valid=rows.filter(x=>x.usable&&Number.isFinite(x.value)&&x.time>=startDate+"T00:00"&&x.time.slice(0,10)<=endDate);
 const coverage=valid.length/expectedHours;
 return {expectedHours,validHours:valid.length,coverage,rainTotalMm:coverage>=minimumCoverage?valid.reduce((s,x)=>s+x.value,0):null,complete:coverage>=minimumCoverage};
}
export function regionalPeriodTotal(stations,minimumStations=2){
 const eligible=stations.filter(x=>x.complete&&Number.isFinite(x.rainTotalMm));
 return {eligibleStationCount:eligible.length,complete:eligible.length>=minimumStations,observedRegionalMeanTotalMm:eligible.length>=minimumStations?eligible.reduce((s,x)=>s+x.rainTotalMm,0)/eligible.length:null};
}
