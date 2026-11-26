# JMA AMeDAS observation probe

This is a separate, read-only observation-data collection probe for Okinawa.

## Stations

| Planner zone | JMA station | Station ID | Role |
|---|---|---:|---|
| North | Nago | 91107 | Candidate precipitation, temperature and wind observations |
| Central | Goya | 91161 | Precipitation-only candidate |
| South | Naha | 91197 | Candidate precipitation, temperature and wind observations |

Station metadata is checked against JMA's AMeDAS station table on every run. Station representativeness must be assessed separately from distance.

## Collection

The workflow runs every three hours and retains each raw JSON artifact for 30 days. It reads JMA's latest observation timestamp and retrieves the corresponding three-hour station data block.

## Important limitations

- The JMA AMeDAS JSON endpoints used by the JMA website are not presented here as a formally documented public API; their response format may change.
- This phase stores raw records only. It does not calculate forecast accuracy.
- Before scoring, validate element availability, units, quality flags, timestamp semantics, precipitation accumulation periods, and station-to-planner-zone representativeness.
- Goya (91161) is treated as precipitation-only unless the live station metadata and payload prove otherwise.
- Do not use reanalysis or a forecast provider's own historical reconstruction as ground-truth observation.
