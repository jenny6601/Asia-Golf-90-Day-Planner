import test from "node:test";
import assert from "node:assert/strict";
import {summarizeSeasonalArchive} from "../assets/js/trip-date-seasonal-backtest.js";

test("counts only fully completed EC46 weekly and SEAS5 monthly periods with verified mm units",()=>{
  const snapshots=[{
    localDate:"2026-09-01",
    seasonal:{
      north:{
        weeklyUnits:{precipitation_mean:"mm"},
        monthlyUnits:{precipitation_mean:"mm"},
        weekly:{time:["2026-10-06","2026-11-24"],precipitation_mean:[22,15]},
        monthly:{time:["2026-10-01","2026-11-01"],precipitation_mean:[120,100]}
      }
    }
  }];
  const result=summarizeSeasonalArchive(snapshots,"2026-11-27");
  assert.equal(result.byRegion.north.ec46.archivedPeriods,2);
  assert.equal(result.byRegion.north.ec46.maturedPeriods,1);
  assert.equal(result.byRegion.north.ec46.unitVerifiedPeriods,1);
  assert.equal(result.byRegion.north.seas5.archivedPeriods,2);
  assert.equal(result.byRegion.north.seas5.maturedPeriods,1);
  assert.equal(result.byRegion.north.seas5.unitVerifiedPeriods,1);
});

test("does not treat incomplete periods or missing units as calibration evidence",()=>{
  const snapshots=[{
    localDate:"2026-11-01",
    seasonal:{
      central:{
        weeklyUnits:{precipitation_mean:"mm"},
        monthlyUnits:{precipitation_mean:"mm"},
        weekly:{time:["2026-11-24"],precipitation_mean:[15]},
        monthly:{time:["2026-11-01"],precipitation_mean:[100]}
      }
    }
  }];
  const result=summarizeSeasonalArchive(snapshots,"2026-11-27");
  assert.equal(result.byRegion.central.ec46.maturedPeriods,0);
  assert.equal(result.byRegion.central.seas5.maturedPeriods,0);
  assert.equal(result.totals.ec46.unitVerifiedPeriods,0);
  assert.equal(result.totals.seas5.unitVerifiedPeriods,0);
});

test("rejects invalid date format",()=>{
  assert.throws(()=>summarizeSeasonalArchive([],"2026/11/27"),/asOf must be YYYY-MM-DD/);
});
