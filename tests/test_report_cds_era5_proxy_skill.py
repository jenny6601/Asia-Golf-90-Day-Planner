import unittest
from scripts.report_cds_era5_proxy_skill import lead_band, summarize

class ProxySkillReportTests(unittest.TestCase):
    def test_lead_bands(self):
        self.assertEqual(lead_band(17), "D17-D30")
        self.assertEqual(lead_band(30), "D17-D30")
        self.assertEqual(lead_band(31), "D31-D46")
        self.assertEqual(lead_band(46), "D31-D46")
        self.assertEqual(lead_band(47), "D47-D60")
        self.assertEqual(lead_band(60), "D47-D60")
        self.assertEqual(lead_band(61), "D61-D90")
        self.assertEqual(lead_band(90), "D61-D90")

    def test_metrics_group_by_country_variable_and_lead_band(self):
        rows = [
            {"countryCode":"JP","variable":"2t","unit":"K","leadDays":17,"forecastValue":3,"verificationValue":1,"verificationSource":"ERA5-reanalysis-proxy"},
            {"countryCode":"JP","variable":"2t","unit":"K","leadDays":18,"forecastValue":1,"verificationValue":1,"verificationSource":"ERA5-reanalysis-proxy"},
            {"countryCode":"KR","variable":"10u","unit":"m s-1","leadDays":31,"forecastValue":4,"verificationValue":2,"verificationSource":"ERA5-reanalysis-proxy"},
        ]
        report = summarize(rows)
        self.assertEqual(report["acceptedCount"], 3)
        self.assertEqual(report["groupCount"], 2)
        jp = next(x for x in report["metrics"] if x["countryCode"] == "JP")
        self.assertEqual(jp["n"], 2)
        self.assertEqual(jp["mae"], 1.0)
        self.assertEqual(jp["bias"], 1.0)
        self.assertAlmostEqual(jp["rmse"], 2 ** 0.5)

    def test_non_era5_source_is_not_scored(self):
        report = summarize([{
            "countryCode":"JP","variable":"2t","unit":"K","leadDays":17,
            "forecastValue":3,"verificationValue":1,"verificationSource":"station"
        }])
        self.assertEqual(report["acceptedCount"], 0)
        self.assertEqual(report["rejectedCount"], 1)

    def test_metrics_are_labelled_as_proxy_not_station_truth(self):
        report = summarize([{
            "countryCode":"JP","variable":"2t","unit":"K","leadDays":17,
            "forecastValue":3,"verificationValue":1,"verificationSource":"ERA5-reanalysis-proxy"
        }])
        self.assertEqual(report["metrics"][0]["skillStatus"], "descriptive-proxy-metrics-not-station-validated")
        self.assertTrue(any("not station truth" in item for item in report["limitations"]))

if __name__ == "__main__":
    unittest.main()
