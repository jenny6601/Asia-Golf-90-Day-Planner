const COUNTRY_NAMES=Object.freeze({JP:"日本",KR:"韓國",CN:"中國",VN:"越南",TH:"泰國",MY:"馬來西亞",SG:"新加坡",ID:"印尼"});
const SUPPORTED_COUNTRIES=new Set(Object.keys(COUNTRY_NAMES));
const COORDINATE_STATES=new Set(["verified","provisional","pending"]);
const REQUIRED_TEXT=["id","countryCode","region","city","courseName","timezone","coordinateStatus"];

function isValidTimezone(value){
 if(typeof value!=="string"||!value.trim())return false;
 try{new Intl.DateTimeFormat("en-US",{timeZone:value}).format(new Date(0));return true;}catch{return false;}
}
export function validateCourseRecord(record,{requireForecastReady=false}={}){
 if(!record||typeof record!=="object"||Array.isArray(record))throw new TypeError("course record must be an object");
 for(const key of REQUIRED_TEXT)if(typeof record[key]!=="string"||!record[key].trim())throw new TypeError(`course record ${key} is required`);
 if(!SUPPORTED_COUNTRIES.has(record.countryCode))throw new RangeError(`unsupported country code: ${record.countryCode}`);
 if(!isValidTimezone(record.timezone))throw new TypeError("course timezone must be a valid IANA timezone");
 if(!COORDINATE_STATES.has(record.coordinateStatus))throw new RangeError("invalid coordinateStatus");
 const hasLat=Number.isFinite(record.latitude)&&record.latitude>=-90&&record.latitude<=90;
 const hasLon=Number.isFinite(record.longitude)&&record.longitude>=-180&&record.longitude<=180;
 if(hasLat!==hasLon)throw new TypeError("latitude and longitude must both be present or both be null");
 if(record.coordinateStatus==="pending"&&(hasLat||hasLon))throw new TypeError("pending coordinates must not contain unverified numeric coordinates");\n if(record.coordinateStatus==="provisional"&&(!hasLat||!record.coordinateSource))throw new TypeError("provisional coordinates require numeric coordinates and coordinateSource");\n if(record.coordinateStatus==="verified"&&(!hasLat||!record.coordinateSource||!record.coordinateVerifiedAt))throw new TypeError("verified coordinates require numeric coordinates, coordinateSource and coordinateVerifiedAt");
 if(requireForecastReady&&(record.coordinateStatus!=="verified"||!hasLat||!record.coordinateSource||!record.coordinateVerifiedAt))throw new Error("course is not forecast-ready: verified GPS coordinates and provenance are required");
 if(record.officialUrl!==null&&record.officialUrl!==undefined&&!/^https:\/\//.test(record.officialUrl))throw new TypeError("officialUrl must use HTTPS");
 return Object.freeze({...record,countryName:COUNTRY_NAMES[record.countryCode],latitude:hasLat?record.latitude:null,longitude:hasLon?record.longitude:null});
}
export function isForecastReady(record){
 try{validateCourseRecord(record,{requireForecastReady:true});return true;}catch{return false;}
}
export function getCountryNames(){return COUNTRY_NAMES;}
