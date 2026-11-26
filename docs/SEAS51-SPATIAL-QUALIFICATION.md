# SEAS5.1 spatial representativeness for long-range guidance

## Purpose

SEAS5.1 D17-D90 products are used for regional climate signals and date-planning guidance, not deterministic daily weather at an individual fairway. A course coordinate that is reasonably nearby is generally sufficient to associate the course with its broad regional weather regime. Coordinates do not need survey-grade or green-level precision.

## Policy

- The 35 km distance is an advisory diagnostic, not a hard acceptance threshold.
- Nearby grid cells and approximate course coordinates may be used as regional proxies; distance and coordinate provenance remain visible in the report.
- Provisional coordinates are allowed for regional guidance but remain labeled provisional.
- Out-of-area and missing-coordinate courses are still coverage gaps; the system must not fabricate records for them.
- This regional proxy status does not establish course-level observation accuracy, forecast skill, or justify bias correction.
- Keep forecast, hindcast, reanalysis and climatology semantics distinct.
- Do not change the approved CDS request area or retrieval scope as part of this policy.

## Run

```bash
python scripts/assess_seas51_spatial_qualification.py --batch artifacts/seas51-normalized-archive-batch.json --extract-manifest artifacts/seas51-course-point-extract-manifest.json --output artifacts/seas51-spatial-qualification.json
python -m unittest discover -s tests -p "test_assess_seas51_spatial_qualification.py" -v
```

## Interpretation

A `regional-proxy-usable` status means there are records for the requested course set and no coordinate/distance advisory flags. `regional-proxy-usable-with-advisory-review` means records remain usable for regional D17-D90 context, while approximate coordinates or larger grid distances are disclosed. `regional-proxy-usable-with-coverage-gaps` means some requested courses could not be represented and must be shown as missing coverage. None of these statuses is a forecast-skill score.
