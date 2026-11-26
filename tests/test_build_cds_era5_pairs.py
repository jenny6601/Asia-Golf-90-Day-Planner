import unittest
from scripts.build_cds_era5_pairs import build_pairs

def forecast(**overrides):
    value = {
        "countryCode": "JP", "courseId": "southern-links",
        "model": "ECMWF-SEAS5.1", "modelVersion": "System 51",
        "initializationTime": "2016-01-01T00:00:00Z",
        "validTime": "2016-01-18T00:00:00Z", "leadHours": 408,
        "ensembleMember": 0, "variable": "2t", "value": 285.65,
        "unit": "K", "temporalSemantics": "instantaneous",
        "spatialMethod": "nearest-grid-point", "nearestGridDistanceKm": 42
    }
    return {**value, **overrides}

def era5(**overrides):
    value = {
        "countryCode": "JP", "courseId": "southern-links",
        "validTime": "2016-01-18T00:00:00Z", "variable": "2t",
        "value": 284.9, "unit": "K", "temporalSemantics": "instantaneous",
        "verificationSource": "ERA5-reanalysis-proxy"
    }
    return {**value, **overrides}

class PairingTests(unittest.TestCase):
    def test_exact_match_creates_proxy_pair_with_provenance(self):
        report = build_pairs({"model": "ECMWF-SEAS5.1", "records": [forecast()]}, [era5()])
        self.assertEqual(report["pairedRecordCount"], 1)
        pair = report["pairedSamples"][0]
        self.assertEqual(pair["leadDays"], 17)
        self.assertEqual(pair["verificationSource"], "ERA5-reanalysis-proxy")
        self.assertEqual(pair["qualityStatus"], "paired-proxy-not-station-truth")

    def test_different_valid_time_is_not_matched(self):
        report = build_pairs({"records": [forecast()]}, [era5(validTime="2016-01-18T06:00:00Z")])
        self.assertEqual(report["pairedRecordCount"], 0)
        self.assertEqual(report["unmatchedForecasts"][0]["reason"], "no-exact-era5-match")

    def test_unit_mismatch_does_not_pair(self):
        report = build_pairs({"records": [forecast()]}, [era5(unit="degC")])
        self.assertEqual(report["pairedRecordCount"], 0)
        self.assertEqual(report["unmatchedForecastCount"], 1)

    def test_temporal_semantics_mismatch_does_not_pair(self):
        report = build_pairs({"records": [forecast(variable="tp", unit="m")]},
                             [era5(variable="tp", unit="m", temporalSemantics="period_accumulation")])
        self.assertEqual(report["pairedRecordCount"], 0)

    def test_duplicate_era5_candidates_are_ambiguous(self):
        report = build_pairs({"records": [forecast()]}, [era5(), era5(value=285.0)])
        self.assertEqual(report["pairedRecordCount"], 0)
        self.assertEqual(report["ambiguousForecastCount"], 1)

    def test_non_era5_verification_source_is_rejected(self):
        report = build_pairs({"records": [forecast()]}, [era5(verificationSource="station")])
        self.assertEqual(report["pairedRecordCount"], 0)
        self.assertEqual(report["invalidEra5RecordCount"], 1)

    def test_instantaneous_tp_is_never_paired_to_accumulation(self):
        report = build_pairs({"records": [forecast(variable="tp", unit="m")]},
                             [era5(variable="tp", unit="m", temporalSemantics="period_accumulation")])
        self.assertEqual(report["pairedRecordCount"], 0)
        self.assertEqual(report["unmatchedForecastCount"], 1)

if __name__ == "__main__":
    unittest.main()
