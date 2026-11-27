#!/usr/bin/env python3
"""Normalize one-station JMA ObsDL daily CSV exports into the comparison JSON contract.

Supports JMA's multi-row header (station / element / quality subcolumns) and a
simple single-row layout for controlled tests. Unknown layouts fail closed.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import date, datetime
from pathlib import Path

MISSING = {"", "///", "×", "欠測", "資料なし", "nan", "null", "-"}
FIELD_ALIASES = {
    "precipitationMm": ("降水量の合計", "日降水量", "降水量(mm)", "降水量(mm)"),
    "temperatureMaxC": ("最高気温", "日最高気温"),
    "temperatureMinC": ("最低気温", "日最低気温"),
}
META_LABELS = {"現象なし情報", "品質情報", "均質番号"}


def norm(s):
    return re.sub(r"\\s+", "", str(s or "")).replace("（", "(").replace("）", ")")


def parse_number(value):
    raw = str(value or "").strip()
    if raw in MISSING:
        return None
    raw = raw.replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return None


def find_header(rows):
    for i, row in enumerate(rows):
        cells = [norm(x) for x in row]
        if "年月日" in cells or "日付" in cells or all(x in cells for x in ("年", "月", "日")):
            sub = [norm(x) for x in rows[i + 1]] if i + 1 < len(rows) else [""] * len(cells)
            return i, cells, sub
    raise ValueError("Could not locate JMA daily date header (年月日 or 年/月/日)")


def parse_date_row(row, indexes):
    if "date" in indexes:
        raw = str(row[indexes["date"]]).strip()
        for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%Y年%m月%d日", "%Y/%m/%d %H:%M"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                pass
    if all(k in indexes for k in ("year", "month", "day")):
        try:
            return date(int(row[indexes["year"]]), int(row[indexes["month"]]), int(row[indexes["day"]]))
        except (ValueError, TypeError, IndexError):
            return None
    return None


def normalize_csv(path, station_id, station_name, latitude, longitude, region_id, year=None):
    raw = Path(path).read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp932")
    rows = list(csv.reader(text.splitlines()))
    header_i, headers, subheaders = find_header(rows)

    indexes = {}
    for key, aliases in (("date", ("年月日", "日付")), ("year", ("年",)), ("month", ("月",)), ("day", ("日",))):
        for i, h in enumerate(headers):
            if h in aliases:
                indexes[key] = i
                break

    metric_columns = {}
    for field, aliases in FIELD_ALIASES.items():
        candidates = [i for i, h in enumerate(headers) if any(norm(alias) in h for alias in aliases)]
        # The data value is the first column in the metric group, not its
        # phenomenon/quality/homogeneity companion columns.
        value_col = next((i for i in candidates if i >= len(subheaders) or subheaders[i] not in META_LABELS), None)
        if value_col is None:
            continue
        group = [i for i in candidates if i == value_col or (i > value_col and i < len(subheaders) and subheaders[i] in META_LABELS)]
        metadata = {}
        for i in group:
            label = subheaders[i] if i < len(subheaders) else ""
            if label and label in META_LABELS:
                metadata[label] = i
        metric_columns[field] = {"value": value_col, "metadata": metadata}

    missing_fields = sorted(set(FIELD_ALIASES) - set(metric_columns))
    if missing_fields:
        raise ValueError("JMA CSV missing required daily columns: " + ", ".join(missing_fields))

    # The parser only accepts a single station's export. JMA places station names
    # in the row immediately above the element-name row.
    station_header = [norm(x) for x in rows[header_i - 1]] if header_i > 0 else []
    station_names = {x for x in station_header if x and x not in {"集計開始", "集計終了"}}
    if len(station_names) > 1:
        raise ValueError("CSV contains multiple station columns; export one station at a time")

    records, seen = [], set()
    for row in rows[header_i + 2:]:
        if not row or len(row) <= max(indexes.values(), default=-1):
            continue
        d = parse_date_row(row, indexes)
        if d is None or (year is not None and d.year != year):
            continue
        key = d.isoformat()
        if key in seen:
            raise ValueError(f"Duplicate daily date in JMA CSV: {key}")
        seen.add(key)
        record = {"validDate": key, "sourceColumnHeaders": headers, "sourceSubheaders": subheaders, "sourceRawCells": row}
        quality_codes = {}
        homogeneity = {}
        phenomenon = {}
        raw_values = {}
        for field, cols in metric_columns.items():
            col = cols["value"]
            raw_value = row[col] if col < len(row) else ""
            value = parse_number(raw_value)
            meta = cols["metadata"]
            qcol = meta.get("品質情報")
            pcol = meta.get("現象なし情報")
            hcol = meta.get("均質番号")
            qraw = row[qcol] if qcol is not None and qcol < len(row) else None
            praw = row[pcol] if pcol is not None and pcol < len(row) else None
            hraw = row[hcol] if hcol is not None and hcol < len(row) else None
            qcode = parse_number(qraw)
            pcode = parse_number(praw)
            if qcode is not None:
                quality_codes[field] = int(qcode)
            if pcode is not None:
                phenomenon[field] = int(pcode)
            if hraw not in (None, ""):
                homogeneity[field] = hraw
            # JMA phenomenon code 1 means no phenomenon; with normal quality,
            # an empty precipitation cell is a valid zero, not missing data.
            if field == "precipitationMm" and value is None and pcode == 1 and qcode == 8:
                value = 0.0
            record[field] = value
            raw_values[field] = raw_value
        record["sourceRawValues"] = raw_values
        record["jmaQualityCodes"] = quality_codes
        record["jmaPhenomenonCodes"] = phenomenon
        record["jmaHomogeneityNumbers"] = homogeneity
        records.append(record)

    if not records:
        raise ValueError("No daily records found after parsing JMA CSV")
    records.sort(key=lambda x: x["validDate"])
    required_quality = all("品質情報" in cols["metadata"] for cols in metric_columns.values())
    required_homogeneity = all("均質番号" in cols["metadata"] for cols in metric_columns.values())
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
            "status": "metadata-present-needs-review" if required_quality and required_homogeneity else "metadata-incomplete",
            "qualityColumnsPresentForAllElements": required_quality,
            "homogeneityColumnsPresentForAllElements": required_homogeneity,
            "acceptedQualityCodesForStrictValidation": [8],
            "note": "Only JMA quality code 8 is eligible for strict validation by default. Code 5 is quasi-normal; code 4 insufficient, 2 suspect, 1 missing, 0 not an observation. Homogeneity numbers must be checked for breaks before comparison."
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
    output = {"schemaVersion": 1, "sourceId": payload["sourceId"], "stations": [payload["station"]], "qualityPolicy": payload["qualityPolicy"], "source": {"portal": payload["sourcePortal"], "exportFile": payload["exportFile"]}}
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    print(json.dumps({"status": "normalized-review-required", "stationId": a.station_id, "records": len(payload["station"]["records"]), "qualityPolicy": payload["qualityPolicy"], "output": str(a.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
