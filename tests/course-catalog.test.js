import test from "node:test";
import assert from "node:assert/strict";
import {fetchAsiaGolfCourseCatalog, fetchAsiaGolfDirectory} from "../assets/js/course-catalog.js";

const course = {
  id:"okinawa-user-gps", countryCode:"JP", name:"Okinawa User GPS",
  timezone:"Asia/Tokyo", latitude:26.455335, longitude:127.820344,
  coordinateStatus:"user_provided_google_maps", enabled:true
};
const countries = [{code:"JP",nameZh:"日本"}];

function mockFetch(url) {
  const value = String(url).includes("countries.json") ? countries : [course];
  return Promise.resolve({ok:true,json:async()=>value});
}

test("runtime catalog accepts user-provided Google Maps coordinates", async()=>{
  const rows = await fetchAsiaGolfCourseCatalog({enabledOnly:true,fetchImpl:mockFetch});
  assert.equal(rows.length,1);
  assert.equal(rows[0].coordinateStatus,"user_provided_google_maps");
});

test("directory initialization loads countries and user-coordinate courses together", async()=>{
  const directory = await fetchAsiaGolfDirectory({fetchImpl:mockFetch});
  assert.equal(directory.countryCount,1);
  assert.equal(directory.courseCount,1);
  assert.equal(directory.courses[0].id,"okinawa-user-gps");
});

test("runtime catalog still rejects unknown coordinate status", async()=>{
  const invalid = {...course,coordinateStatus:"unverified_guess"};
  const fetchImpl = async url => ({ok:true,json:async()=>String(url).includes("countries.json")?countries:[invalid]});
  await assert.rejects(fetchAsiaGolfCourseCatalog({fetchImpl}),/座標狀態錯誤/);
});
