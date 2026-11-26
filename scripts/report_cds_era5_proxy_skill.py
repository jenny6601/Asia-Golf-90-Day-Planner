#!/usr/bin/env python3
"""Summarize paired CDS–ERA5 proxy samples without claiming station skill."""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

BANDS = [
    ("D17-D30", 17, 30),
    ("D31-D45", 31, 45),
    ("D46-D60", 46, 60),
    ("D61-D90", 61, 90),
]

def lead_band(days):
    if not isinstance(days, (int, float)) or not math.isfinite(days):
        return "unknown"
    for label, low, high in BANDS:
        if low <= days <= high:
            return label
    return "outside-D17-D90"

def summarize(samples):
    groups = defaultdict(list)
    rejected = 0
    for row in samples if isinstance(samples, list) else []:
        required = ["countryCode", "variable", "leadDays", "forecastValue", "verificationValue", "verificationSource", "unit"]
        if any(row.get(k) is None for k in required):
            rejected += 1
            continue
        if row.get("verificationSource") != "ERA5-reanalysis-proxy":
            rejected += 1
            continue
        if not isinstance(row["forecastValue"], (int, float)) or not isinstance(row["verificationValue"], (int, float)):
            rejected += 1
            continue
        key = (row["countryCode"], row["variable"], row["unit"], lead_band(row["leadDays"]))
        groups[key].append(row)

    rows = []
    for (country, variable, unit, band), values in sorted(groups.items()):
        errors = [x["forecastValue"] - x["verificationValue"] for x in values]
        n = len(errors)
        rows.append({
            "countryCode": country, "variable": variable, "unit": unit,
            "leadBand": band, "n": n,
            "mae": sum(abs(e) for e in errors) / n,
            "bias": sum(errors) / n,
            "rmse": math.sqrt(sum(e * e for e in errors) / n),
            "verificationSource": "ERA5-reanalysis-proxy",
            "skillStatus": "descriptive-proxy-metrics-not-station-validated"
        })
    return {
        "sampleCount": len(samples) if isinstance(samples, list) else 0,
        "acceptedCount": sum(row["n"] for row in rows),
        "rejectedCount": rejected,
        "groupCount": len(rows),
        "metrics": rows,
        "limitations": [
            "ERA5 is a reanalysis proxy, not station truth.",
            "Metrics are descriptive for the supplied paired sample only.",
            "A single initialization or sparse lead coverage is not sufficient for D17-D90 skill claims.",
            "No probability score is calculated; raw ensemble-member fractions are not calibrated probabilities.",
            "No bias correction is fitted or applied."
        ]
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Pairing JSON produced by build_cds_era5_pairs.py")
    parser.add_argument("--output", default="artifacts/cds-era5-proxy-skill-report.json")
    args = parser.parse_args()
    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    samples = payload.get("pairedSamples", [])
    report = summarize(samples)
    report["pairingStatus"] = payload.get("status")
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["sampleCount", "acceptedCount", "rejectedCount", "groupCount", "pairingStatus"]}, indent=2))

if __name__ == "__main__":
    main()
