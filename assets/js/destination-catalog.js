import {OKINAWA_COURSES} from "./okinawa-courses.js";

/** Country-level destination catalogue. Course records are added only after coordinate and timezone verification. */
export const DESTINATIONS = Object.freeze([
 {code:"JP",name:"日本",flag:"🇯🇵",status:"pilot",label:"沖繩試點已建立",timezonePolicy:"IANA timezone required per course"},
 {code:"KR",name:"韓國",flag:"🇰🇷",status:"catalog-pending",label:"球場資料待建置",timezonePolicy:"Asia/Seoul"},
 {code:"CN",name:"中國",flag:"🇨🇳",status:"catalog-pending",label:"球場資料待建置",timezonePolicy:"IANA timezone required per course"},
 {code:"VN",name:"越南",flag:"🇻🇳",status:"catalog-pending",label:"球場資料待建置",timezonePolicy:"IANA timezone required per course"},
 {code:"TH",name:"泰國",flag:"🇹🇭",status:"catalog-pending",label:"球場資料待建置",timezonePolicy:"Asia/Bangkok"},
 {code:"MY",name:"馬來西亞",flag:"🇲🇾",status:"catalog-pending",label:"球場資料待建置",timezonePolicy:"IANA timezone required per course"},
 {code:"SG",name:"新加坡",flag:"🇸🇬",status:"catalog-pending",label:"球場資料待建置",timezonePolicy:"Asia/Singapore"},
 {code:"ID",name:"印尼",flag:"🇮🇩",status:"catalog-pending",label:"球場資料待建置",timezonePolicy:"IANA timezone required per course"}
]);

const COURSES_BY_COUNTRY=Object.freeze({JP:OKINAWA_COURSES});
export function getDestinations(){return DESTINATIONS;}
export function getDestination(countryCode){return DESTINATIONS.find(x=>x.code===countryCode)??null;}
export function getCoursesForCountry(countryCode){return COURSES_BY_COUNTRY[countryCode]??[];}
export function getCourseCoverage(countryCode){
 const courses=getCoursesForCountry(countryCode);
 return {countryCode,count:courses.length,available:courses.length>0,verifiedCoordinates:courses.filter(x=>x.coordinateStatus==="verified").length};
}
