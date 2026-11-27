import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../config/global/", import.meta.url);
const countries = JSON.parse(await fs.readFile(new URL("countries.json", root), "utf8"));
const courses = JSON.parse(await fs.readFile(new URL("courses.json", root), "utf8"));
const providerConfig = JSON.parse(await fs.readFile(new URL("providers.json", root), "utf8"));

test("global country registry contains the eight planned launch markets", () => {
  assert.deepEqual(countries.map(x => x.code), ["JP","KR","CN","VN","TH","MY","SG","ID"]);
});

test("global course catalog preserves the six Okinawa pilot courses as its active prefix and adds the eight-country seed", () => {
  assert.deepEqual(courses.slice(0,6).map(x => x.id), ["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"]);
  assert.equal(courses.length,131);
  assert.ok(courses.slice(0,6).every(x => x.countryCode === "JP" && x.timezone === "Asia/Tokyo" && x.region === "Okinawa"));
  assert.equal(new Set(courses.map(x => x.id)).size,65);
  assert.ok(courses.slice(6).every(x => x.catalogStatus === "research_candidate" && x.weatherEnabled === false));
  assert.ok(courses.slice(6).every(x => x.regionalRepresentativeCourseId && x.regionalSubregionId));
  assert.ok(courses.slice(6).filter(x => x.regionalRepresentative).every(x => Number.isFinite(x.latitude) && Number.isFinite(x.longitude)));
  assert.deepEqual([...new Set(courses.map(x => x.countryCode))].sort(), ["CN","ID","JP","KR","MY","SG","TH","VN"]);
});

test("all six Okinawa courses have user-supplied Google Maps runtime coordinates", () => {
  const ids = ["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"];
  for (const id of ids) {
    const course = courses.find(x => x.id === id);
    assert.equal(course.coordinateStatus, "user_provided_google_maps", id);
    assert.equal(course.coordinateSource, "User-provided Google Maps coordinate (2026-11-27)", id);
    assert.ok(Number.isFinite(course.latitude) && Number.isFinite(course.longitude), id);
    assert.equal(course.enabled, true, id);
  }
});

test("global forecast policy uses two providers for preliminary screening and separates strict comparison", () => {
  assert.equal(providerConfig.preliminaryMinimumCompleteProviders, 2);
  assert.deepEqual(providerConfig.strictComparisonProviders, ["openMeteo","visualCrossing","foreca"]);
  assert.equal(providerConfig.dateDecision.nights, 4);
  assert.equal(providerConfig.dateDecision.rounds, 3);
});
