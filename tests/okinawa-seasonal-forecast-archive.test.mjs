import test from "node:test";
import assert from "node:assert/strict";
const required=["north","central","south"];
function validate(snapshot){
 if(snapshot.archiveType!=="okinawa-ecmwf-seasonal-snapshot")return false;
 if(!Array.isArray(snapshot.points)||snapshot.points.length!==3)return false;
 if(required.some(id=>!snapshot.points.some(p=>p.point?.id===id)))return false;
 return snapshot.points.every(p=>p.weekly?.time?.length&&p.weekly.precipitation_efi?.length&&p.monthly?.time?.length&&p.monthly.precipitation_mean?.length&&p.monthly.precipitation_anomaly?.length);
}
test("seasonal archive requires all three Okinawa regions",()=>{
 const point=id=>({point:{id},weekly:{time:["2026-12-01"],precipitation_efi:[0]},monthly:{time:["2026-12-01"],precipitation_mean:[10],precipitation_anomaly:[0]}});
 assert.equal(validate({archiveType:"okinawa-ecmwf-seasonal-snapshot",points:required.map(point)}),true);
 assert.equal(validate({archiveType:"okinawa-ecmwf-seasonal-snapshot",points:required.slice(0,2).map(point)}),false);
});
test("seasonal archive rejects missing EFI or monthly anomaly arrays",()=>{
 const points=required.map(id=>({point:{id},weekly:{time:["2026-12-01"],precipitation_efi:[0]},monthly:{time:["2026-12-01"],precipitation_mean:[10],precipitation_anomaly:[0]}}));
 points[0].weekly.precipitation_efi=[];
 assert.equal(validate({archiveType:"okinawa-ecmwf-seasonal-snapshot",points}),false);
});
