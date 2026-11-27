import unittest
from scripts.validate_ghcnd_daily_record_coverage import parse_dly, shortlist

def row(year, month, element, value=100, qflag=" ", days=31):
    slots=[]
    for day in range(1,32):
        v=value if day<=days else -9999
        slots.append(f"{v:5d}  ")
    return f"TESTSTATION{year:04d}{month:02d}{element}" + "".join(slots)

class RecordAuditTests(unittest.TestCase):
    def test_parses_valid_missing_and_quality_flagged(self):
        text="\n".join([
            row(1991,1,"PRCP",100,days=2),
            row(1991,1,"TMAX",200,days=1)[:21] + f"{200:5d}  " + f"{200:5d}X " + "".join(f"{-9999:5d}  " for _ in range(29)),
            row(1991,1,"TMIN",50,days=1)
        ])
        result=parse_dly(text)
        self.assertEqual(result["PRCP"]["validDays"],2)
        self.assertEqual(result["TMAX"]["validDays"],1)
        self.assertEqual(result["TMAX"]["flaggedDays"],1)
        self.assertEqual(result["TMIN"]["validDays"],1)
    def test_shortlist_only_complete_inventory_candidates(self):
        report={"regions":[{"countryCode":"JP","subregionId":"JP-1","nearestCandidates":[
            {"stationId":"A","requiredClimateElementsPresent":False},
            {"stationId":"B","requiredClimateElementsPresent":True,"distanceKm":5},
            {"stationId":"C","requiredClimateElementsPresent":True,"distanceKm":8}]}]}
        self.assertEqual([x["stationId"] for x in shortlist(report,1)],["B"])
if __name__=="__main__": unittest.main()
