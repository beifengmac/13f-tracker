import unittest
from scripts.security_identity import checked_mapping, validate_identity, canonical_ticker
from scripts.resolve_identifiers import select_result, identifier_job

class SecurityIdentityTests(unittest.TestCase):
    def test_foreign_issuer_uses_cins_without_guessing_its_ticker(self):
        self.assertEqual(identifier_job('H1467J104')['idType'],'ID_CINS')
        self.assertEqual(identifier_job('G11448100')['idType'],'ID_CINS')
        self.assertEqual(identifier_job('874039100')['idType'],'ID_CUSIP')

    def test_legacy_aliases_are_not_trusted(self):
        mapping=checked_mapping({'880770102':'TSM','874039100':'TSM','876568502':'TSM','NOTACUSIP':'FAKE'})
        self.assertEqual(mapping['880770102'],'TER')
        self.assertEqual(mapping['874039100'],'TSM')
        self.assertNotIn('NOTACUSIP',mapping)
        self.assertEqual(mapping['02079K305'],'GOOGL')
        self.assertEqual(mapping['02079K107'],'GOOG')
    def test_issuer_and_ticker_mismatch_fails_validation(self):
        with self.assertRaises(AssertionError):validate_identity({'cusip':'880770102','t':'TSM','n':'TERADYNE INC'})
        with self.assertRaises(AssertionError):validate_identity({'cusip':'874039100','t':'TSM','n':'TERADYNE INC'})
        validate_identity({'cusip':'880770102','t':'TER','n':'TERADYNE INC'})
    def test_classes_and_options_are_not_collapsed(self):
        self.assertEqual(canonical_ticker('BRK/B'),'BRK.B')
        self.assertEqual(canonical_ticker('ABC WS'),'ABC WS')
        validate_identity({'cusip':'02079K305','t':'GOOGL CALL','o':'CALL','n':'ALPHABET INC'})
    def test_ambiguous_or_foreign_only_candidates_are_not_guessed(self):
        a={'ticker':'A','figi':'1','name':'Issuer','exchCode':'US','marketSector':'Equity'}
        b={**a,'ticker':'B','figi':'2'}
        self.assertEqual(select_result({'data':[a,b]})['status'],'ambiguous')
        self.assertEqual(select_result({'data':[{**a,'exchCode':'LN'}]})['status'],'unresolved')
        self.assertEqual(select_result({'warning':'No identifier found'})['status'],'unresolved')
        self.assertEqual(select_result({'data':[a]})['ticker'],'A')

    def test_principal_lookup_is_not_limited_to_us_equity_venues(self):
        self.assertEqual(identifier_job('008073AA6', 'PRN'),
                         {'idType':'ID_CUSIP','idValue':'008073AA6','marketSecDes':'Corp'})
        self.assertEqual(identifier_job('G11448100', 'PRN')['idType'], 'ID_CINS')

    def test_bond_identity_keeps_coupon_maturity_and_rejects_common_stock(self):
        bond={'ticker':'AVAV 0 07/15/30','figi':'BBG01VVSLGQ7','name':'AEROVIRONMENT INC',
              'exchCode':'TRACE','marketSector':'Corp','securityType':'GLOBAL'}
        stock={**bond,'ticker':'AVAV','figi':'stock','marketSector':'Equity','exchCode':'US'}
        self.assertEqual(select_result({'data':[stock,bond]}, 'PRN')['ticker'], 'AVAV 0 07/15/30')
        self.assertEqual(select_result({'data':[bond]})['status'], 'unresolved')
        self.assertEqual(select_result({'data':[stock]}, 'PRN')['status'], 'unresolved')
        other={**bond,'figi':'other','ticker':'AVAV 0 07/15/31'}
        self.assertEqual(select_result({'data':[bond,other]}, 'PRN')['status'], 'ambiguous')
        self.assertEqual(select_result({'data':[bond,{**bond,'exchCode':'FRANKFURT'}]}, 'PRN')['status'], 'resolved')
