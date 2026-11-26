# Regional location handling for D17-D90 golf-weather guidance

## Product rule

For forecasts beyond 16 days, the system only needs weather guidance representative of the area around the selected golf course. Nearby course coordinates or a nearby source grid point are acceptable. Exact fairway/green coordinates and survey-grade accuracy are not required.

## Implementation

- Use the existing course location or a nearby available grid point to associate the course with regional guidance.
- Keep the selected grid location and distance as traceable metadata where available.
- Treat the 35 km value as a diagnostic only, never as a hard rejection rule for D17-D90 regional guidance.
- Approximate/provisional coordinates may be used; do not delay the project to refine them.
- If a course is genuinely outside source coverage, show that coverage limitation. Never fabricate a forecast value.
- Do not spend further work cycles on coordinate research unless it directly blocks data retrieval or produces a materially different regional weather signal.

## Interpretation

This association is intended for date-planning and regional weather tendencies, not exact on-course observations or deterministic daily forecasts. Spatial metadata does not establish forecast skill. Forecast, hindcast, reanalysis and climatology must remain clearly distinguished.
