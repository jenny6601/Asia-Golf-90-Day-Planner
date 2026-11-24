import {fetchIndependentProviderForecasts} from "../../scripts/lib/provider-fetchers.mjs";

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const ALLOWED=new Set(["JP","KR","CN","VN","TH","MY","SG","ID"]);
function validateCourse(course){
 if(!course||typeof course!=="object"||!course.id||!course.name||!ALLOWED.has(course.countryCode)||!Number.isFinite(course.latitude)||!Number.isFinite(course.longitude)||!course.timezone)throw new TypeError("Course must include id, name, supported country, verified coordinates and IANA timezone");
 try{new Intl.DateTimeFormat("en-US",{timeZone:course.timezone}).format(new Date());}catch{throw new TypeError("Invalid IANA timezone");}
 return course;
}
export async function onRequestPost({request,env}){
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 let body;try{body=await request.json();}catch{return json({error:"Invalid JSON body"},400);}
 if(!Array.isArray(body.courses)||body.courses.length<1||body.courses.length>3)return json({error:"Provide one to three courses"},400);
 try{
  const courses=body.courses.map(validateCourse);
  const results=await Promise.all(courses.map(course=>fetchIndependentProviderForecasts(course,{
   visualCrossingApiKey:env.VISUAL_CROSSING_API_KEY,forecaApiKey:env.FORECA_API_KEY
  })));
  return json({generatedAt:new Date().toISOString(),providerPolicy:"independent-no-fallback",courses:results});
 }catch(error){return json({error:error.message??"Provider request failed"},400);}
}
