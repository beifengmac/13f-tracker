#!/usr/bin/env python3
"""
Fetch latest 13F filings from SEC EDGAR for tracked investors.
Uses the data.sec.gov submissions API (more reliable than CGI endpoints).

Usage:
  python scripts/fetch_13f.py [--output data.json] [--quarters 4]
"""

import json
import sys
import os
import re
import time
import ssl
import argparse
import xml.etree.ElementTree as ET
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from datetime import datetime

# SEC requires email in User-Agent
USER_AGENT = "13FTracker admin@13ftracker.com"

# SSL context — try default first, fall back for local dev
def _make_ssl_ctx():
    try:
        ctx = ssl.create_default_context()
        urlopen(Request('https://data.sec.gov/', headers={'User-Agent': USER_AGENT}),
                context=ctx, timeout=5)
        return ctx
    except Exception:
        return ssl._create_unverified_context()

_SSL_CTX = _make_ssl_ctx()


def sec_fetch(url, retries=2):
    """Fetch URL from SEC with rate limiting and retries."""
    for attempt in range(retries + 1):
        time.sleep(0.12)  # SEC rate limit: ~10 req/sec
        req = Request(url, headers={
            'User-Agent': USER_AGENT,
            'Accept': 'application/json,application/xml,text/xml,*/*',
        })
        try:
            with urlopen(req, timeout=30, context=_SSL_CTX) as resp:
                return resp.read()
        except HTTPError as e:
            if e.code == 429 and attempt < retries:
                print(f"  ⏳ Rate limited, waiting 2s...", file=sys.stderr)
                time.sleep(2)
                continue
            print(f"  HTTP {e.code} fetching {url}", file=sys.stderr)
            return None
        except Exception as e:
            if attempt < retries:
                time.sleep(1)
                continue
            print(f"  Error: {e}", file=sys.stderr)
            return None
    return None


# ─── Fund Registry ────────────────────────────────────────────────
FUNDS = {
    'berkshire': {
        'name_en': 'Berkshire Hathaway', 'name_cn': '伯克希尔·哈撒韦',
        'manager': '巴菲特', 'manager_en': 'Warren Buffett',
        'description': '价值投资之神，全球最受尊敬的投资人',
        'cik': '0001067983', 'max_holdings': None,
    },
    'bridgewater': {
        'name_en': 'Bridgewater Associates', 'name_cn': '桥水基金',
        'manager': '达利欧', 'manager_en': 'Ray Dalio',
        'description': '全球最大对冲基金，全天候策略创始人',
        'cik': '0001350694', 'max_holdings': 50,
    },
    'blackrock': {
        'name_en': 'BlackRock Inc.', 'name_cn': '贝莱德',
        'manager': '拉里·芬克', 'manager_en': 'Larry Fink',
        'description': '全球最大资产管理公司，管理超10万亿美元',
        'cik': '0002012383', 'max_holdings': 30,
    },
    'ark': {
        'name_en': 'ARK Investment Management', 'name_cn': 'ARK 方舟投资',
        'manager': '木头姐', 'manager_en': 'Cathie Wood',
        'description': '颠覆式创新ETF管理人，重仓特斯拉/AI/基因编辑',
        'cik': '0001697748', 'max_holdings': 50,
    },
    'hhlr': {
        'name_en': 'HHLR Advisors', 'name_cn': '高瓴资本',
        'manager': '张磊', 'manager_en': 'Zhang Lei',
        'description': '全球最大中概股投资基金之一，重仓生物医药+中概互联网',
        'cik': '0001762304', 'max_holdings': None,
    },
    'himalaya': {
        'name_en': 'Himalaya Capital', 'name_cn': '喜马拉雅资本',
        'manager': '李录', 'manager_en': 'Li Lu',
        'description': '查理·芒格唯一委托管理资金的华人基金经理',
        'cik': '0001709323', 'max_holdings': None,
    },
    'hh': {
        'name_en': 'H&H International Investment', 'name_cn': '段永平',
        'manager': '段永平', 'manager_en': 'Duan Yongping',
        'description': '步步高/OPPO/vivo创始人，传奇价值投资人',
        'cik': '0001759760', 'max_holdings': None,
    },
    'danbin': {
        'name_en': 'Oriental Harbor Investment', 'name_cn': '东方港湾',
        'manager': '但斌', 'manager_en': 'Dan Bin',
        'description': '中国私募教父，长期主义践行者',
        'cik': '0002046333', 'max_holdings': None,
    },
    'duquesne': {
        'name_en': 'Duquesne Family Office', 'name_cn': '杜肯家族办公室',
        'manager': '德鲁肯米勒', 'manager_en': 'Stanley Druckenmiller',
        'description': '索罗斯前首席操盘手，宏观交易传奇，30年无亏损年',
        'cik': '0001536411', 'max_holdings': None,
    },
}

# ─── CUSIP → Ticker ──────────────────────────────────────────────
# Legacy command shares the verified registry; no hand-maintained aliases.
try:
    from security_identity import checked_mapping
except ModuleNotFoundError:
    from scripts.security_identity import checked_mapping
TICKER_MAP = checked_mapping()

TICKER_ALIASES = {
    # Treat Alphabet A/C classes as one company-level position throughout the app.
    'GOOGL': 'GOOG',
}

NAME_OVERRIDES = {
    'GOOG': 'ALPHABET INC',
}


def find_filings_via_api(cik, num_quarters=4):
    """Find latest 13F-HR filings using data.sec.gov submissions API."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    data = sec_fetch(url)
    if not data:
        return []

    info = json.loads(data)
    recent = info.get('filings', {}).get('recent', {})
    forms = recent.get('form', [])
    periods = recent.get('reportDate', [])
    accessions = recent.get('accessionNumber', [])

    q_map = {'03': 'Q1', '06': 'Q2', '09': 'Q3', '12': 'Q4'}
    filings = []
    seen_periods = set()

    for i in range(len(forms)):
        if forms[i] not in ('13F-HR', '13F-HR/A'):
            continue
        period = periods[i]  # YYYY-MM-DD
        if period in seen_periods:
            continue
        seen_periods.add(period)

        month = period[5:7]
        year = period[:4]
        q = q_map.get(month, f'M{month}')
        label = f"{q} {year}"

        # accessionNumber format: 0002046333-26-000002
        adsh = accessions[i].replace('-', '')

        filings.append({
            'adsh': adsh,
            'adsh_formatted': accessions[i],
            'period': period,
            'label': label,
            'cik_num': cik.lstrip('0'),
        })

        if len(filings) >= num_quarters:
            break

    return filings


def find_infotable_url(cik_num, adsh, adsh_formatted):
    """Find the infotable XML URL for a filing."""
    idx_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{adsh}/{adsh_formatted}-index.htm"
    html = sec_fetch(idx_url)
    if not html:
        return None
    html = html.decode('utf-8', errors='replace')

    matches = re.findall(r'href="([^"]*\.xml)"', html)
    candidates = []
    for m in matches:
        basename = m.split('/')[-1].lower()
        if 'primary' in basename or 'xsl' in m.lower():
            continue
        if any(kw in basename for kw in ('infotable', '13f', 'holdings', 'ohif')):
            fname = m.split('/')[-1]
            return f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{adsh}/{fname}"
        candidates.append(m)

    # Fallback: pick the first non-primary XML (e.g. numeric filenames like 53405.xml)
    if candidates:
        fname = candidates[0].split('/')[-1]
        return f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{adsh}/{fname}"

    return None


def parse_13f_xml(xml_data, max_holdings=None):
    """Parse 13F XML into holdings dict. Returns (limited, all).
    Auto-detects if values are in thousands (some filers) and normalizes to full USD."""
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError as e:
        print(f"  XML parse error: {e}", file=sys.stderr)
        return {}, {}

    holdings = {}
    for elem in root.iter():
        local = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        if local.lower() == 'infotable':
            record = {}
            for child in elem.iter():
                cl = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                if child.text and child.text.strip():
                    record[cl] = child.text.strip()

            cusip = record.get('cusip', '')
            name = record.get('nameOfIssuer', '')
            put_call = record.get('putCall', '').upper()

            try:
                value = int(record.get('value', '0'))
            except ValueError:
                value = 0
            try:
                shares = int(record.get('sshPrnamt', '0'))
            except ValueError:
                shares = 0

            key = f"{cusip}:{put_call}" if put_call else cusip
            if key in holdings:
                holdings[key]['value'] += value
                holdings[key]['shares'] += shares
            else:
                holdings[key] = {
                    'name': name, 'cusip': cusip,
                    'value': value, 'shares': shares, 'put_call': put_call,
                }

    # Auto-detect if values are in thousands:
    # Calculate median implied price; if < $1 for most holdings, values are in thousands
    implied_prices = []
    for h in holdings.values():
        if h['shares'] > 0 and h['value'] > 0:
            implied_prices.append(h['value'] / h['shares'])
    if implied_prices:
        implied_prices.sort()
        median_price = implied_prices[len(implied_prices) // 2]
        if median_price < 1.0:  # Values are in thousands, normalize to full USD
            for h in holdings.values():
                h['value'] *= 1000

    sorted_h = dict(sorted(holdings.items(), key=lambda x: x[1]['value'], reverse=True))
    all_holdings = sorted_h
    if max_holdings:
        sorted_h = dict(list(sorted_h.items())[:max_holdings])
    return sorted_h, all_holdings


def process_fund(fund_id, fund_info, num_quarters=4):
    """Fetch and process all quarterly data for one fund."""
    cik = fund_info['cik']
    print(f"\n📊 {fund_info['name_cn']} ({fund_info['name_en']}) CIK={cik}")

    filings = find_filings_via_api(cik, num_quarters)
    if not filings:
        print(f"  ❌ No filings found!")
        return None

    fund_data = {
        'name_en': fund_info['name_en'],
        'name_cn': fund_info['name_cn'],
        'manager': fund_info['manager'],
        'manager_en': fund_info['manager_en'],
        'description': fund_info['description'],
        'cik': cik,
        'quarters': {},
    }

    for filing in filings:
        label = filing['label']
        print(f"  {label} (period {filing['period']})...", end=' ', flush=True)

        info_url = find_infotable_url(filing['cik_num'], filing['adsh'], filing['adsh_formatted'])
        if not info_url:
            print("❌ no infotable")
            continue

        xml_data = sec_fetch(info_url)
        if not xml_data:
            print("❌ download failed")
            continue

        limited, all_h = parse_13f_xml(xml_data, fund_info.get('max_holdings'))
        total = sum(h['value'] for h in all_h.values())

        quarter_map = {}
        for _, h in limited.items():
            cusip = h['cusip']
            # Never invent pseudo-tickers from issuer names. If a CUSIP is not
            # mapped yet, keep the stable CUSIP visible so it can be audited.
            base_ticker = TICKER_MAP.get(cusip, cusip)
            base_ticker = TICKER_ALIASES.get(base_ticker, base_ticker)
            put_call = h.get('put_call')
            ticker = f"{base_ticker} {put_call}" if put_call else base_ticker
            if ticker not in quarter_map:
                holding = {
                    't': ticker, 'n': NAME_OVERRIDES.get(base_ticker, h['name']),
                    'v': 0, 's': 0, 'w': 0,
                }
                if put_call:
                    holding['o'] = put_call
                quarter_map[ticker] = holding
            quarter_map[ticker]['v'] += h['value']
            quarter_map[ticker]['s'] += h['shares']

        quarter_holdings = sorted(quarter_map.values(), key=lambda x: x['v'], reverse=True)
        for holding in quarter_holdings:
            holding['w'] = round(holding['v'] / total * 100, 2) if total > 0 else 0

        fund_data['quarters'][label] = {
            'total': total,
            'holdings': quarter_holdings,
            'total_positions': len(all_h),
        }
        print(f"✅ {len(quarter_holdings)} holdings (of {len(all_h)}), ${total/1e9:.2f}B")

    return fund_data


def main():
    parser = argparse.ArgumentParser(description='Fetch 13F data from SEC EDGAR')
    parser.add_argument('--output', '-o', default='data.json', help='Output JSON file')
    parser.add_argument('--quarters', '-q', type=int, default=4, help='Quarters to fetch')
    args = parser.parse_args()

    print(f"🚀 Fetching 13F data for {len(FUNDS)} funds, {args.quarters} quarters each")
    print(f"   Output: {args.output}")
    print(f"   Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    output = {
        'funds': {},
        'generated': datetime.now().strftime('%Y-%m-%d'),
        'source': 'SEC EDGAR 13F-HR',
    }

    for fund_id, fund_info in FUNDS.items():
        fund_data = process_fund(fund_id, fund_info, args.quarters)
        if fund_data:
            output['funds'][fund_id] = fund_data

    with open(args.output, 'w') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done! {len(output['funds'])} funds → {args.output} ({os.path.getsize(args.output)/1024:.0f}KB)")
    for fid, fd in output['funds'].items():
        qs = list(fd['quarters'].keys())
        latest = fd['quarters'][qs[0]] if qs else {}
        print(f"  {fd['name_cn']}: {qs[0] if qs else 'N/A'} ${latest.get('total',0)/1e9:.1f}B")


if __name__ == '__main__':
    main()
