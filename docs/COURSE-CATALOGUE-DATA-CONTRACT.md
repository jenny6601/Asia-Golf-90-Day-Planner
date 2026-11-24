# Asia Golf course catalogue data contract

## Purpose
A country-neutral record format for the Asia Golf 90-Day Planner. Every course belongs to one of the eight approved destination countries. Forecast requests are permitted only when course-level GPS coordinates and their provenance are verified.

## Required fields

| Field | Meaning | Rule |
|---|---|---|
| `id` | Stable course identifier | Unique, URL-safe identifier |
| `countryCode` | ISO 3166-1 alpha-2 | JP, KR, CN, VN, TH, MY, SG, ID only |
| `region` | First-level region / prefecture / province | Required |
| `city` | City / district / township | Required |
| `courseName` | Display name | Required |
| `timezone` | Course-local IANA timezone | Required; never use device timezone |
| `latitude`, `longitude` | Course location | Both numeric or both null; geographic bounds enforced |
| `coordinateSource` | Evidence source for GPS | Required for provisional / verified coordinates |
| `coordinateVerifiedAt` | Verification date | Required only for verified coordinates |
| `coordinateStatus` | GPS evidence state | verified / provisional / pending |
| `officialUrl` | Official club website | HTTPS only when present |
| `coordinateSourceUrl` | Evidence URL | Optional |
| `providerAvailability` | Provider readiness per course | Separate per-provider state; no implied availability |
| `dataStatus` | Catalogue readiness | ready / needs-verification / pending |

## Coordinate state machine
- **verified**: numeric latitude and longitude, a traceable source, and a verification date. Eligible for forecast requests.
- **provisional**: numeric coordinates and a source, but not yet verified against official club mapping or authoritative location evidence. Visible in the catalogue but not eligible for production date recommendations.
- **pending**: no numeric coordinates. Visible as a catalogue record but unavailable for forecast requests.

A provider grid-point offset is not evidence that the course coordinate itself is correct.

## Timezone rules
Use an explicit IANA timezone on every course. Do not infer timezone from the user's locale. In Indonesia, timezone must be selected per course (for example, Asia/Jakarta, Asia/Makassar, or Asia/Jayapura); never assign one country-wide default. Even where a country commonly uses one timezone, retain the per-course field.

## Provider state
Use independent status values for Open-Meteo, Visual Crossing and Foreca (for example: available, pending, unavailable, error). Do not treat an API key existing as proof that a specific course/provider forecast is available.

## Current Okinawa pilot mapping
The existing six Okinawa course records are normalized into this schema without fabricating provenance:
- Five records have provisional coordinates from third-party mapping sources.
- PGM Golf Resort Okinawa has pending coordinates and is excluded from forecast selection.
- No Okinawa record is currently marked verified by this schema; therefore the catalogue is not yet production-ready for automatic booking-date decisions.

## Adding a course
1. Confirm the official course name and official club website.
2. Confirm region, city and postal address.
3. Obtain course-point coordinates from an authoritative or clearly traceable source.
4. Verify the point against official club mapping / course entrance or polygon.
5. Confirm the exact IANA timezone for that point.
6. Set `coordinateStatus` and `coordinateVerifiedAt` only according to the evidence.
7. Add per-provider readiness after actual data checks.
8. Run `npm test`; only then expose the record to forecast workflows.
