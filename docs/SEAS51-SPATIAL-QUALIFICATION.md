# SEAS5.1 course spatial qualification gate

## Purpose

Before CDS hindcast records are paired with ERA5 or used in any course-level metric, this gate evaluates the representativeness of their nearest-grid locations and the status of course coordinates.

## Acceptance rules

A batch passes only when every record has a nearest-grid distance at or below 35 km, every course coordinate is marked verified, and the extraction manifest reports no out-of-area or missing-coordinate course.

Records outside 35 km are retained for traceability but fail the spatial qualification gate. Provisional coordinates also fail. Courses outside the GRIB grid and courses omitted for missing coordinates are explicitly reported.

## Run

```bash
python scripts/assess_seas51_spatial_qualification.py --batch artifacts/seas51-normalized-archive-batch.json --extract-manifest artifacts/seas51-course-point-extract-manifest.json --output artifacts/seas51-spatial-qualification.json
python -m unittest discover -s tests -p "test_assess_seas51_spatial_qualification.py" -v
```

## Interpretation

Passing this gate only means spatial inputs are sufficiently qualified for the next verification stage. It does not establish forecast skill. A nearest grid point is not a course-wide spatial average. The tool does not change the approved CDS request area or any retrieval parameters.
