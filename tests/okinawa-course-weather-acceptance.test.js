import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const candidates = JSON.parse(await fs.readFile(new URL("config/okinawa/course-coordinate-candidates.json", root), "utf8"));
const runtime = JSON.parse(await fs.readFile(new URL("config/global/courses.json", root), "utf8"));
const ids = ["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"];
const expected = {
  "southern-links":[26.113785,127.739021],
  "palm-hills":[26.120580,127.699640],
  "pgm-okinawa":[26.455335,127.820344],
  "kise":[26.524228,127.939192],
  "atta-terrace":[26.499868,127.896002],
  "chura-orchard":[26.506260,127.895720]
};
const pilot = (await import("../assets/js/okinawa-courses.js")).OKINAWA_COURSES;
const {fetchAsiaGolfDirectory} = await import("../assets/js/course-catalog.js");
const {fetchCourseForecast} = await import("../assets/js/weather-api.js");

test("Okinawa acceptance scope contains exactly the six requested main-island courses", () => {
  assert.deepEqual(candidates.map(x => x.id).sort(), [...ids].sort());
  assert.equal(new Set(candidates.map(x => x.id)).size, 6);
});

test("all six exact Google Maps coordinates supplied by the user are preserved", () => {
  for (const id of ids) {
    const [lat,lon] = expected[id];
    const candidate = candidates.find(x => x.id === id);
    const globalCourse = runtime.find(x => x.id === id);
    const pilotCourse = pilot.find(x => x.id === id);
    for (const record of [candidate,globalCourse,pilotCourse]) {
      assert.equal(record.latitude,lat,id+" latitude");
      assert.equal(record.longitude,lon,id+" longitude");
      assert.equal(record.timezone,"Asia/Tokyo",id);
      assert.equal(record.coordinateStatus,"user_provided_google_maps",id);
    }
    assert.equal(globalCourse.enabled,true,id+" enabled");
    assert.equal(candidate.coordinateSource,"User-provided Google Maps coordinate (2026-11-27)",id);
    assert.equal(globalCourse.coordinateSource,"User-provided Google Maps coordinate (2026-11-27)",id);
  }
});

test("all six user-supplied points are within Okinawa coordinate bounds", () => {
  for (const course of candidates) {
    assert.ok(course.latitude >= 24 && course.latitude <= 28, course.id);
    assert.ok(course.longitude >= 122 && course.longitude <= 130, course.id);
    assert.ok(course.officialSourceUrl, course.id);
  }
});

test("runtime and pilot catalogs contain exactly the same six GPS points", () => {
  assert.deepEqual(runtime.map(x => x.id),ids);
  assert.deepEqual(pilot.map(x => x.id),ids);
  for (const id of ids) {
    const a=runtime.find(x=>x.id===id),b=pilot.find(x=>x.id===id);
    assert.equal(a.latitude,b.latitude,id);
    assert.equal(a.longitude,b.longitude,id);
  }
});

test("JMA AMeDAS station metadata includes rainfall and full-weather references", async () => {
  const stations = JSON.parse(await fs.readFile(new URL("config/okinawa/jma-amedas-stations.json", root), "utf8"));
  assert.ok(stations.length >= 8);
  assert.ok(stations.every(x => Number.isFinite(x.latitude) && Number.isFinite(x.longitude) && Number.isFinite(x.elevationM)));
  assert.ok(stations.some(x => x.id === "91241" && x.observedElements.includes("temperature") && x.observedElements.includes("wind")));
  assert.ok(stations.some(x => x.id === "91121" && x.observedElements.length === 1 && x.observedElements[0] === "precipitation"));
});

test("App runtime directory loads all six GPS points and sends exact points to Open-Meteo", async () => {
  const requests = [];
  const days = Array.from({length:16}, (_,i) => "2026-12-" + String(i+1).padStart(2,"0"));
  const fetchMock = async input => {
    const url = new URL(input);
    if (url.pathname.endsWith("/countries.json")) {
      return {ok:true,json:async()=>[{code:"JP",nameZh:"日本"}]};
    }
    if (url.pathname.endsWith("/courses.json")) {
      return {ok:true,json:async()=>runtime};
    }
    if (url.hostname === "api.open-meteo.com") {
      requests.push(url);
      return {ok:true,json:async()=>({
        timezone:"Asia/Tokyo",latitude:Number(url.searchParams.get("latitude")),
        longitude:Number(url.searchParams.get("longitude")),
        daily:{time:days,precipitation_sum:Array(16).fill(0)},
        hourly:{time:["2026-12-01T06:00"],precipitation:[0]}
      })};
    }
    throw new Error("Unexpected URL: " + url.href);
  };
  const directory = await fetchAsiaGolfDirectory({fetchImpl:fetchMock});
  const appCourses = directory.courses.filter(x=>ids.includes(x.id));
  assert.equal(appCourses.length,6);
  for (let i=0;i<appCourses.length;i+=3) {
    await fetchCourseForecast(appCourses.slice(i,i+3),fetchMock);
  }
  assert.equal(requests.length,6);
  for (const id of ids) {
    const expectedPoint=expected[id];
    const request=requests.find(url=>Number(url.searchParams.get("latitude"))===expectedPoint[0]&&Number(url.searchParams.get("longitude"))===expectedPoint[1]);
    assert.ok(request,"Open-Meteo request missing exact App GPS for "+id);
  }
});

test("JMA AMeDAS station metadata records official station type and observed-element flags", async () => {
  const stations=JSON.parse(await fs.readFile(new URL("config/okinawa/jma-amedas-stations.json",root),"utf8"));
  const expected={"91107":["B","11111011"],"91241":["C","11112010"],"91121":["C","01000000"],"91166":["C","11112010"]};
  for(const [id,[type,elements]] of Object.entries(expected)){
    const station=stations.find(x=>x.id===id);
    assert.ok(station,id);
    assert.equal(station.jmaType,type,id);
    assert.equal(station.jmaElementsCode,elements,id);
    assert.equal(station.officialStationTableUrl,"https://www.jma.go.jp/bosai/amedas/const/amedastable.json",id);
  }
});
