export function forecastGridKey(grid){
 if(!Number.isFinite(grid?.latitude)||!Number.isFinite(grid?.longitude))return null;
 return grid.latitude.toFixed(5)+","+grid.longitude.toFixed(5);
}

export function groupForecastGridCells(courses){
 const groups=new Map();
 for(const course of courses){const key=forecastGridKey(course.forecastGrid);if(!key)continue;if(!groups.has(key))groups.set(key,{key,latitude:course.forecastGrid.latitude,longitude:course.forecastGrid.longitude,courses:[]});groups.get(key).courses.push(course);}
 return [...groups.values()].map(x=>({...x,courseIds:x.courses.map(c=>c.courseId),courseNames:x.courses.map(c=>c.name),areas:[...new Set(x.courses.map(c=>c.area))]}));
}

export function compareNumericSeries(a,b){
 const pairs=[];for(let i=0;i<Math.min(a?.length||0,b?.length||0);i++)if(Number.isFinite(a[i])&&Number.isFinite(b[i]))pairs.push([a[i],b[i]]);
 if(!pairs.length)return {n:0,exactMatchPercent:null,meanAbsoluteDifference:null,maxAbsoluteDifference:null};
 const deltas=pairs.map(([x,y])=>Math.abs(x-y));
 return {n:pairs.length,exactMatchPercent:pairs.filter(([x,y])=>x===y).length/pairs.length*100,meanAbsoluteDifference:deltas.reduce((s,x)=>s+x,0)/deltas.length,maxAbsoluteDifference:Math.max(...deltas)};
}

export function summarizeNumeric(values){
 const a=(values||[]).filter(x=>typeof x==="number"&&Number.isFinite(x));
 return {n:a.length,mean:a.length?a.reduce((s,x)=>s+x,0)/a.length:null,min:a.length?Math.min(...a):null,max:a.length?Math.max(...a):null,sum:a.reduce((s,x)=>s+x,0)};
}