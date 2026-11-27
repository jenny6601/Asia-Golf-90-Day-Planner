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

test("global course catalog preserves all six Okinawa pilot courses", () => {
  assert.deepEqual(courses.map(x => x.id), ["southern-links","pgm-okinawa","kise","atta-terrace","palm-hills","chura-orchard"]);
  assert.ok(courses.every(x => x.countryCode === "JP" && x.timezone === "Asia/Tokyo"));
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
