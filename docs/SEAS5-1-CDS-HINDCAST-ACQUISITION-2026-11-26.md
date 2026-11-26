# SEAS5.1 CDS hindcast acquisition specification — 2026-11-26

## Confirmed catalogue facts
Dataset: `seasonal-original-single-levels` — Seasonal forecast daily and subdaily data on single levels.
Catalogue page: https://cds.climate.copernicus.eu/datasets/seasonal-original-single-levels

The CDS catalogue states:
- Gridded global regular latitude/longitude data at 1° x 1°.
- Hindcasts and forecasts are available; the current overview reports hindcast coverage 1993–2016 and forecasts from 2017 onwards.
- Variables have native temporal resolutions: some 6-hour instantaneous, some 24-hour aggregations.
- 2m temperature, 10m u/v wind components and total precipitation are listed as variables.
- The catalogue form offers ECMWF system 51 and 6-hour lead-time selections.
- ECMWF SEAS5.1 hindcast must be paired with operational ECMWF system 51. Do not use legacy system 5 hindcasts with current system 51 forecasts.
- CDS requires account access and acceptance of licence/terms before submitting retrieval requests.

The ECMWF start-date table documents SEAS5 (C3Sv5.1) hindcasts 1981–2016 and operational forecasts from November 2022 onwards. CDS catalogue overview currently exposes 1993–2016 in its temporal coverage summary. Before selecting years, validate the actual dataset form/API availability by month and initialization date; do not assume every year/month/day combination exists.

## Proposed pilot extraction (not yet submitted)
Target: one Okinawa-area grid cell/area around the Southern Links pilot coordinate. The course coordinate remains provisional; the 1° grid is regional and must not be described as course-scale.

- Dataset ID: `seasonal-original-single-levels`
- Originating centre: ECMWF
- System: `51`
- Product: hindcast/reforecast dates only (not operational forecast dates)
- Variables:
  - Total precipitation (accumulation semantics must be checked in GRIB metadata)
  - 2m temperature (6-hour instantaneous)
  - 10m u-component and 10m v-component of wind (6-hour instantaneous)
- Hindcast initialization years: start with 1993–2016 for the catalogue's stated hindcast window; separately investigate 1981–1992 availability for ECMWF system 51 before expanding.
- Initialization months: all 12 months, subject to actual availability.
- Initialization day: use the valid ECMWF SEAS5 schedule documented by CDS, and query actual available dates; do not assume every calendar day.
- Lead times: request 6-hour steps corresponding to lead days 17–90 (lead hours 408 through 2160, inclusive, step 6), but first validate that all requested leads are offered for the selected variables and hindcast cycles.
- Format: GRIB preferred; NetCDF4 only if CDS marks it supported for the selected request.
- Spatial subset: smallest supported area containing the relevant 1° grid cell; retain returned grid coordinates and inspect actual nearest grid cell.

## Required metadata and QA after download
For every GRIB message retain:
- origin, system, initialization date, ensemble member, step/lead time, valid time
- shortName / paramId, units, stepType, startStep, endStep
- grid type, grid coordinates, latitude/longitude, data values
- source file name, retrieval request JSON, retrieval timestamp and checksum

Do not assume total precipitation at each lead time is a six-hour accumulation. Inspect GRIB metadata (stepType, startStep/endStep, units) to determine whether it is an interval accumulation or an accumulated-since-initialization field. If cumulative, difference consecutive lead times only after checking reset/forecast-step semantics and handling negative numerical artifacts transparently.

## Verification pairing
- Use ERA5 hourly / 6-hourly reanalysis as a gridded verification proxy only, with an explicit reanalysis caveat; prioritize quality-controlled station observations if available.
- Convert time zones only after pairing in UTC. Display golf windows in Asia/Tokyo.
- Align valid times exactly and aggregate the verification reference to the same 6-hour windows.
- Never disaggregate daily/monthly observations into 6-hour truth.

## Access gate — outstanding
This environment has not authenticated to CDS and no CDS credentials or licence acceptance were supplied. Therefore no hindcast request has been submitted and no hindcast files have been downloaded. The next executable action requires the user to have an active CDS account, accept the dataset terms, and supply a CDS API key as a GitHub Actions secret (for example `CDSAPI_KEY`) or run the request locally. Never place the key in repository code or logs.

## Go / no-go
Proceed to a small pilot retrieval (one initialization month, a few years, a small area, a limited set of leads and members) only after credentials are configured. Validate the returned GRIB messages and accumulation semantics before requesting the full 1993–2016 archive.
