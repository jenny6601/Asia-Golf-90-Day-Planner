export function orderCoursesByPriority(courses,preferredCourseIds=[]){
 const rank=new Map((preferredCourseIds||[]).map((id,index)=>[id,index]));
 return (courses||[]).map((course,index)=>({course,index,rank:rank.has(course.id)?rank.get(course.id):Number.POSITIVE_INFINITY}))
  .sort((a,b)=>a.rank-b.rank||a.index-b.index)
  .map(item=>item.course);
}

export function normalizeDepartureRegion(country,region){
 return country==="JP"&&["沖繩","Okinawa"].includes(region)?"Okinawa":region;
}