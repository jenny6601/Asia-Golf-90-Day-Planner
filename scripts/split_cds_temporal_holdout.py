#!/usr/bin/env python3
"""Chronological train/holdout split with valid-time leakage purging."""
import argparse
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

def parse_time(value):
    if not isinstance(value, str):
        raise ValueError("timestamp must be a string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include timezone")
    return parsed

def target_key(row):
    return tuple(row.get(k) for k in ("countryCode", "courseId", "validTime", "variable", "unit"))

def chronological_split(samples, cutoff):
    cutoff_dt = parse_time(cutoff)
    valid_train, valid_test, invalid = [], [], []
    for index, row in enumerate(samples if isinstance(samples, list) else []):
        try:
            init = parse_time(row.get("initializationTime"))
            parse_time(row.get("validTime"))
        except (ValueError, TypeError):
            invalid.append({"index": index, "reason": "invalid-or-timezone-naive-timestamp"})
            continue
        if init < cutoff_dt:
            valid_train.append(row)
        else:
            valid_test.append(row)

    test_targets = {target_key(row) for row in valid_test}
    purged_train, train = [], []
    for row in valid_train:
        if target_key(row) in test_targets:
            purged_train.append(row)
        else:
            train.append(row)

    def date_range(rows, key):
        values = [parse_time(row[key]) for row in rows]
        if not values:
            return None
        return {"start": min(values).isoformat(), "end": max(values).isoformat()}

    return {
        "cutoff": cutoff_dt.isoformat(),
        "policy": "initialization-time chronological split; purge training targets overlapping holdout by country/course/valid-time/variable/unit",
        "inputCount": len(samples) if isinstance(samples, list) else 0,
        "trainCount": len(train),
        "holdoutCount": len(valid_test),
        "purgedTrainCount": len(purged_train),
        "invalidCount": len(invalid),
        "trainInitializationRange": date_range(train, "initializationTime"),
        "holdoutInitializationRange": date_range(valid_test, "initializationTime"),
        "train": train,
        "holdout": valid_test,
        "purgedTraining": purged_train,
        "invalid": invalid,
        "status": "ready-for-evaluation" if train and valid_test else "insufficient-split-samples",
        "limitations": [
            "A chronological split is not sufficient by itself to establish independent station truth.",
            "ERA5 verification remains a reanalysis proxy.",
            "Do not fit correction or tune thresholds on the holdout set."
        ]
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--cutoff", required=True, help="Timezone-aware ISO-8601 initialization cutoff")
    parser.add_argument("--output", default="artifacts/cds-temporal-holdout-split.json")
    args = parser.parse_args()
    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    samples = payload.get("pairedSamples", payload.get("samples", [])) if isinstance(payload, dict) else payload
    report = chronological_split(samples, args.cutoff)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["inputCount", "trainCount", "holdoutCount", "purgedTrainCount", "invalidCount", "status"]}, indent=2))

if __name__ == "__main__":
    main()
