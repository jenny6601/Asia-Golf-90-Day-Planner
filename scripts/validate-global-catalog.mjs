import fs from "node:fs/promises";

const root = new URL("../config/global/", import.meta.url);
const countries = JSON.parse(await fs.readFile(new URL("countries.json", root), "utf8"));
const courses = JSON.parse(await fs.readFile(new URL("courses.json", root), "utf8"));
const providers = JSON.parse(await fs.readFile(new URL("providers.json", root), "utf8"));

const errors = [];
const countryCodes = new Set();
for (const country of countries) {
  if (!/^[A-Z]{2}$/.test(country.code)) errors.push("Invalid country code: " + country.code);
  if (countryCodes.has(country.code)) errors.push("Duplicate country code: " + country.code);
  countryCodes.add(country.code);
  if (!country.name || !country.nameZh || !["per-course"].includes(country.timezonePolicy)) errors.push("Incomplete country config: " + country.code);
}
const ids = new Set();
for (const course of courses) {
  if (!course.id || ids.has(course.id)) errors.push("Missing or duplicate course id: " + course.id);
  ids.add(course.id);
  if (!countryCodes.has(course.countryCode)) errors.push("Unknown countryCode for " + course.id);
  if (!course.name || !course.address || !course.timezone || !course.coordinateSource) errors.push("Missing required course metadata: " + course.id);
  if (!["verified","provisional","pending"].includes(course.coordinateStatus)) errors.push("Invalid coordinateStatus: " + course.id);
  const hasLat = Number.isFinite(course.latitude), hasLon = Number.isFinite(course.longitude);
  if (hasLat !== hasLon) errors.push("Latitude/longitude must both be numeric or both null: " + course.id);
  if (course.coordinateStatus === "pending" && (hasLat || hasLon)) errors.push("Pending coordinates must be null: " + course.id);
  if (course.coordinateStatus !== "pending" && (!hasLat || !hasLon)) errors.push("Non-pending course requires numeric vicinity coordinates: " + course.id);
  if (hasLat && (course.latitude < -90 || course.latitude > 90)) errors.push("Latitude out of range: " + course.id);
  if (hasLon && (course.longitude < -180 || course.longitude > 180)) errors.push("Longitude out of range: " + course.id);
}
const providerIds = providers.providers.map(p => p.id);
if (new Set(providerIds).size !== providerIds.length) errors.push("Duplicate provider id");
if (!Number.isInteger(providers.preliminaryMinimumCompleteProviders) || providers.preliminaryMinimumCompleteProviders < 1 || providers.preliminaryMinimumCompleteProviders > providerIds.length) errors.push("Invalid preliminary provider threshold");
for (const id of providers.strictComparisonProviders) if (!providerIds.includes(id)) errors.push("Unknown strict comparison provider: " + id);
if (providers.dateDecision?.nights !== 4 || providers.dateDecision?.rounds !== 3) errors.push("Unexpected default trip decision parameters");

if (errors.length) {
  console.error("Global catalog validation failed:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("Global catalog validation passed: " + countries.length + " countries configured, " + courses.length + " courses registered, " + providerIds.length + " providers defined.");
}
