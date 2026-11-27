#!/usr/bin/env python3
"""Build a deduplicated JMA ObsDL daily-audit priority queue from official history checks."""
import argparse
import json
from collections import defaultdict
from pathlib import Path

def rank_candidate(x):
    coverage = min(
        x.get("officialPrecipitationMetadataCoveragePct", 0),
        x.get("officialTemperatureMetadataCoveragePct", 0)
    )
    breaks = x.get("precipitationStatisticalBreakCount", 0) + x.get("temperatureStatisticalBreakCount", 0)
    distance = x.get("candidateDistanceKm")
    return (
        0 if x.get("officialHistoryMatch") else 1,
        -coverage,
        breaks,
        float(distance) if distance is not None else 1e9,
        str(x.get("stationId", ""))
    )

def classify(x):
    if not x.get("officialHistoryMatch"):
        return "official-station-unmatched"
    if x.get("mirrorHistoryIntervalMismatch"):
        return "history-interval-mismatch"
    if x.get("precipitationStatisticalBreakCount", 0) or x.get("temperatureStatisticalBreakCount", 0):
        return "continuity-break-review"
    if min(x.get("officialPrecipitationMetadataCoveragePct", 0),
           x.get("officialTemperatureMetadataCoveragePct", 0)) >= 100:
        return "metadata-full-period"
    return "metadata-partial-period"

def build_queue(report, top_n=3):
    regions = []
    unique = {}
    all_rows = 0
    for region in report.get("regions", []):
        ranked = sorted(region.get("candidates", []), key=rank_candidate)
        all_rows += len(ranked)
        selected = []
        for rank, candidate in enumerate(ranked[:top_n], 1):
            item = {
                "stationId": candidate["stationId"],
                "officialNameJa": candidate.get("officialNameJa"),
                "candidateDistanceKm": candidate.get("candidateDistanceKm"),
                "precipitationMetadataCoveragePct": candidate.get("officialPrecipitationMetadataCoveragePct", 0),
                "temperatureMetadataCoveragePct": candidate.get("officialTemperatureMetadataCoveragePct", 0),
                "precipitationStatisticalBreakCount": candidate.get("precipitationStatisticalBreakCount", 0),
                "temperatureStatisticalBreakCount": candidate.get("temperatureStatisticalBreakCount", 0),
                "historyIntervalMismatch": candidate.get("mirrorHistoryIntervalMismatch", False),
                "metadataStatus": classify(candidate),
                "dailyAuditPriority": rank,
                "dailyDataVerified": False,
                "stationApproved": False
            }
            selected.append(item)
            sid = item["stationId"]
            if sid not in unique:
                unique[sid] = {
                    "stationId": sid, "officialNameJa": item["officialNameJa"],
                    "metadataStatus": item["metadataStatus"],
                    "precipitationMetadataCoveragePct": item["precipitationMetadataCoveragePct"],
                    "temperatureMetadataCoveragePct": item["temperatureMetadataCoveragePct"],
                    "precipitationStatisticalBreakCount": item["precipitationStatisticalBreakCount"],
                    "temperatureStatisticalBreakCount": item["temperatureStatisticalBreakCount"],
                    "historyIntervalMismatch": item["historyIntervalMismatch"],
                    "assignedSubregions": [], "bestPriorityRank": rank,
                    "dailyDataVerified": False, "stationApproved": False
                }
            u = unique[sid]
            u["assignedSubregions"].append(region.get("subregionId"))
            u["bestPriorityRank"] = min(u["bestPriorityRank"], rank)
            # Keep the strongest metadata status when the same station serves multiple subregions.
            order = {"metadata-full-period": 0, "metadata-partial-period": 1,
                     "continuity-break-review": 2, "history-interval-mismatch": 3,
                     "official-station-unmatched": 4}
            if order[item["metadataStatus"]] < order[u["metadataStatus"]]:
                u["metadataStatus"] = item["metadataStatus"]
        regions.append({
            "subregionId": region.get("subregionId"),
            "subregionLabel": region.get("subregionLabel"),
            "candidateRows": len(ranked),
            "priorityStations": selected,
            "primaryStationId": selected[0]["stationId"] if selected else None,
            "status": "daily-observation-audit-pending"
        })
    stations = sorted(unique.values(), key=lambda x: (x["bestPriorityRank"], x["stationId"]))
    return {
        "schemaVersion": 1,
        "status": "jma-daily-audit-priority-queue-not-yet-observed",
        "source": "JMA official amdmaster.index4 cross-check report",
        "period": report.get("period"),
        "selectionPolicy": [
            "Official station identity match first",
            "Higher minimum of PRCP/TEMP metadata coverage over 1991-2020",
            "Fewer in-period statistical discontinuities",
            "Shorter distance to the regional representative point"
        ],
        "dailyAuditRequirements": ["daily precipitation total", "daily maximum temperature",
                                   "daily minimum temperature", "per-element JMA quality codes"],
        "summary": {
            "japanSubregions": len(regions), "candidateRowsConsidered": all_rows,
            "priorityRowsAcrossRegions": sum(len(x["priorityStations"]) for x in regions),
            "uniqueStationsToAudit": len(stations),
            "regionsWithPrimaryStation": sum(bool(x["primaryStationId"]) for x in regions),
            "dailyDataVerifiedStations": 0, "approvedStations": 0,
            "weatherIngestionEnabled": 0
        },
        "uniqueStationQueue": stations,
        "regions": regions
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="data/observation-stations/jma-official-history-crosscheck-1991-2020.json")
    ap.add_argument("--output", default="data/observation-stations/jma-daily-audit-priority-queue-1991-2020.json")
    ap.add_argument("--top-n", type=int, default=3)
    args = ap.parse_args()
    if args.top_n < 1:
        ap.error("--top-n must be >= 1")
    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    result = build_queue(report, args.top_n)
    p = Path(args.output); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False))

if __name__ == "__main__":
    main()
