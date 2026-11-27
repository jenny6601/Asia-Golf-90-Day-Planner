# Korea KMA ASOS Station Candidate Pipeline (1991–2020)

## Purpose
Build a metadata-only shortlist for the six Korea regional representative points in `jp-kr-official-acquisition-queue.json`. This does not approve stations and does not claim daily observation completeness.

## Official inputs
1. KMA Data Open Portal → Metadata → Station Information: https://data.kma.go.kr/tmeta/stn/selectStnList.do
2. Export the complete station-history CSV (not the first 10 rows shown in the web table).
3. Save it as `data/observation-stations/input/kma-station-metadata.csv`.\n4. In **파일셋 조회** (annual file-set catalog), select **일 자료**, export the complete result list including filenames such as `SURFACE_ASOS_108_DAY_1991_1991_2018.zip`, and save as `data/observation-stations/input/kma-asos-fileset-catalog.csv`.

The official metadata includes station number, observation start/end dates, coordinates and site elevation. Keep separate history rows for one station number; they may represent relocation or coordinate changes. The parser fails closed if no network/type column is present, and it excludes blank or non-ASOS labels.

## Ranking
- Require an explicit observation-network/type column in the source CSV.\n- Require a second official file-set catalog. Only station IDs with `DAY` archives overlapping 1991–2020 remain eligible; hourly/monthly/yearly archives do not satisfy this gate.\n- Record catalogued daily-file years per station. This is archive availability, not proof of complete PRCP/TMAX/TMIN values. Recognize ASOS or 종관 labels only; blank, AWS, and every unclassified row are excluded. If the classification column is absent, stop with an error rather than infer network membership.
- Do not treat a generic station-history inventory as an ASOS roster. Prefer the official ASOS-specific annual file-set catalog (`SURFACE_ASOS_(stationNo)_...`) as an independent cross-check of station IDs.
- Compute the union of each station's metadata date intervals intersecting 1991-01-01 through 2020-12-31.
- Rank by metadata-period coverage first, then great-circle distance.
- Retain elevation, coordinate-history count and coordinate-change count for review.
- Return at most 10 candidates within 100 km for each of six regions.

## Critical limitation
Metadata coverage and archive-year presence are not actual daily-data completeness. After shortlist creation, audit PRCP, TMAX and TMIN independently by year and season from official daily CSV or annual file-set downloads. Missing values must never be converted to zero. Preserve quality flags, station history and source provenance.

## Data access constraints
KMA documents that daily queries are limited to 10 years; use annual file-set downloads for longer periods. Do not scrape aggressively. The 1991–2020 daily record audit is a separate next gate.

## Approval gate
All output rows remain `stationApproved=false` and `weatherIngestionEnabled=false`. Only manual evidence review can approve a representative station.
