import unittest
from scripts.security_identity import checked_mapping, validate_identity, QUARANTINED
from scripts.import_openbb import ticker_map

class SecurityIdentityTests(unittest.TestCase):
    def test_legacy_alias_is_corrected_and_unverified_alias_removed(self):
        mapping=checked_mapping({'880770102':'TSM','874039100':'TSM','876568502':'TSM','20030N101':'CB'})
        self.assertEqual(mapping['880770102'],'TER')
        self.assertEqual(mapping['874039100'],'TSM')
        self.assertNotIn('876568502',mapping)
        self.assertNotIn('20030N101',mapping)
    def test_future_updates_cannot_restore_quarantined_aliases(self):
        mapping=ticker_map()
        self.assertTrue(QUARANTINED.isdisjoint(mapping))
        self.assertEqual([c for c,t in mapping.items() if t=='TSM'],['874039100'])
    def test_issuer_and_ticker_mismatch_fails_validation(self):
        with self.assertRaises(AssertionError):
            validate_identity({'cusip':'880770102','t':'TSM','n':'TERADYNE INC'})
        with self.assertRaises(AssertionError):
            validate_identity({'cusip':'874039100','t':'TSM','n':'TERADYNE INC'})
        validate_identity({'cusip':'880770102','t':'TER','n':'TERADYNE INC'})
