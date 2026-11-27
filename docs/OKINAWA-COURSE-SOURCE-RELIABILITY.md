# Okinawa Six-Course Source Reliability Projection

## Purpose
Project station/model hindcast evidence onto the six Okinawa pilot courses without claiming on-course forecast skill.

## Inputs
- Daily reports in `data/okinawa/model-hindcast-archive/`.
- Four station coordinates and observed-element metadata in `config/okinawa/jma-amedas-stations.json`.
- Six course coordinates from `config/global/courses.json`.
- Variable-specific station assignments in `config/okinawa/course-station-assignments.json`.

## Method
- Deduplicate forecast/observation pairs by model, station, lead, variable and valid timestamp, preferring the latest generated report.
- Compute station-level MAE, bias and RMSE; precipitation also reports POD, FAR and CSI at >=1 mm/hour.
- Transfer station metrics to the assigned course as proxy evidence. Distances use haversine distance.
- If multiple stations are assigned in a future revision, use normalized inverse-square distance weights. Current variable assignments contain one station each, so the weight is 1.0.
- Flag a proxy farther than 15 km as weak. This is a transparent screening flag, not a meteorological representativeness proof.
- Mark evidence provisional only after >=200 pairs and >=30 distinct valid dates; precipitation also requires >=10 observed wet hours.
- Retain Previous Runs API previous_day lead semantics; do not relabel this as verified issue-time lead.

## Limitations
No course-level observation sensors or reliable course elevations are available in this stage. No elevation correction, bias correction, source blending, production score changes or UI changes are made. Rain accumulation alignment remains a validation caveat. A station proxy is not ground truth at the golf course.
