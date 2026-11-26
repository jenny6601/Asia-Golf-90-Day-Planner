import unittest
from pathlib import Path
class GridAuditContractTests(unittest.TestCase):
    def test_audit_contract_includes_native_grid_geometry_fields(self):
        source=Path("scripts/audit-seas51-grib.py").read_text(encoding="utf-8")
        for key in ("gridType","Ni","Nj","iDirectionIncrementInDegrees","jDirectionIncrementInDegrees","numberOfPoints","latitudeOfFirstGridPointInDegrees","longitudeOfFirstGridPointInDegrees"):
            self.assertIn(key,source)
        self.assertIn('"gridGeometry"',source)
        self.assertIn('"gridGeometrySignatureCount"',source)
if __name__=="__main__": unittest.main()
