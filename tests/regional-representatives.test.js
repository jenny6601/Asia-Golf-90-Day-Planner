import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {fetchAsiaGolfDirectory} from "../assets/js/course-catalog.js";

const root = new URL("../config/global/", import.meta.url);
const countries = JSON.parse(await fs.readFile(new URL("countries.json", root), "utf8"));
const courses = JSON.parse(await fs.readFile(new URL("courses.json", root), "utf8"));
const weatherRegistry = JSON.parse(await fs.readFile(new URL("weather-subregions.json", root), "utf8"));

test("all 80 subregions have one assigned representative course and regional point", () => {
  const byId = new Map(courses.map(course => [course.id, course]));
  const subregions = weatherRegistry.countries.flatMap(group => group.subregions.map(item => ({...item, countryCode:group.countryCode})));
  assert.equal(subregions.length, 80);
  assert.equal(new Set(subregions.map(item => item.id)).size, 80);
  for (const subregion of subregions) {
    const representative = byId.get(subregion.representativeCourseId);
    assert.ok(representative, subregion.id);
    assert.equal(representative.countryCode, subregion.countryCode, subregion.id);
    assert.equal(representative.subregionId, subregion.id, subregion.id);
    assert.ok(Number.isFinite(subregion.candidateCoordinates?.latitude), subregion.id);
    assert.ok(Number.isFinite(subregion.candidateCoordinates?.longitude), subregion.id);
    assert.ok(subregion.candidateCoordinates?.timezone, subregion.id);
    assert.equal(subregion.coordinateQuality?.regionalClimateEligible, true, subregion.id);
    assert.ok(typeof subregion.coordinateQuality?.weatherPointEligible === "boolean", subregion.id);
  }
});

test("App directory loads regional representative metadata without changing presentation", async () => {
  const payloads = {
    "countries.json": countries,
    "courses.json": courses,
    "weather-subregions.json": weatherRegistry
  };
  const fetchImpl = async input => {
    const name = new URL(input).pathname.split("/").pop();
    if (!(name in payloads)) return {ok:false,status:404};
    return {ok:true,json:async()=>payloads[name]};
  };
  const directory = await fetchAsiaGolfDirectory({fetchImpl});
  assert.equal(directory.countryCount, 8);
  assert.equal(directory.courseCount, 131);
  assert.equal(directory.subregionCount, 80);
  assert.equal(directory.subregions.length, 80);
  for (const course of directory.courses) {
    assert.ok(course.regionalClimate, course.id);
    assert.ok(course.regionalRepresentativeCourseId, course.id);
    assert.equal(course.regionalClimate.weatherPointEligible, false, course.id);
  }
  for (const subregion of directory.subregions) {
    const representative = directory.courses.find(course => course.id === subregion.representativeCourseId);
    assert.ok(representative?.regionalClimate?.isRepresentative, subregion.id);
  }
});
