import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from scripts import import_openbb as adapter

TEXT = '''<XML><edgarSubmission xmlns="urn:sec"><submissionType>13F-NT</submissionType><periodOfReport>09-30-2026</periodOfReport><otherManagersInfo><otherManager><name>Reporting Manager</name><form13FFileNumber>028-12345</form13FFileNumber></otherManager></otherManagersInfo></edgarSubmission></XML>'''
FILING = {'form':'13F-NT','reportDate':'2026-09-30','filingDate':'2026-11-17','accessionNumber':'0001193125-26-464327'}

class NoticeTests(unittest.TestCase):
    def test_namespace_and_period_validation(self):
        n=adapter.parse_notice(TEXT,FILING,'https://www.sec.gov/Archives/test')
        self.assertEqual(n['reporting_managers'][0]['name'],'Reporting Manager')
        self.assertNotIn('holdings',n)
        with self.assertRaises(ValueError):adapter.parse_notice(TEXT,{**FILING,'reportDate':'2026-06-30'},'url')
        with self.assertRaises(ValueError):adapter.parse_notice(TEXT.replace('<name>Reporting Manager</name>',''),FILING,'url')
    def test_notice_is_persisted_without_empty_portfolio_or_losing_history(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'data.json'
            history={'total':100,'holdings':[]}
            path.write_text(json.dumps({'funds':{'sample':{'cik':'1','quarters':{'Q2 2026':history}}}}))
            with patch.object(adapter,'filing_list',return_value=[FILING]),patch.object(adapter,'fetch',return_value=TEXT),patch.object(adapter,'ticker_map',return_value={}):
                self.assertEqual(asyncio.run(adapter.run(SimpleNamespace(output=str(path),funds='sample',quarters=4))),0)
            f=json.loads(path.read_text())['funds']['sample']
            self.assertEqual(f['quarters'],{'Q2 2026':history})
            self.assertIn('Q3 2026',f['notices'])

    def test_filing_discovery_includes_notices_and_amendments(self):
        forms=['13F-NT','13F-NT/A','13F-HR','8-K']
        batch={k:[FILING[k]]*4 for k in ['reportDate','filingDate','accessionNumber']}
        batch['form']=forms
        with patch.object(adapter,'fetch',return_value=json.dumps({'filings':{'recent':batch}})):
            self.assertEqual({f['form'] for f in adapter.filing_list('1')},set(forms[:3]))
