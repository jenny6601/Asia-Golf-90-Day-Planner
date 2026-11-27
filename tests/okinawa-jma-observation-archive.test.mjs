import test from "node:test";
import assert from "node:assert/strict";
import {parseAmedasPointBlock} from "../scripts/jma-amedas-validation.js";

test("parses station observations with Asia/Tokyo valid timestamps and quality flags",()=>{
 const rows=parseAmedasPointBlock({"20261127010000":{temp:[21.2,0],precipitation1h:[0,0],wind:[3.4,1],gust:[5.1,2]}});
 assert.equal(rows[0].time,"2026-11-27T01:00");
 assert.equal(rows[0].temperature.value,21.2);
 assert.equal(rows[0].windSpeed.value,3.4);
 assert.equal(rows[0].gust.value,null);
});
test("missing or non-usable readings are not converted to zero",()=>{
 const rows=parseAmedasPointBlock({"20261127010000":{temp:[null,0],precipitation1h:[0,2],wind:[0,0]}});
 assert.equal(rows[0].temperature.value,null);
 assert.equal(rows[0].precipitation1h.value,null);
 assert.equal(rows[0].windSpeed.value,0);
});
