import copy
import unittest
from unittest.mock import patch
from scripts.apply_identifiers import apply

class ApplyIdentifierTests(unittest.TestCase):
    def test_relabel_preserves_financial_fields_and_uses_cusip_for_identity(self):
        rows=[{'t':'OLD','n':'Issuer','cusip':'123456789','asset_class':'COM','security_type':'SH','s':12,'v':120,'w':60},
              {'t':'OTHER','n':'Issuer','cusip':'987654321','asset_class':'COM','security_type':'SH','s':8,'v':80,'w':40}]
        data={'funds':{'f':{'quarters':{'Q1 2026':{'total':200,'holdings':copy.deepcopy(rows)}}}}}
        with patch('scripts.apply_identifiers.checked_mapping',return_value={'123456789':'ABC','987654321':'ABC'}),patch('scripts.apply_identifiers.identity_status',return_value='resolved'),patch('scripts.apply_identifiers.validate_identity'):
            apply(data)
        updated=data['funds']['f']['quarters']['Q1 2026']['holdings']
        self.assertEqual([h['t'] for h in updated],['ABC [123456789]','ABC [987654321]'])
        for before,after in zip(rows,updated):
            self.assertEqual({k:v for k,v in before.items() if k!='t'},{k:v for k,v in after.items() if k not in ('t','ticker_status')})
    def test_unresolved_security_is_retained(self):
        data={'funds':{'f':{'quarters':{'Q1 2026':{'total':100,'holdings':[{'t':'WRONG','cusip':'123456789','n':'Issuer','s':10,'v':100,'w':100}]}}}}}
        with patch('scripts.apply_identifiers.checked_mapping',return_value={}),patch('scripts.apply_identifiers.identity_status',return_value='ambiguous'),patch('scripts.apply_identifiers.validate_identity'):
            apply(data)
        h=data['funds']['f']['quarters']['Q1 2026']['holdings'][0]
        self.assertEqual(h['t'],'123456789');self.assertEqual(h['ticker_status'],'ambiguous');self.assertEqual(h['w'],100)
