# SEAS5.1 GRIB native grid geometry audit

## Purpose
Capture the actual grid definition encoded in each GRIB message before interpreting course-to-grid distances. The report records grid type, dimensions, number of points, first/last coordinates, i/j increments and scanning flags. It counts distinct geometry signatures to detect inconsistent grids within one retrieved file.

## Why this is required
The current Okinawa pilot retained 1,300 records but all nearest-grid distances exceeded the 35 km review threshold. Before attributing this to course-coordinate error or requesting another dataset, inspect the native GRIB grid spacing and bounds. Course coordinate corrections cannot make a coarse grid become high resolution.

## Run
python scripts/audit-seas51-grib.py

The machine-readable output adds gridGeometry and gridGeometrySignatureCount. The audit is read-only and does not change the approved CDS request area, variables, initialization date or lead hours.
