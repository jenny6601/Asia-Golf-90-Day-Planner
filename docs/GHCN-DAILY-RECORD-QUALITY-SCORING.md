# GHCN-Daily Actual Record Quality Scoring (1991–2020)

## Purpose
Convert the bounded NOAA GHCN-Daily record audit into an element-wise quality tier for each station/region candidate. This is a data-quality screen, not station approval and not automatic weather ingestion.

## Denominator and missing-data treatment
- Fixed calendar denominator: 10,958 days from 1991-01-01 through 2020-12-31.
- A day counts only when the element has a valid, unflagged GHCN-Daily value.
- Flagged values do not count as valid. Unrepresented dates remain part of the calendar denominator and therefore reduce coverage.
- PRCP, TMAX and TMIN are evaluated independently. One element cannot compensate for another.

## Quality tiers
- **Robust:** all three elements have at least 90% valid coverage over the full 30-year calendar period and at least 24 of 30 years with at least 80% annual coverage.
- **Acceptable:** all three elements have at least 80% full-period coverage and at least 20 of 30 years with at least 80% annual coverage.
- **Limited:** all three elements have at least one valid record, but the station does not meet the acceptable threshold.
- **Unusable:** at least one required element has no valid records.

These are conservative screening thresholds. Regional representativeness, station relocation, exposure changes, instrument changes and source cross-checks remain separate approval gates.

## Output
`ghcnd-daily-record-quality-1991-2020.json` includes per station/region:
- full-period valid coverage percentage for PRCP/TMAX/TMIN;
- number of years with at least 80% annual coverage for each element;
- flagged-day counts;
- quality tier and region-level best candidate ranking.

All rows remain `stationApproved=false` and `weatherIngestionEnabled=false`.

## Workflow
Run after `validate_ghcnd_daily_record_coverage.py`:
`python scripts/score_ghcnd_daily_record_quality.py`

This report must be reviewed before selecting representative stations. A candidate having some valid values for all elements is not equivalent to having a complete 30-year climate baseline.
