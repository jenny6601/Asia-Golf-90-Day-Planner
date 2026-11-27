const validPoint=course=>course?.enabled===true&&Number.isFinite(course.latitude)&&Number.isFinite(course.longitude);
const distanceSquared=(a,b)=>(a.latitude-b.latitude)**2*Math.cos((a.latitude+b.latitude)*Math.PI/360)**2+(a.longitude-b.longitude)**2;
function selectRepresentative(rows,preferredId){
 if(preferredId){
  const preferred=rows.find(x=>x.id===preferredId);
  return preferred||null;
 }
 const centroid={latitude:rows.reduce((sum,x)=>sum+x.latitude,0)/rows.length,longitude:rows.reduce((sum,x)=>sum+x.longitude,0)/rows.length};
 return [...rows].sort((a,b)=>distanceSquared(a,centroid)-distanceSquared(b,centroid)||a.id.localeCompare(b.id))[0];
}
export function buildRegionalCoverage(countries,courses,registry=[]){
 if(!Array.isArray(countries)||!Array.isArray(courses)||!Array.isArray(registry))throw new TypeError("countries, courses and registry must be arrays");
 const groups=new Map();
 for(const course of courses.filter(validPoint)){
  const key=[course.countryCode,course.region||"未分類地區",course.area||"未分類次分區"].join("|");
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(course);
 }
 const registryByCountry=new Map(registry.map(x=>[x.countryCode,x]));
 const countryRows=countries.map(country=>{
  const configured=registryByCountry.get(country.code);
  const planned=(configured?.subregions||[]).map(subregion=>{
   const key=[country.code,subregion.region,subregion.subregion].join("|");
   const rows=groups.get(key)||[];
   const representative=rows.length?selectRepresentative(rows,subregion.representativeCourseId):null;
   return {id:subregion.id,countryCode:country.code,region:subregion.region,area:subregion.subregion,label:subregion.label,candidateCount:rows.length,requestedRepresentativeCourseId:subregion.representativeCourseId||null,coverageStatus:representative?"ready":(subregion.representativeCourseId?"invalid-representative-course-id":"awaiting-course-coordinate"),representative:representative?{id:representative.id,name:representative.name,nameLocal:representative.nameLocal||"",latitude:representative.latitude,longitude:representative.longitude,coordinateStatus:representative.coordinateStatus}:null};
  });
  const extra=[...groups.entries()].filter(([key])=>key.startsWith(country.code+"|")).map(([key,rows])=>{
   const [countryCode,region,area]=key.split("|");
   if(planned.some(x=>x.region===region&&x.area===area))return null;
   const representative=selectRepresentative(rows,null);
   return {id:null,countryCode,region,area,label:region+" "+area,candidateCount:rows.length,coverageStatus:"unregistered-subregion",representative:{id:representative.id,name:representative.name,nameLocal:representative.nameLocal||"",latitude:representative.latitude,longitude:representative.longitude,coordinateStatus:representative.coordinateStatus}};
  }).filter(Boolean);
  const subregions=[...planned,...extra].sort((a,b)=>a.region.localeCompare(b.region)||a.area.localeCompare(b.area));
  return {code:country.code,name:country.name,nameZh:country.nameZh||country.name,enabled:country.enabled===true,registryStatus:configured?.coverageStatus||"not-registered",subregionCount:subregions.length,readySubregionCount:subregions.filter(x=>Boolean(x.representative)).length,candidateCourseCount:subregions.reduce((n,x)=>n+x.candidateCount,0),subregions};
 });
 return {countryCount:countryRows.length,enabledCountryCount:countryRows.filter(x=>x.enabled).length,countriesWithCoverage:countryRows.filter(x=>x.readySubregionCount>0).length,subregionCount:countryRows.reduce((n,x)=>n+x.subregionCount,0),readySubregionCount:countryRows.reduce((n,x)=>n+x.readySubregionCount,0),representativeCount:countryRows.reduce((n,x)=>n+x.readySubregionCount,0),countries:countryRows};
}
