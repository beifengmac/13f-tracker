import asyncio
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch

spec = importlib.util.spec_from_file_location('adapter', Path(__file__).parents[1] / 'scripts/import_openbb.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)

class ReconciliationTests(unittest.TestCase):
    def fixture(self, value, shares, declared=None):
        text = f'<tableValueTotal>{value if declared is None else declared}</tableValueTotal><XML><informationTable><infoTable><value>{value}</value></infoTable></informationTable></XML>'
        rows = [{'period_ending':'2025-12-31','nameOfIssuer':'Example','cusip':'123456789','titleOfClass':'COM','security_type':'SH','principal_amount':shares,'value':value}]
        return text, rows
    def parse(self, text, rows):
        with patch('openbb_sec.utils.parse_13f.parse_13f_hr', new=AsyncMock(return_value=rows)):
            return asyncio.run(adapter.parse(text, {'filingDate':'2026-02-15','reportDate':'2025-12-31'}, {}))
    def test_modern_dollars_are_not_multiplied_by_schema_version(self):
        text, rows = self.fixture(10000, 100)
        q = self.parse('<schemaVersion>X0202</schemaVersion>'+text, rows)
        self.assertEqual(q['total'],10000)
        self.assertFalse(q['value_unit_inferred'])
    def test_small_implied_prices_are_flagged_as_inferred_not_verified(self):
        text, rows = self.fixture(10,100)
        q = self.parse(text,rows)
        self.assertTrue(q['value_unit_inferred'])
    def test_dropped_parser_value_is_rejected(self):
        text, rows=self.fixture(10000,100)
        rows[0]['value']=9990
        with self.assertRaises(ValueError): self.parse(text,rows)
    def test_cover_mismatch_is_rejected(self):
        text,rows=self.fixture(10000,100,12000)
        with self.assertRaises(ValueError): self.parse(text,rows)
    def test_wrong_report_period_is_rejected(self):
        text,rows=self.fixture(10000,100)
        rows[0]['period_ending']='2025-09-30'
        with self.assertRaises(ValueError): self.parse(text,rows)

if __name__=='__main__': unittest.main()
