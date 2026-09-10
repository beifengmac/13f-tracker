"""Security identity from independently queried CUSIPs, never the legacy ticker table.
OpenFIGI responses are stored in security_registry.json, with ambiguous/missing
results retained. Symbols are reference labels, not historical point-in-time prices.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

VERIFIED = {'874039100': ('TSM', 'TAIWAN SEMICONDUCTOR'),
            '880770102': ('TER', 'TERADYNE'),
            '02079K305': ('GOOGL', 'ALPHABET'),
            '02079K107': ('GOOG', 'ALPHABET')}

@lru_cache(maxsize=1)
def registry():
    path=Path(__file__).with_name('security_registry.json')
    return json.loads(path.read_text()) if path.exists() else {}

def canonical_ticker(ticker):
    # Share class notation only; preserve other Bloomberg instrument suffixes.
    return ticker.replace('/','.') if re.fullmatch(r'[A-Z]+/[A-Z]',ticker) else ticker

@lru_cache(maxsize=1)
def resolved_mapping():
    result={c:canonical_ticker(r['ticker']) for c,r in registry().items() if r.get('status')=='resolved'}
    for cusip,(ticker,_) in VERIFIED.items():
        if cusip in result:
            assert result[cusip]==ticker,(cusip,'registry conflicts with verified identity')
        result[cusip]=ticker
    return result

def checked_mapping(mapping=None):
    # Argument retained for existing callers; legacy aliases are never trusted.
    return resolved_mapping()

def identity_status(cusip):
    if cusip in VERIFIED:return 'resolved'
    return registry().get(cusip,{}).get('status','pending')

def validate_identity(holding):
    cusip=holding.get('cusip')
    if not cusip:return
    base=holding['t'].split(' [')[0]
    if holding.get('o'):base=base.removesuffix(' '+holding['o'])
    expected=checked_mapping().get(cusip,cusip)
    assert base==expected,(cusip,'incorrect ticker',base,expected)
    if 'ticker_status' in holding:
        assert holding['ticker_status']==identity_status(cusip),(cusip,'incorrect lookup status')
    if cusip in VERIFIED:
        assert VERIFIED[cusip][1] in holding['n'].upper(),(cusip,'issuer mismatch')
