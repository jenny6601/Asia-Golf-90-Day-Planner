# JMA Daily Observation Audit Priority Queue

The queue converts the official JMA station-history cross-check into a deduplicated ObsDL acquisition list. It selects up to three candidate stations per Japanese subregion and deduplicates station IDs across regions.

Ranking order:
1. Official station identity matched.
2. Higher minimum PRCP/TEMP metadata coverage during 1991–2020.
3. Fewer statistical discontinuities whose segment boundaries fall inside 1991–2020.
4. Shorter distance to the regional representative point.

This is only a request-prioritization list. Metadata capability is not proof of daily observation coverage. Each selected station still requires JMA ObsDL daily PRCP/TMAX/TMIN exports with per-element quality codes. The queue never approves a station or enables ingestion.

Run:
```bash
python scripts/build_jma_daily_audit_priority_queue.py --top-n 3
```
