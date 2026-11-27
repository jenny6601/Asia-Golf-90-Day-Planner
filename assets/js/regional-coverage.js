const validPoint=course=>course?.enabled===true&&Number.isFinite(course.latitude)&&Number.isFinite(course.longitude);
const distanceSquared=(a,b)=>(a.latitude-b.latitude)**2*Math.cos((a.latitude+b.latitude)*Math.PI/360)**2+(a.longitude-b.longitude)**2;
export function buildRegionalCoverage(countries,courses){
 if(!Array.isArray(countries)||!Array.isArray(courses))throw new TypeError("countries and courses must be arrays");
 const groups=new Map();
 for(const course of courses.filter(validPoint)){
  const key=[course.countryCode,course.region||"未分類地區",course.area||"未分類次分區"].join("|");
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(course);
 }
 const countryRows=countries.map(country=>{
  const subregions=[...groups.entries()].filter(([key])=>key.startsWith(country.code+"|")).map(([key,rows])=>{
   const [countryCode,region,area]=key.split("|");
   const centroid={latitude:rows.reduce((sum,x)=>sum+x.latitude,0)/rows.length,longitude:rows.reduce((sum,x)=>sum+x.longitude,0)/rows.length};
   const representative=[...rows].sort((a,b)=>distanceSquared(a,centroid)-distanceSquared(b,centroid)||a.id.localeCompare(b.id))[0];
   return {countryCode,region,area,candidateCount:rows.length,representative:{id:representative.id,name:representative.name,nameLocal:representative.nameLocal||"",latitude:representative.latitude,longitude:representative.longitude,coordinateStatus:representative.coordinateStatus}};
  }).sort((a,b)=>a.region.localeCompare(b.region)||a.area.localeCompare(b.area));
  return {code:country.code,name:country.name,nameZh:country.nameZh||country.name,enabled:country.enabled===true,subregionCount:subregions.length,candidateCourseCount:subregions.reduce((n,x)=>n+x.candidateCount,0),subregions};
 });
 return {countryCount:countryRows.length,enabledCountryCount:countryRows.filter(x=>x.enabled).length,countriesWithCoverage:countryRows.filter(x=>x.subregionCount>0).length,subregionCount:countryRows.reduce((n,x)=>n+x.subregionCount,0),representativeCount:countryRows.reduce((n,x)=>n+x.subregionCount,0),countries:countryRows};
}
