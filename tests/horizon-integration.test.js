import test from "node:test";
import assert from "node:assert/strict";
import {combineHorizonRecommendations} from "../assets/js/horizon-integration.js";
test("unified output preserves separate short and long ranking scales",()=>{
 const r=combineHorizonRecommendations({
  shortRange:{recommendations:[{recommendationRank:1,tripStart:"2026-12-01",tripEnd:"2026-12-05",itineraryRisk:12,label:"低",confidenceLabel:"中等（未校準）",rounds:[{date:"2026-12-02",courseName:"A",score:{rainRisk:10,label:"低"}}]}]},
  longRange:{recommendations:[{recommendationRank:1,tripStart:"2027-01-01",tripEnd:"2027-01-05",tendencyRank:0,tendency:"偏乾趨勢",confidence:"極低",rounds:[{date:"2027-01-02",worstZoneLabel:"北部",rank:0,worstSignal:{label:"偏乾"}}]}]}
 });
 assert.equal(r.status,"ready");
 assert.equal(r.shortRange.items[0].metric,"rain-impact-index");
 assert.equal(r.longRange.items[0].metric,"regional-tendency-tier");
 assert.equal(r.crossHorizonComparison,false);
 assert.equal(r.timeline.length,2);
 assert.match(r.note,/不是同一量尺/);
});
test("empty horizon results remain empty and are not synthesized",()=>{
 const r=combineHorizonRecommendations({shortRange:null,longRange:null});
 assert.equal(r.status,"empty");
 assert.equal(r.timeline.length,0);
});
