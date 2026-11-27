# JMA Official AMeDAS Station History Cross-check

## Official source
JMA publishes the AMeDAS station information history file `amdmaster.index4`. It is a CSV history dataset sorted by station number and observation start date. The official format defines 33 fields and records station identity, names, coordinates, elevation, element availability, effective dates, old station ID, and element-specific statistical continuity flags.

Official format references:
- https://www.data.jma.go.jp/obd/stats/data/mdrr/man/amdmasterindex4_format.pdf
- https://www.data.jma.go.jp/stats/data/mdrr/man/kansoku_gaiyou.html

## Input
Download the official `amdmaster.index4` file from JMA's station-history metadata page. Save it as:
`data/observation-stations/input/amdmaster.index4`

The parser accepts UTF-8 or CP932 and requires exactly 33 CSV fields for each numeric station record. It fails closed on unknown capability or continuity codes.

## Fields used (1-based)
- 1: station ID
- 2: Japanese station name
- 8–10: representative latitude, longitude, elevation
- 17: precipitation availability
- 19: temperature availability
- 24–25: segment start/end dates
- 26: old station ID
- 27: precipitation statistical continuity
- 29: temperature statistical continuity

Continuity codes are interpreted separately by element. Precipitation: 0 connected, 1 disconnected. Temperature: 0 connected, 1 disconnected, 4 connected with correction, 5 disconnected due to relocation. JMA notes that the first-ever station segment may carry a 1 or 5 marker despite having no predecessor; that initial marker is excluded from discontinuity counts. A continuity code applies at the segment boundary, so only breaks whose segment start date falls within 1991–2020 are counted in this period. The report counts metadata coverage and discontinuities; it does not claim actual daily observations exist.

## Run
```bash
python scripts/audit_jma_station_history.py --catalog data/observation-stations/input/amdmaster.index4
```

## Approval gate
The output always sets `stationApproved=false` and `weatherIngestionEnabled=false`. Approval additionally requires actual ObsDL daily PRCP/TMAX/TMIN quality audit, station exposure/relocation review, and regional representativeness.
