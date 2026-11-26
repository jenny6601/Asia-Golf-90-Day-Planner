import test from "node:test";
import assert from "node:assert/strict";
import { regressionMetrics, brierScore, categoricalRainMetrics, leadTimeBand, groupByLeadTime } from "../assets/js/hindcast-metrics.js";
test("regression metrics calculate MAE, bias and RMSE and skip missing pairs", () => {
 const r=regressionMetrics([{f:3,o:1},{f:1,o:2},{f:null,o:9}],"f","o");
 assert.equal(r.n,2); assert.equal(r.mae,1.5); assert.equal(r.bias,0.5); assert.equal(r.rmse,Math.sqrt(2.5));
});
test("Brier score uses probabilities in percent and boolean observed event", () => {
 const r=brierScore([{p:80,rain:true},{p:20,rain:false},{p:101,rain:true}],"p","rain");
 assert.equal(r.n,2); assert.ok(Math.abs(r.score-0.04)<1e-12);
});
test("rain contingency metrics calculate POD, FAR and CSI", () => {
 const r=categoricalRainMetrics([{f:true,o:true},{f:true,o:false},{f:false,o:true},{f:false,o:false}],"f","o");
 assert.equal(r.hit,1); assert.equal(r.miss,1); assert.equal(r.falseAlarm,1); assert.equal(r.correctNegative,1);
 assert.equal(r.pod,0.5); assert.equal(r.far,0.5); assert.equal(r.csi,1/3);
});
test("lead-time bands preserve fixed lead-hour definitions", () => {
 assert.equal(leadTimeBand(24),"1–3天"); assert.equal(leadTimeBand(96),"4–7天"); assert.equal(leadTimeBand(240),"8–16天"); assert.equal(leadTimeBand(400),">16天");
 const g=groupByLeadTime([{leadHours:24},{leadHours:100},{leadHours:250}]);
 assert.equal(g["1–3天"].length,1); assert.equal(g["4–7天"].length,1); assert.equal(g["8–16天"].length,1);
});
