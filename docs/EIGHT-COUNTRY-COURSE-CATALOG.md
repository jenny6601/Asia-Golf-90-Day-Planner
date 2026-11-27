# Eight-Country Golf Course Catalog

## Purpose
Maintain the app-facing golf-course directory separately from the 62-subregion climate registry. A course record belongs to exactly one subregion. Multiple actual courses may belong to the same subregion and share its regional climate assessment.

## Initial seed status
- 65 course records
- 6 active Okinawa course records retained
- 59 regional research-candidate records imported
- 62 climate subregions
- Country coverage: JP 22, KR 6, CN 7, VN 6, TH 7, MY 8, SG 1, ID 8

This is an initial representative-course seed, **not a complete inventory of every operating golf course** in the eight countries. Candidate records are not presented as fully verified courses.

## Record policy
- `id`: stable unique identifier.
- `countryCode`: one of JP, KR, CN, VN, TH, MY, SG, ID.
- `region`: user-facing subregion label used by the existing country/region selector.
- `regionGroup`: broader geographic grouping.
- `subregionId`: exact key from `weather-subregions.json`.
- `catalogStatus`: `active` or `research_candidate`.
- `weatherEnabled`: explicit eligibility marker for future integrations.
- Candidate coordinates are retained under `candidateCoordinates`; they are not copied into top-level latitude/longitude while pending.
- Pending courses remain visible in the directory but the existing app disables their weather query because their top-level coordinate status is pending.

## Completion criteria
A country/subregion is not complete merely because one representative candidate exists. Full inventory completion requires all selected/confirmed operating courses to be listed, each mapped to exactly one subregion, duplicate identities reconciled, official identity and operating status checked, and coordinates/timezone reviewed. Climate assessment remains one representative point per subregion; it does not require separate weather ingestion for every course.

## Current limitations
The repository's historical registry contains candidate names and candidate points for 59 subregions and three Okinawa subregions. The user-confirmed full list of every course in every subregion was not present in the prior conversation records retrieved for this integration. Accordingly, this commit imports the existing candidate seed without inventing additional course names or marking candidates as verified.
