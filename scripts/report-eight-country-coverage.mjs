import fs from "node:fs/promises";
import { buildCountryCoverageMatrix } from "../assets/js/eight-country-coverage.js";
const [countries,courses,providers]=await Promise.all([
 fs.readFile("config/global/countries.json","utf8"),
 fs.readFile("config/global/courses.json","utf8"),
 fs.readFile("config/global/providers.json","utf8")
]);
const providerIds=JSON.parse(providers).providers.filter(p=>p.enabled).map(p=>p.id);
const matrix=buildCountryCoverageMatrix(JSON.parse(countries),JSON.parse(courses),providerIds);
const report={generatedAt:new Date().toISOString(),scope:"configured countries and course catalogue only; not forecast-skill validation",providerIds,matrix};
await fs.mkdir("artifacts",{recursive:true});
await fs.writeFile("artifacts/eight-country-coverage.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
