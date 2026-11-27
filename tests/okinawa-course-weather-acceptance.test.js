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
