import test from "node:test";
import assert from "node:assert/strict";
import {parseAmedasReading,parseAmedasPointBlock,regressionMetrics,rainEventMetrics} from "../scripts/jma-amedas-validation.js";

test("AMeDAS values accept only quality 0 or 1 and reject missing or questionable readings",()=>{
 assert.deepEqual(parseAmedasReading([22.5,0]),{value:22.5,quality:0,usable:true});
 assert.deepEqual(parseAmedasReading([0,1]),{value:0,quality:1,usable:true});
 assert.deepEqual(parseAmedasReading([0,6]),{value:null,quality:6,usable:false});
 assert.deepEqual(parseAmedasReading([null,0]),{value:null,quality:0,usable:false});
 assert.deepEqual(parseAmedasReading(undefined),{value:null,quality:null,usable:false});
});

test("AMeDAS point blocks parse JST hourly samples and preserve quality flags",()=>{
 const rows=parseAmedasPointBlock({
  "20261126090000":{temp:[23.1,0],humidity:[80,0],precipitation1h:[0,0],wind:[2.1,0],windDirection:[14,0],gust:[5.2,0]},
  "20261126091000":{temp:[23.2,0],humidity:[81,0],precipitation1h:[0,0],wind:[2.0,0],windDirection:[14,0]},
  "20261126100000":{temp:[null,6],humidity:[null,6],precipitation1h:[0,6],wind:[null,6],windDirection:[null,6]}
 });
 assert.equal(rows.length,3);
 assert.equal(rows[0].time,"2026-11-26T09:00");
 assert.equal(rows[0].temperature.value,23.1);
 assert.equal(rows[1].temperature.value,23.2);
 assert.equal(rows[2].temperature.value,null);
 assert.equal(rows[2].precipitation1h.value,null);
});

test("regression metrics compute MAE, bias and RMSE from paired values",()=>{
 const m=regressionMetrics([{forecast:2,observed:1},{forecast:4,observed:5},{forecast:3,observed:3}]);
 assert.equal(m.n,3);
 assert.ok(Math.abs(m.mae-2/3)<1e-12);
 assert.ok(Math.abs(m.bias,0)<1e-12);
 assert.ok(Math.abs(m.rmse-Math.sqrt(2/3))<1e-12);
});

test("rain-event verification computes POD, FAR and CSI without treating missing values as dry",()=>{
 const m=rainEventMetrics([{forecast:2,observed:3},{forecast:0,observed:1},{forecast:2,observed:0},{forecast:null,observed:2}],1);
 assert.equal(m.n,3);
 assert.equal(m.hits,1);
 assert.equal(m.misses,1);
 assert.equal(m.falseAlarms,1);
 assert.equal(m.pod,.5);
 assert.equal(m.far,.5);
 assert.equal(m.csi,1/3);
});