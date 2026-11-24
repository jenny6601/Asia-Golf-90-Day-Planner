import {OKINAWA_COURSES} from "./okinawa-courses.js";
import {validateCourseRecord,isForecastReady} from "./course-schema.js";

export const DESTINATIONS=Object.freeze([
 {code:"JP",name:"日本",flag:"🇯🇵",status:"pilot",label:"沖繩試點已建立"},
 {code:"KR",name:"韓國",flag:"🇰🇷",status:"catalog-pending",label:"球場資料待建置"},
 {code:"CN",name:"中國",flag:"🇨🇳",status:"catalog-pending",label:"球場資料待建置"},
 {code:"VN",name:"越南",flag:"🇻🇳",status:"catalog-pending",label:"球場資料待建置"},
 {code:"TH",name:"泰國",flag:"🇹🇭",status:"catalog-pending",label:"球場資料待建置"},
 {code:"MY",name:"馬來西亞",flag:"🇲🇾",status:"catalog-pending",label:"球場資料待建置"},
 {code:"SG",name:"新加坡",flag:"🇸🇬",status:"catalog-pending",label:"球場資料待建置"},
 {code:"ID",name:"印尼",flag:"🇮🇩",status:"catalog-pending",label:"球場資料待建置"}
]);

const OKINAWA_RECORDS=OKINAWA_COURSES.map(course=>validateCourseRecord({
 id:course.id,countryCode:"JP",region:"沖繩縣",city:course.city,courseName:course.name,localName:course.nameJa??null,
 address:course.address,latitude:course.latitude,longitude:course.longitude,timezone:"Asia/Tokyo",
 coordinateSource:course.coordinateSource??null,coordinateVerifiedAt:null,coordinateStatus:course.coordinateStatus,
 officialUrl:course.officialUrl??null,coordinateSourceUrl:course.coordinateSourceUrl??null,
 providerAvailability:{openMeteo:course.coordinateStatus!=="pending",visualCrossing:"pending",foreca:"pending"},
 dataStatus:course.coordinateStatus==="verified"?"ready":course.coordinateStatus==="provisional"?"needs-verification":"pending"
}));
const RECORDS_BY_COUNTRY=Object.freeze({JP:OKINAWA_RECORDS});
export function getDestinations(){return DESTINATIONS;}
export function getDestination(countryCode){return DESTINATIONS.find(x=>x.code===countryCode)??null;}
export function getCourseRecords(countryCode){return RECORDS_BY_COUNTRY[countryCode]??[];}
export function getCoursesForCountry(countryCode){return getCourseRecords(countryCode).filter(x=>x.coordinateStatus!=="pending");}
export function getCourseCoverage(countryCode){
 const records=getCourseRecords(countryCode);
 return {countryCode,total:records.length,forecastReady:records.filter(isForecastReady).length,provisional:records.filter(x=>x.coordinateStatus==="provisional").length,pending:records.filter(x=>x.coordinateStatus==="pending").length};
}
