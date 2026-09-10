"""Verified corrections and quarantined aliases from the legacy ticker table.
Issuer/CUSIP evidence: reconciled SEC information tables retained in .cache/sec.
TER ticker: https://investors.teradyne.com/ (NASDAQ:TER).
Unverified replacement symbols intentionally fall back to CUSIP.
"""
VERIFIED = {'874039100': ('TSM', 'TAIWAN SEMICONDUCTOR'),
            '880770102': ('TER', 'TERADYNE')}
# These legacy aliases conflict with SEC issuer names or describe the wrong ETF.
QUARANTINED = {
    '876568502', '20030N101', '464287200', '922908363', 'G0750C108',
    '85208M102', '26856L103', '78467J100', '75886F107', '92556V106',
    '19247A100', '29414B104', '253868103', '76954A103', '87612E106',
    '69553P100', '87918A105', '464287655', '464287234', '46267X108', '52603B107',
}

def checked_mapping(mapping):
    result = {c:t for c,t in mapping.items() if c not in QUARANTINED}
    result.update({c:item[0] for c,item in VERIFIED.items()})
    return result


def validate_identity(holding):
    cusip = holding.get('cusip')
    if cusip in VERIFIED:
        ticker, issuer = VERIFIED[cusip]
        assert holding['t'].split(' [')[0].removesuffix(' CALL').removesuffix(' PUT') == ticker, (cusip, 'incorrect ticker')
        assert issuer in holding['n'].upper(), (cusip, 'issuer mismatch')
    if cusip in QUARANTINED:
        assert holding['t'].split(' [')[0].removesuffix(' CALL').removesuffix(' PUT') == cusip, (cusip, 'quarantined ticker alias')
    if holding['t'].split(' [')[0].removesuffix(' CALL').removesuffix(' PUT') == 'TSM':
        assert cusip == '874039100', ('TSM mapped to unrelated security', cusip)
