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

test("pending course coordinates are explicitly unavailable, not fabricated", () => {
  const pgm = courses.find(x => x.id === "pgm-okinawa");
  assert.equal(pgm.coordinateStatus, "pending");
  assert.equal(pgm.latitude, null);
  assert.equal(pgm.longitude, null);
  assert.equal(pgm.enabled, false, "pending GPS must not be selectable in the runtime catalog");
});

test("global forecast policy uses two providers for preliminary screening and separates strict comparison", () => {
  assert.equal(providerConfig.preliminaryMinimumCompleteProviders, 2);
  assert.deepEqual(providerConfig.strictComparisonProviders, ["openMeteo","visualCrossing","foreca"]);
  assert.equal(providerConfig.dateDecision.nights, 4);
  assert.equal(providerConfig.dateDecision.rounds, 3);
});
