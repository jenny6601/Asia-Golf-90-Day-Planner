# C3S GRIB precipitation semantics and sample QA

Assessment date: 2026-11-23  
Dataset: `seasonal-original-single-levels`  
Variable: `total_precipitation`  
Pilot request: NCEP / System 2 / 2026-11-01 / Okinawa box / 24–2160 h / GRIB

## Critical interpretation

The CDS parameter catalogue describes `total_precipitation` as metres of water equivalent with **24-hour aggregation since beginning of forecast**. This is a cumulative-from-initialization field, not a stand-alone daily amount at every selected lead time.

Therefore, the 90 selected lead times (24, 48, ..., 2160 h) produce 90 cumulative values per grid/member when the source actually contains all requested steps. They must not be summed as 90 daily rainfall values.

For a single member/grid point, derive daily increments only after confirming the GRIB time metadata:

- Day 1 amount: cumulative value at 24 h.
- Day d amount for d > 1: cumulative(d × 24 h) minus cumulative((d − 1) × 24 h).
- Preserve the original cumulative field and the derived increment as separate values.
- Do not silently clamp negative differences to zero. Flag them and inspect step range, accumulation reset, missing lead, and message identity.
- Verify that the first selected field represents the 0–24 h accumulation and that each subsequent field represents accumulation from forecast start through the stated lead time. If the GRIB metadata contradicts this, stop normalization and revise the method.

The exact parameter metadata is available in the CDS dataset Overview: https://cds.climate.copernicus.eu/datasets/seasonal-original-single-levels?tab=overview

## Lead-time and date interpretation

CDS defines leadtime hour as the offset in hours from the model initialization date. Thus `valid_time = initialization + leadtime_hour`. For a daily accumulation ending at lead day d, record the interval end and the corresponding 24-hour interval explicitly; do not infer local civil-day rainfall without a timezone/calendar rule.

Official form guidance: https://confluence.ecmwf.int/pages/viewpage.action?pageId=129106372

## GRIB sample acceptance checks

Before any data are normalized or used for trip scoring, record and validate:

1. Dataset, originating centre, system, initialization date, retrieval timestamp and request payload.
2. GRIB edition, parameter identity (shortName/paramId), units, type of level, grid type and coordinates.
3. Forecast reference time, step/stepRange, startStep/endStep, statistical processing and valid time for every message.
4. Member/perturbation identity; do not assume ensemble size or member numbering.
5. Presence of every requested 24-hour lead time from 24 through 2160 hours.
6. Expected Okinawa grid coverage, actual unique latitude/longitude coordinates, and duplicate message detection.
7. Units: retain native metres in raw records; convert derived daily increments to mm only in a documented normalization step.
8. Cumulative series sanity: non-negative cumulative values, expected monotonicity, and no unexplained resets. A violation is a QA failure, not a value to repair silently.
9. Daily increment sanity: no unexplained negative increments; missing lead times remain missing and invalidate dependent differences.
10. Coverage summary by lead day, grid cell and member. Do not treat grid cells or ensemble members as independent forecast centres.

## Pilot request caveats

- The supplied request is one NCEP System 2 initialization only. It is not yet a multi-centre consensus sample.
- The initialization date 2026-11-01 is earlier than the current assessment date 2026-11-23. It can only be treated as a retrospective/sample retrieval, not a current 90-day forecast.
- The request selecting 24-hour lead intervals through 2160 h establishes the requested lead-time list; it does not guarantee every message is present in the returned GRIB.
- The 1-degree seasonal grid is not golf-course resolution.
- A matched hindcast sample from the exact same originating centre and system is required before estimating calibrated probabilities or using the data in candidate rankings.

## Current gate

No CDS file has been supplied or retrieved in this workspace. Consequently, no claim is made about actual NCEP System 2 message count, ensemble member count, Okinawa grid count, or data availability for this request. Do not add a production adapter or change the recommendation engine until the raw GRIB passes the checks above and a matched hindcast is available.
