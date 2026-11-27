import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const candidates = JSON.parse(await fs.readFile(new URL("config/okinawa/course-coordinate-candidates.json", root), "utf8"));
const runtime = JSON.parse(await fs.readFile(new URL("config/global/courses.json", root), "utf8"));
const ids = ["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"];
const pilotModule = await import("../assets/js/okinawa-courses.js");
const pilot = pilotModule.OKINAWA_COURSES;

test("Okinawa acceptance scope contains exactly the six requested main-island courses", () => {
  assert.deepEqual(candidates.map(x => x.id).sort(), [...ids].sort());
  assert.equal(new Set(candidates.map(x => x.id)).size, 6);
});

test("all Okinawa candidate coordinates are valid and use Japan local time", () => {
  for (const course of candidates) {
    assert.ok(Number.isFinite(course.latitude) && course.latitude >= 24 && course.latitude <= 28, course.id);
    assert.ok(Number.isFinite(course.longitude) && course.longitude >= 122 && course.longitude <= 130, course.id);
    assert.equal(course.timezone, "Asia/Tokyo", course.id);
    assert.ok(course.officialSourceUrl, course.id);
    assert.ok(course.coordinateSource, course.id);
  }
});

test("PGM manual point remains pending and is not promoted into runtime coordinates", () => {
  const candidate = candidates.find(x => x.id === "pgm-okinawa");
  const runtimeCourse = runtime.find(x => x.id === "pgm-okinawa");
  assert.equal(candidate.coordinateStatus, "pending");
  assert.equal(candidate.coordinateSource, "User_Google_Maps_Manual");
  assert.equal(runtimeCourse.coordinateStatus, "pending");
  assert.equal(runtimeCourse.latitude, null);
  assert.equal(runtimeCourse.longitude, null);
  assert.equal(runtimeCourse.enabled, false);
});

test("official map coordinates are explicitly distinguished from provisional candidates", () => {
  for (const id of ["atta-terrace","chura-orchard","kise"]) {
    assert.equal(candidates.find(x => x.id === id).coordinateStatus, "verified", id);
  }
  for (const id of ["southern-links","palm-hills"]) {
    assert.equal(candidates.find(x => x.id === id).coordinateStatus, "provisional", id);
  }
});

test("runtime course catalogue still preserves all six records and does not activate pending PGM", () => {
  assert.deepEqual(runtime.map(x => x.id), ids);
  assert.equal(runtime.find(x => x.id === "pgm-okinawa").enabled, false);
});

test("runtime and pilot catalogs match audited candidate points without promoting pending PGM", () => {
  for (const candidate of candidates) {
    const globalCourse = runtime.find(x => x.id === candidate.id);
    const pilotCourse = pilot.find(x => x.id === candidate.id);
    assert.ok(globalCourse && pilotCourse, candidate.id);
    if (candidate.coordinateStatus === "pending") {
      assert.equal(globalCourse.latitude, null);
      assert.equal(globalCourse.longitude, null);
      assert.equal(globalCourse.enabled, false);
      assert.equal(pilotCourse.latitude, null);
      assert.equal(pilotCourse.longitude, null);
    } else {
      assert.equal(globalCourse.latitude, candidate.latitude, candidate.id);
      assert.equal(globalCourse.longitude, candidate.longitude, candidate.id);
      assert.equal(pilotCourse.latitude, candidate.latitude, candidate.id);
      assert.equal(pilotCourse.longitude, candidate.longitude, candidate.id);
      assert.equal(globalCourse.coordinateStatus, candidate.coordinateStatus, candidate.id);
      assert.equal(pilotCourse.coordinateStatus, candidate.coordinateStatus, candidate.id);
    }
  }
});

test("JMA AMeDAS station metadata includes rainfall and full-weather references", async () => {
  const stations = JSON.parse(await fs.readFile(new URL("config/okinawa/jma-amedas-stations.json", root), "utf8"));
  assert.ok(stations.length >= 8);
  assert.ok(stations.every(x => Number.isFinite(x.latitude) && Number.isFinite(x.longitude) && Number.isFinite(x.elevationM)));
  assert.ok(stations.some(x => x.id === "91241" && x.observedElements.includes("temperature") && x.observedElements.includes("wind")));
  assert.ok(stations.some(x => x.id === "91121" && x.observedElements.length === 1 && x.observedElements[0] === "precipitation"));
});
