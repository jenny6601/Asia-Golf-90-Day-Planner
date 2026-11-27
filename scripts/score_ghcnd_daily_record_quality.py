#!/usr/bin/env python3
"""Score actual GHCN-Daily completeness for PRCP/TMAX/TMIN, without approval."""
import argparse
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ELEMENTS = ("PRCP", "TMAX", "TMIN")
START = date(1991, 1, 1)
END = date(2020, 12, 31)
TOTAL_DAYS = (END - START).days + 1

def classify_station(element_coverage):
    pct = {}
    years80 = {}
    for element in ELEMENTS:
        item = element_coverage[element]
        pct[element] = item["validDays"] / TOTAL_DAYS * 100
        years80[element] = item["yearsAtLeast80Pct"]
    if all(pct[e] >= 90 and years80[e] >= 24 for e in ELEMENTS):
        tier = "robust"
    elif all(pct[e] >= 80 and years80[e] >= 20 for e in ELEMENTS):
        tier = "acceptable"
    elif all(element_coverage[e]["validDays"] > 0 for e in ELEMENTS):
        tier = "limited"
    else:
        tier = "unusable"
    return tier, pct, years80

def build_report(audit):
    stations = []
    by_region = defaultdict(list)
    tiers = Counter()
    sums = Counter()
    for raw in audit.get("stations", []):
        tier, pct, years80 = classify_station(raw["elementCoverage"])
        row = {
            "countryCode": raw["countryCode"],
            "subregionId": raw["subregionId"],
            "stationId": raw["stationId"],
            "stationName": raw.get("name"),
            "distanceKm": raw.get("distanceKm"),
            "qualityTier": tier,
            "elementCoveragePct": {e: round(pct[e], 2) for e in ELEMENTS},
            "yearsAtLeast80Pct": years80,
            "flaggedDays": {e: raw["elementCoverage"][e]["flaggedDays"] for e in ELEMENTS},
            "stationApproved": False,
            "weatherIngestionEnabled": False
        }
        stations.append(row)
        by_region[row["subregionId"]].append(row)
        tiers[tier] += 1
        for e in ELEMENTS:
            sums[e] += pct[e]
    regions = []
    for region_id, rows in sorted(by_region.items()):
        rows.sort(key=lambda x: (
            {"robust": 0, "acceptable": 1, "limited": 2, "unusable": 3}[x["qualityTier"]],
            -min(x["elementCoveragePct"].values()),
            x["distanceKm"] if x["distanceKm"] is not None else 1e9
        ))
        best = rows[0]
        regions.append({
            "subregionId": region_id,
            "countryCode": best["countryCode"],
            "auditedCandidateCount": len(rows),
            "robustCount": sum(x["qualityTier"] == "robust" for x in rows),
            "acceptableCount": sum(x["qualityTier"] == "acceptable" for x in rows),
            "bestCandidate": best
        })
    n = len(stations)
    return {
        "schemaVersion": 1,
        "status": "ghcnd-daily-record-quality-scored-not-station-approved",
        "source": "NOAA GHCN-Daily audit; actual valid daily records only",
        "period": {"start": START.isoformat(), "end": END.isoformat(), "calendarDays": TOTAL_DAYS},
        "requiredElements": list(ELEMENTS),
        "tierRules": {
            "robust": "Each element >=90% of all calendar days and >=24 of 30 years with >=80% annual coverage",
            "acceptable": "Each element >=80% of all calendar days and >=20 of 30 years with >=80% annual coverage",
            "limited": "All three elements have some valid records but do not meet acceptable threshold",
            "unusable": "At least one required element has zero valid days"
        },
        "summary": {
            "auditedStationRegionRows": n,
            "qualityTierCounts": dict(tiers),
            "regionsAudited": len(regions),
            "regionsWithRobustCandidate": sum(x["robustCount"] > 0 for x in regions),
            "regionsWithAcceptableCandidate": sum(x["acceptableCount"] > 0 for x in regions),
            "meanValidCoveragePctByElement": {e: round(sums[e] / n, 2) if n else 0 for e in ELEMENTS},
            "approvedStations": 0,
            "weatherIngestionEnabled": 0
        },
        "regions": regions,
        "stations": stations
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="data/observation-stations/ghcnd-daily-record-audit-1991-2020.json")
    ap.add_argument("--output", default="data/observation-stations/ghcnd-daily-record-quality-1991-2020.json")
    args = ap.parse_args()
    audit = json.loads(Path(args.input).read_text(encoding="utf-8"))
    report = build_report(audit)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))

if __name__ == "__main__":
    main()
