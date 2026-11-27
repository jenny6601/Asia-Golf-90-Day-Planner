# Okinawa Seasonal Monthly Context

## Purpose
Display two independent sources side by side for the three Okinawa regions:
1. ECMWF seasonal precipitation anomaly direction relative to the model's own hindcast climatology.
2. ERA5 recent ten-year monthly precipitation distribution (P10, median, P90).

## Signal interpretation
- Positive ECMWF precipitation anomaly: wetter than the ECMWF model climatology.
- Negative: drier than the ECMWF model climatology.
- Zero: near the ECMWF model climatology.
- Missing/non-finite values: unknown.

## Important separation
ECMWF anomaly and ERA5 historical distribution are different reference systems. They must not be subtracted, merged into a single score, or described as calibrated probabilities. ERA5 is an independent climate context only.

## Output
- `data/okinawa/seasonal-monthly-context/YYYY-MM-DD.json`
- `data/okinawa/seasonal-monthly-context/YYYY-MM-DD.md`

No App UI changes and no daily forecast inference.
