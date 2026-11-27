# Long-range data inventory and readiness gate

## Purpose
Inventory only source data files physically present in the repository checkout. This is a read-only audit; it does not download, infer, synthesize or activate weather data.

## What counts as acquired data
- ERA5-Land daily JSON with actual dated regional records counts as historical daily input.
- A manifest, representative-point audit, station list or station metadata does not count as acquired historical weather.
- A forecast snapshot counts only for variables and valid periods physically present in that snapshot.
- Weekly/monthly forecast arrays do not count as daily-shaped forecasts or hindcasts.
- A forecast snapshot is not a multi-cycle archive and does not establish forecast skill.

## Readiness gates
| Horizon | Required inputs before daily generation |
|---|---|
| D17-D18 | Overlapping ECMWF extended-range weekly ensemble signal plus historical daily sequence prior; transition-band backtest |
| D19-D46 | ECMWF weekly ensemble cycles and matching hindcasts, plus historical daily sequences |
| D47-D90 | C3S multi-system monthly forecasts and matching hindcasts, plus historical daily sequences |

All horizons fail closed when required inputs are absent. Never copy D16 values forward, fill missing rainfall with zero, or produce invented daily rain probabilities.

## Output
The build_long_range_data_inventory.py script writes JSON and Markdown under data/long-range-readiness/. GitHub Actions uploads both as an artifact. The report is not consumed by the App and does not modify UI or D01-D16.
