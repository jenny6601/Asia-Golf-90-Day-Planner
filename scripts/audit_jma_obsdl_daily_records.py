#!/usr/bin/env python3
"""Audit official JMA ObsDL daily CSV exports for 1991-2020.

Input files must be one station per CSV and named <JMA station id>.csv.
Only quality code 8 is counted as strict valid data; codes 5/4/2/1/0
are reported separately and never silently promoted to valid observations.
"""
import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

START = date(1991, 1, 1)
END = date(2020, 12, 31)
TOTAL_DAYS = (END - START).days + 1
ELEMENT_LABELS = {
    "PRCP": ("降水量の合計", "降水量合計"),
    "TMAX": ("日最高気温", "最高気温"),
    "TMIN": ("日最低気温", "最低気温"),
}
QUALITY_CODES = {"8", "5", "4", "2", "1", "0"}
DATE_RE = re.compile(r"^\d{4}/\d{1,2}/\d{1,2}$")

def _find_header_rows(rows):
    for i in range(len(rows) - 2):
        row = [x.strip() for x in rows[i]]
        if any("年月日" == x or x == "日付" for x in row):
            if i == 0:
                raise ValueError("JMA CSV station-name header row is missing")
            return i - 1, i, i + 1
    raise ValueError("JMA CSV does not contain the expected three-row ObsDL header")

def _element_columns(station_row, item_row, detail_row):
    found = {}
    for element, labels in ELEMENT_LABELS.items():
        value_col = quality_col = homogeneous_col = None
        for i, raw in enumerate(item_row):
            item = raw.strip()
            if not any(label in item for label in labels):
                continue
            detail = detail_row[i].strip() if i < len(detail_row) else ""
            if detail == "品質情報":
                quality_col = i
            elif detail == "均質番号":
                homogeneous_col = i
            elif detail in ("", "データ"):
                value_col = i
        if value_col is None or quality_col is None:
            raise ValueError(f"JMA CSV missing value/quality columns for {element}")
        found[element] = {"value": value_col, "quality": quality_col,
                          "homogeneous": homogeneous_col}
    return found

def parse_obsdl_csv(csv_text):
    rows = list(csv.reader(csv_text.lstrip("\ufeff").splitlines()))
    if not rows:
        raise ValueError("Empty JMA CSV")
    station_i, item_i, detail_i = _find_header_rows(rows)
    station_row, item_row, detail_row = rows[station_i], rows[item_i], rows[detail_i]
    station_names = {x.strip() for x in station_row[1:] if x.strip()}
    if len(station_names) != 1:
        raise ValueError("Each JMA ObsDL CSV must contain exactly one station")
    columns = _element_columns(station_row, item_row, detail_row)
    records = {}
    for row in rows[detail_i + 1:]:
        if not row or not row[0].strip() or not DATE_RE.match(row[0].strip()):
            continue
        date_text = row[0].strip()
        yy, mm, dd = (int(x) for x in date_text.split("/"))
        day = date(yy, mm, dd)
        if not START <= day <= END:
            continue
        key = day.isoformat()
        if key in records:
            raise ValueError(f"Duplicate date in JMA CSV: {key}")
        values = {}
        for element, cols in columns.items():
            value = row[cols["value"]].strip() if cols["value"] < len(row) else ""
            quality = row[cols["quality"]].strip() if cols["quality"] < len(row) else ""
            homogeneous = ""
            if cols["homogeneous"] is not None and cols["homogeneous"] < len(row):
                homogeneous = row[cols["homogeneous"]].strip()
            if quality and quality not in QUALITY_CODES:
                raise ValueError(f"Unknown JMA quality code {quality!r} for {element} on {key}")
            numeric = None
            if value:
                try:
                    numeric = float(value)
                except ValueError:
                    numeric = None
            values[element] = {"value": numeric, "quality": quality,
                               "homogeneousNumber": homogeneous}
        records[key] = values
    if not records:
        raise ValueError("No dated observations in 1991-2020 found in JMA CSV")
    return {"stationName": next(iter(station_names)), "records": records}

def audit_station(station_id, parsed):
    counters = {e: Counter() for e in ELEMENT_LABELS}
    annual = {e: defaultdict(Counter) for e in ELEMENT_LABELS}
    homogeneity = {e: set() for e in ELEMENT_LABELS}
    for date_text, values in parsed["records"].items():
        year = int(date_text[:4])
        for element, item in values.items():
            q = item["quality"]
            if q:
                counters[element][q] += 1
                annual[element][year][q] += 1
            if item["homogeneousNumber"]:
                homogeneity[element].add(item["homogeneousNumber"])
    elements = {}
    for element in ELEMENT_LABELS:
        strict_days = counters[element]["8"]
        quasi_days = counters[element]["5"]
        insufficient_days = counters[element]["4"]
        suspicious_days = counters[element]["2"]
        missing_days = counters[element]["1"]
        non_observation_days = counters[element]["0"]
        years80 = sum(
            annual[element][year]["8"] >= 292
            for year in range(1991, 2021)
        )
        elements[element] = {
            "strictValidDaysQuality8": strict_days,
            "strictCoveragePct": round(strict_days / TOTAL_DAYS * 100, 2),
            "quasiNormalDaysQuality5": quasi_days,
            "insufficientDaysQuality4": insufficient_days,
            "suspiciousDaysQuality2": suspicious_days,
            "missingDaysQuality1": missing_days,
            "notObservedDaysQuality0": non_observation_days,
            "yearsAtLeast80PctStrict": years80,
            "homogeneitySegmentCount": len(homogeneity[element]),
            "qualityCodeCounts": {k: counters[element][k] for k in ("8","5","4","2","1","0")}
        }
    strict = [elements[e]["strictCoveragePct"] for e in ELEMENT_LABELS]
    years = [elements[e]["yearsAtLeast80PctStrict"] for e in ELEMENT_LABELS]
    if all(x >= 90 for x in strict) and all(x >= 24 for x in years):
        tier = "robust"
    elif all(x >= 80 for x in strict) and all(x >= 20 for x in years):
        tier = "acceptable"
    elif all(elements[e]["strictValidDaysQuality8"] > 0 for e in ELEMENT_LABELS):
        tier = "limited"
    else:
        tier = "unusable"
    return {
        "countryCode": "JP", "stationId": str(station_id),
        "stationName": parsed["stationName"], "period": {"start": START.isoformat(), "end": END.isoformat()},
        "qualityTier": tier, "elements": elements,
        "stationApproved": False, "weatherIngestionEnabled": False
    }

def build_report(input_dir):
    rows = []
    for path in sorted(Path(input_dir).glob("*.csv")):
        station_id = path.stem
        if not station_id.isdigit():
            raise ValueError(f"JMA input filename must be <numeric station id>.csv: {path.name}")
        parsed = parse_obsdl_csv(path.read_text(encoding="utf-8-sig"))
        rows.append(audit_station(station_id, parsed))
    if not rows:
        raise ValueError(f"No JMA daily CSV files found in {input_dir}")
    tiers = Counter(x["qualityTier"] for x in rows)
    return {
        "schemaVersion": 1,
        "status": "jma-obsdl-daily-quality-audited-not-approved",
        "source": "Japan Meteorological Agency Past Weather Data Download (ObsDL) official CSV exports",
        "period": {"start": START.isoformat(), "end": END.isoformat(), "calendarDays": TOTAL_DAYS},
        "strictQualityPolicy": "Only JMA quality code 8 (normal value) counts toward strict coverage. Codes 5, 4, 2, 1 and 0 are retained separately and excluded from strict valid-day counts.",
        "tierRules": {
            "robust": "PRCP/TMAX/TMIN each >=90% strict quality-8 coverage and >=24/30 years with >=80% strict annual coverage",
            "acceptable": "Each element >=80% strict quality-8 coverage and >=20/30 years with >=80% strict annual coverage",
            "limited": "All three elements have some strict quality-8 days but do not meet acceptable",
            "unusable": "At least one required element has zero strict quality-8 days"
        },
        "summary": {"stationsAudited": len(rows), "qualityTierCounts": dict(tiers),
                    "approvedStations": 0, "weatherIngestionEnabled": 0},
        "stations": rows
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", default="data/observation-stations/input/jma-daily")
    ap.add_argument("--output", default="data/observation-stations/jma-daily-record-quality-1991-2020.json")
    args = ap.parse_args()
    report = build_report(args.input_dir)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))

if __name__ == "__main__":
    main()
