#!/usr/bin/env python3
"""Cross-check JMA AMeDAS candidate stations against official amdmaster.index4.

The official file is a 33-column CSV history file. This audit verifies station
identity, historical configuration dates, element availability and statistical
continuity flags. It never approves a station or enables ingestion.
"""
import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

START = date(1991, 1, 1)
END = date(2020, 12, 31)
DAYS = (END - START).days + 1

def parse_date(value, allow_open=False):
    value = (value or "").strip()
    if allow_open and value in {"9999-99-99", "99999999", "9999/99/99"}:
        return date.max
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%Y/%m/%d"):
        try:
            return date.fromisoformat(value) if fmt == "%Y-%m-%d" else __import__("datetime").datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Invalid JMA history date: {value!r}")

def parse_index4(text):
    rows = csv.reader(text.lstrip("\ufeff").splitlines())
    stations = defaultdict(list)
    for line_no, row in enumerate(rows, 1):
        if not row or not row[0].strip():
            continue
        station_id = row[0].strip()
        if not station_id.isdigit():
            continue
        if len(row) != 33:
            raise ValueError(f"amdmaster.index4 line {line_no}: expected 33 CSV fields, got {len(row)}")
        start = parse_date(row[23])
        end = parse_date(row[24], allow_open=True)
        if end < start:
            raise ValueError(f"amdmaster.index4 line {line_no} station {station_id}: end date {row[24]!r} precedes start date {row[23]!r}; parsed {start.isoformat()}..{end.isoformat()}")
        precip = row[16].strip()
        temp = row[18].strip()
        precip_link = row[26].strip()
        temp_link = row[28].strip()
        if precip not in {"0", "1"} or temp not in {"0", "1"}:
            raise ValueError(f"amdmaster.index4 line {line_no}: unknown PRCP/TEMP capability flags")
        if precip_link not in {"0", "1"}:
            raise ValueError(f"amdmaster.index4 line {line_no}: unknown precipitation continuity flag {precip_link!r}")
        if temp_link not in {"0", "1", "4", "5"}:
            raise ValueError(f"amdmaster.index4 line {line_no}: unknown temperature continuity flag {temp_link!r}")
        stations[station_id].append({
            "stationId": station_id, "nameRoman": row[3].strip(), "nameJa": row[1].strip(),
            "latitude": row[7].strip(), "longitude": row[8].strip(), "elevationM": row[9].strip(),
            "startDate": start.isoformat(), "endDate": end.isoformat(),
            "oldStationId": row[25].strip(), "precipitationAvailable": precip == "1",
            "temperatureAvailable": temp == "1", "precipitationContinuityCode": precip_link,
            "temperatureContinuityCode": temp_link
        })
    if not stations:
        raise ValueError("No valid station rows found in official amdmaster.index4")
    for sid in stations:
        stations[sid].sort(key=lambda x: x["startDate"])
    return stations

def load_text(path):
    raw = Path(path).read_bytes()
    for encoding in ("utf-8-sig", "cp932"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Cannot decode JMA history file: {path}")

def _coverage(segments, capability):
    intervals = []
    for seg in segments:
        if not seg[capability]:
            continue
        lo = max(parse_date(seg["startDate"]), START)
        hi = min(parse_date(seg["endDate"]), END)
        if lo <= hi:
            intervals.append((lo, hi))
    intervals.sort()
    merged = []
    for lo, hi in intervals:
        if not merged or lo > merged[-1][1].fromordinal(merged[-1][1].toordinal() + 1):
            merged.append([lo, hi])
        elif hi > merged[-1][1]:
            merged[-1][1] = hi
    return sum((hi - lo).days + 1 for lo, hi in merged)

def audit_candidate(candidate, official_segments):
    sid = str(candidate["stationId"])
    segments = official_segments.get(sid, [])
    period_segments = [
        x for x in segments
        if parse_date(x["startDate"]) <= END and parse_date(x["endDate"]) >= START
    ]
    precip_days = _coverage(period_segments, "precipitationAvailable")
    temp_days = _coverage(period_segments, "temperatureAvailable")
    first_history_segment = segments[0] if segments else None
    def is_initial_baseline(segment):
        return segment is first_history_segment and segment["oldStationId"] == sid
    # JMA explicitly marks the first-ever station segment with code 1 or 5
    # even though there is no predecessor to disconnect; do not count that
    # initial marker as a historical break.
    def boundary_falls_in_period(segment):
        boundary = parse_date(segment["startDate"])
        return START <= boundary <= END
    p_cuts = [x for x in period_segments if x["precipitationContinuityCode"] == "1" and boundary_falls_in_period(x) and not is_initial_baseline(x)]
    t_cuts = [x for x in period_segments if x["temperatureContinuityCode"] in {"1", "5"} and boundary_falls_in_period(x) and not is_initial_baseline(x)]
    t_adjusted = [x for x in period_segments if x["temperatureContinuityCode"] == "4"]
    mirror_segments = candidate.get("historySegments", [])
    def clipped_key(segment):
        start_text = segment.get("startDate")
        end_text = segment.get("endDate") or "9999-99-99"
        if not start_text:
            return None
        lo = max(parse_date(start_text), START)
        hi = min(parse_date(end_text, allow_open=True), END)
        return (lo.isoformat(), hi.isoformat()) if lo <= hi else None
    mirror_keys = {key for key in (clipped_key(x) for x in mirror_segments) if key}
    official_keys = {
        key for key in (
            clipped_key(x) for x in period_segments
            if x["precipitationAvailable"] and x["temperatureAvailable"]
        ) if key
    }
    return {
        "stationId": sid, "candidateName": candidate.get("name") or candidate.get("nameJa"),
        "officialNameJa": period_segments[-1]["nameJa"] if period_segments else (segments[-1]["nameJa"] if segments else None),
        "officialLatitude": period_segments[-1]["latitude"] if period_segments else (segments[-1]["latitude"] if segments else None),
        "officialLongitude": period_segments[-1]["longitude"] if period_segments else (segments[-1]["longitude"] if segments else None),
        "officialElevationM": period_segments[-1]["elevationM"] if period_segments else (segments[-1]["elevationM"] if segments else None),
        "officialHistoryMatch": bool(segments),
        "officialHistorySegmentCount": len(segments),
        "officialSegmentsOverlapping1991_2020": len(period_segments),
        "officialPrecipitationCoverageDays": precip_days,
        "officialPrecipitationMetadataCoveragePct": round(precip_days / DAYS * 100, 2),
        "officialTemperatureCoverageDays": temp_days,
        "officialTemperatureMetadataCoveragePct": round(temp_days / DAYS * 100, 2),
        "precipitationStatisticalBreakCount": len(p_cuts),
        "temperatureStatisticalBreakCount": len(t_cuts),
        "temperatureAdjustedContinuityCount": len(t_adjusted),
        "oldStationIds": sorted({x["oldStationId"] for x in period_segments if x["oldStationId"]}),
        "mirrorHistoryIntervalMismatch": bool(mirror_segments) and mirror_keys != official_keys,
        "officialHistorySegments": period_segments,
        "stationApproved": False, "weatherIngestionEnabled": False
    }

def build_report(candidate_data, official_segments):
    out = []
    for region in candidate_data.get("regions", []):
        if region.get("countryCode") != "JP":
            continue
        audited = [audit_candidate(c, official_segments) for c in region.get("candidates", [])]
        out.append({
            "subregionId": region.get("subregionId"), "subregionLabel": region.get("subregionLabel"),
            "candidatesAudited": len(audited),
            "officialMatchedCandidates": sum(x["officialHistoryMatch"] for x in audited),
            "candidates": audited
        })
    flat = [x for r in out for x in r["candidates"]]
    return {
        "schemaVersion": 1, "status": "jma-official-station-history-crosscheck-not-approved",
        "source": "JMA official AMeDAS station information history file amdmaster.index4",
        "period": {"start": START.isoformat(), "end": END.isoformat(), "calendarDays": DAYS},
        "rules": {
            "metadataCoverageIsNotDailyObservationCoverage": True,
            "precipitationContinuityCode": {"0": "connected", "1": "disconnected"},
            "temperatureContinuityCode": {"0": "connected", "1": "disconnected", "4": "connected-with-correction", "5": "disconnected-due-to-relocation"},
            "approvalRequires": ["official station identity", "daily PRCP/TMAX/TMIN quality audit", "position/exposure review", "regional representativeness review"]
        },
        "summary": {
            "japanSubregionsAudited": len(out), "candidateRowsAudited": len(flat),
            "officialMatchedCandidateRows": sum(x["officialHistoryMatch"] for x in flat),
            "candidateRowsWithPrecipitationBreaks": sum(bool(x["precipitationStatisticalBreakCount"]) for x in flat),
            "candidateRowsWithTemperatureBreaks": sum(bool(x["temperatureStatisticalBreakCount"]) for x in flat),
            "candidateRowsWithMirrorHistoryMismatch": sum(x["mirrorHistoryIntervalMismatch"] for x in flat),
            "approvedStations": 0, "weatherIngestionEnabled": 0
        },
        "regions": out
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", default="data/observation-stations/jma-station-candidates-1991-2020.json")
    ap.add_argument("--catalog", required=True, help="Official JMA amdmaster.index4 file")
    ap.add_argument("--output", default="data/observation-stations/jma-official-history-crosscheck-1991-2020.json")
    args = ap.parse_args()
    report = build_report(json.loads(Path(args.candidates).read_text(encoding="utf-8")), parse_index4(load_text(args.catalog)))
    p = Path(args.output); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))

if __name__ == "__main__":
    main()
