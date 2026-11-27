# ERA5-Land Full-Dataset Pilot — Operator Runbook

## Purpose
Run one controlled ERA5-Land full-dataset acquisition for one current regional representative point and one calendar year. This is a pilot only. It does not aggregate daily climate records or activate D17–D90.

## One-time repository setup
1. Open the repository Settings.
2. Go to Secrets and variables → Actions.
3. Create a repository secret named \`CDS_API_KEY\`.
4. Use the API key issued by the Copernicus Climate Data Store account. Do not place the key in source files, workflow inputs, commit messages, issues, or chat.
5. Confirm that the CDS account has accepted the terms for the \`reanalysis-era5-land\` dataset and can submit retrieval requests.

## Run the one-point / one-year pilot
1. Open Actions → ERA5-Land Full Dataset Regional Pilot.
2. Select Run workflow.
3. Keep the branch set to \`asia-eight-country-shared-engine\`.
4. For the first run, use:
   - Subregion: \`JP-OKI-MAIN-NORTH\`
   - Year: \`1991\`
5. Start the workflow and inspect the job logs.
6. Download the artifact named \`era5-land-JP-OKI-MAIN-NORTH-1991-full-dataset-pilot\`.

## What a successful pilot means
A successful acquisition and structural inspection confirms that:
- CDS returned a non-empty ZIP archive containing GRIB data.
- The five required ERA5-Land variables were detected.
- Returned grid coordinates were extracted and compared with the regional candidate grid.
- Precipitation accumulation metadata was retained for a separate semantics review.

It does **not** yet confirm:
- complete hourly timestamp coverage;
- correct local-calendar daily aggregation;
- a valid land cell or representative regional climate;
- independent observational agreement;
- eligibility for the 1991–2020 climate baseline or D17–D90 decision engine.

The current pilot intentionally leaves aggregation and production eligibility disabled. Do not treat structural inspection as climate QA.

## Failure handling
- Missing \`CDS_API_KEY\`: no request is submitted. Add the secret in repository settings and rerun.
- CDS licence / terms failure: resolve the dataset terms in the CDS account; do not bypass them.
- Retrieval failure or timeout: inspect the CDS request status and workflow logs before retrying.
- Missing variables, no GRIB members, or unexpected grid: retain the report and stop; do not aggregate or substitute another point silently.
- Never paste API credentials into an issue or chat.

## Scale-up gate
Do not launch the 80-region × 30-year acquisition until the first pilot has passed:
1. GRIB metadata and returned-grid review;
2. full hourly timestamp coverage validation;
3. precipitation accumulation interpretation against the ERA5-Land full-dataset documentation;
4. timezone-aware daily aggregation boundary tests;
5. independent regional plausibility review.

Only then create a resumable, rate-limited production acquisition schedule. Keep the eight-country registry and D01–D16 unchanged.
