export const HOURLY_FIELDS=["temperature_2m","apparent_temperature","relative_humidity_2m","precipitation_probability","precipitation","weather_code","wind_speed_10m","wind_direction_10m","wind_gusts_10m","cloud_cover"];
export const DAILY_FIELDS=["weather_code","precipitation_sum","precipitation_probability_max","temperature_2m_min","temperature_2m_max","apparent_temperature_min","apparent_temperature_max","wind_speed_10m_max","wind_gusts_10m_max"];
const finite=value=>typeof value==="number"&&Number.isFinite(value);
export function buildFieldCoverage(data,fields,timeCount){
 return Object.fromEntries(fields.map(field=>[field,{valid:(Array.isArray(data?.[field])?data[field]:[]).filter(finite).length,expected:timeCount}]));
}
export function missingCoverageFields(hourlyCoverage,dailyCoverage){
 return [...HOURLY_FIELDS.filter(field=>hourlyCoverage?.[field]?.valid!==hourlyCoverage?.[field]?.expected||!hourlyCoverage?.[field]?.expected),...DAILY_FIELDS.filter(field=>dailyCoverage?.[field]?.valid!==dailyCoverage?.[field]?.expected||!dailyCoverage?.[field]?.expected)];
}
export function validateArchiveRecords(records,expectedCourseIds){
 const ids=records.map(record=>record.course?.id);
 const unique=new Set(ids);
 return {courseCountPass:ids.length===expectedCourseIds.length&&unique.size===expectedCourseIds.length&&expectedCourseIds.every(id=>unique.has(id)),courseIdsPass:ids.length===expectedCourseIds.length&&expectedCourseIds.every((id,index)=>ids[index]===id),fieldCoveragePass:records.every(record=>missingCoverageFields(record.hourlyCoverage,record.dailyCoverage).length===0),recordsPass:ids.length===expectedCourseIds.length&&unique.size===expectedCourseIds.length&&expectedCourseIds.every(id=>unique.has(id))&&expectedCourseIds.every((id,index)=>ids[index]===id)&&records.every(record=>missingCoverageFields(record.hourlyCoverage,record.dailyCoverage).length===0)};
}
