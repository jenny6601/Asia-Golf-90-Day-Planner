#!/usr/bin/env python3
"""Normalize a single-station JMA ObsDL daily CSV export into the comparison JSON contract.

The parser intentionally preserves raw quality/homogeneity fields and does not infer
that a numeric value is quality-approved. It accepts common JMA Japanese headers;
unsupported layouts fail closed rather than guessing columns.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import date
from pathlib import Path


MISSING = {"", "///", "×", "欠測", "資料なし", "nan", "null", "-"}
FIELD_ALIASES = {
    "precipitationMm": ("降水量の合計", "日降水量", "降水量(mm)", "降水量 (mm)"),
    "temperatureMaxC": ("最高気温", "日最高気温"),
    "temperatureMinC": ("最低気温", "日最低気温"),
}


def norm(s):
    return re.sub(r"\s+", "", str(s or "")).replace("（", "(").replace("）", ")")


def parse_number(value):
    raw = str(value or "").strip()
    if raw in MISSING:
        return None
    raw = raw.replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return None


def parse_date_row(row, indexes):
    if "date" in indexes:
        raw = str(row[indexes["date"]]).strip()
        for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%Y年%m月%d日", "%Y/%m/%d %H:%M"):
            try:
                return date.fromisoformat(raw) if fmt == "iso" else __import__("datetime").datetime.strptime(raw, fmt).date()
            except ValueError:
                pass
    if all(k in indexes for k in ("year", "month", "day")):
        try:
            return date(int(row[indexes["year"]]), int(row[indexes["month"]]), int(row[indexes["day"]]))
        except (ValueError, TypeError, IndexError):
            return None
    return None


def find_header(rows):
    for i, row in enumerate(rows):
        cells = [norm(x) for x in row]
        if any(x in ("年月日", "日付") for x in cells) or all(x in cells for x in ("年", "月", "日")):
            return i, cells
    raise ValueError("Could not locate JMA daily date header (年月日 or 年/月/日)")


def normalize_csv(path, station_id, station_name, latitude, longitude, region_id, year=None):
    # utf-8-sig is the standard ObsDL export; cp932 is accepted for legacy exports.
    raw = Path(path).read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp932")
    rows = list(csv.reader(text.splitlines()))
    header_i, headers = find_header(rows)
    indexes = {}
    for key, aliases in (("date", ("年月日", "日付")), ("year", ("年",)), ("month", ("月",)), ("day", ("日",))):
        for i, h in enumerate(headers):
            if h in aliases:
                indexes[key] = i
                break
    metric_indexes = {}
    for field, aliases in FIELD_ALIASES.items():
        matches = [i for i, h in enumerate(headers) if any(norm(alias) in h for alias in aliases)]
        if not matches:
            continue
        # First matching column is the value column. Duplicate metric columns are
        # retained below as raw quality/homogeneity metadata, never silently merged.
        metric_indexes[field] = matches[0]
    missing_fields = sorted(set(FIELD_ALIASES) - set(metric_indexes))
    if missing_fields:
        raise ValueError("JMA CSV missing required daily columns: " + ", ".join(missing_fields))

    records, seen = [], set()
    for row in rows[header_i + 1:]:
        if not row or len(row) <= max(indexes.values(), default=-1):
            continue
        d = parse_date_row(row, indexes)
        if d is None or (year is not None and d.year != year):
            continue
        key = d.isoformat()
        if key in seen:
            raise ValueError(f"Duplicate daily date in JMA CSV: {key}")
        seen.add(key)
        record = {"validDate": key}
        for field, col in metric_indexes.items():
            raw_value = row[col] if col < len(row) else ""
            record[field] = parse_number(raw_value)
            # Retain original text so quality symbols are auditable.
            record.setdefault("sourceRawValues", {})[field] = raw_value
        records.append(record)
    if not records:
        raise ValueError("No daily records found after parsing JMA CSV")
    records.sort(key=lambda x: x["validDate"])
    return {
        "schemaVersion": 1,
        "sourceId": "JMA_DAILY_OBSERVATION",
        "sourceOrganization": "Japan Meteorological Agency",
        "sourcePortal": "https://www.data.jma.go.jp/risk/obsdl/",
        "exportFile": Path(path).name,
        "station": {
            "stationId": str(station_id), "name": station_name,
            "latitude": latitude, "longitude": longitude, "regionId": region_id,
            "records": records
        },
        "qualityPolicy": {
            "status": "raw-quality-not-yet-interpreted",
            "note": "Original source cells are retained. Verify JMA quality and homogeneity columns from the exact export before treating any record as validation-eligible."
        }
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv_file", type=Path)
    p.add_argument("--station-id", required=True)
    p.add_argument("--station-name", required=True)
    p.add_argument("--latitude", required=True, type=float)
    p.add_argument("--longitude", required=True, type=float)
    p.add_argument("--region-id", required=True)
    p.add_argument("--year", type=int)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    payload = normalize_csv(a.csv_file, a.station_id, a.station_name, a.latitude, a.longitude, a.region_id, a.year)
    # Comparison script accepts stations[]; wrap the normalized station.
    output = {"schemaVersion": 1, "sourceId": payload["sourceId"], "stations": [payload["station"]], "qualityPolicy": payload["qualityPolicy"], "source": {"portal": payload["sourcePortal"], "exportFile": payload["exportFile"]}}
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "normalized-review-required", "stationId": a.station_id, "records": len(payload["station"]["records"]), "output": str(a.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
