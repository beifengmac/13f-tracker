#!/usr/bin/env python3
"""SEC history adapter using OpenBB's 13F parser; cache raw filings, merge atomically.
No credentials or portfolio data are sent to an AI service.
"""
import argparse
import asyncio
import ast
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import time
import ssl
import certifi
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'sec'


def fetch(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.txt')
    if p.exists() and ('Archives/' in url or time.time() - p.stat().st_mtime < 3600):
        return p.read_text()
    time.sleep(.25)
    req = Request(url, headers={'User-Agent': os.environ.get('SEC_USER_AGENT', '13FTracker fo133553@gmail.com')})
    with urlopen(req, timeout=45, context=ssl.create_default_context(cafile=certifi.where())) as r:
        value = r.read().decode('utf-8')
    p.write_text(value)
    return value


def ticker_map():
    # Reuse mappings without importing the legacy fetcher's network side effects.
    tree = ast.parse((ROOT / 'scripts/fetch_13f.py').read_text())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'TICKER_MAP' for t in node.targets):
            return ast.literal_eval(node.value)
    return {}


def filing_list(cik):
    info = json.loads(fetch(f'https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json'))
    batches = [info['filings']['recent']]
    for entry in info['filings'].get('files', []):
        batches.append(json.loads(fetch('https://data.sec.gov/submissions/' + entry['name'])))
    rows = []
    for batch in batches:
        for i, form in enumerate(batch['form']):
            if form in ('13F-HR', '13F-HR/A') and batch['reportDate'][i] >= '2013-06-30':
                rows.append({k: batch[k][i] for k in ('form', 'reportDate', 'filingDate', 'accessionNumber')})
    return sorted(rows, key=lambda r: (r['reportDate'], r['filingDate'], r['accessionNumber']), reverse=True)


def metadata(text, key):
    match = re.search(r'<(?:\w+:)?' + key + r'[^>]*>(.*?)</(?:\w+:)?' + key + '>', text, re.S | re.I)
    return match.group(1).strip() if match else None


async def parse(text, filing, mapping):
    from openbb_sec.utils.parse_13f import parse_13f_hr
    records = await parse_13f_hr(text)
    if any(str(r['period_ending']) != filing['reportDate'] for r in records):
        raise ValueError('Parsed period does not match SEC submissions metadata')
    # SEC changed value units for filings submitted on/after 2023-01-03.
    # Filing date defines the normal unit; schemaVersion is not a reliable currency flag.
    # Some source files retain legacy thousand-dollar values. Preserve a transparent
    # inference flag instead of claiming those monetary amounts are verified.
    scale = 1000 if filing['filingDate'] < '2023-01-03' else 1
    implied = sorted(int(r['value']) / int(r['principal_amount']) for r in records
                     if r.get('security_type') == 'SH' and not r.get('putCall') and int(r['principal_amount']) > 0 and int(r['value']) > 0)
    inferred_unit = scale == 1 and bool(implied) and implied[len(implied)//2] < 1
    if inferred_unit:
        scale = 1000
    grouped = {}
    for r in records:
        option = str(r.get('putCall') or '').upper()
        cusip = r['cusip']
        key = (cusip, r.get('titleOfClass', ''), r.get('security_type', ''), option)
        if key not in grouped:
            ticker = mapping.get(cusip, cusip)
            grouped[key] = {'t': ticker + (' ' + option if option else ''), 'n': r['nameOfIssuer'],
                            'cusip': cusip, 'asset_class': key[1], 'security_type': key[2], 's': 0, 'v': 0, 'w': 0}
            if option:
                grouped[key]['o'] = option
        grouped[key]['s'] += int(r['principal_amount'])
        grouped[key]['v'] += int(r['value']) * scale
    holdings = sorted(grouped.values(), key=lambda h: h['v'], reverse=True)
    # Fail closed when the parser drops or duplicates rows relative to the filing cover.
    total = sum(h['v'] for h in holdings)
    declared = metadata(text, 'tableValueTotal')
    raw_xml = re.findall(r'<XML>(.*?)</XML>', text, re.S)
    raw_rows = []
    for xml in raw_xml:
        root = ET.fromstring(xml.strip())
        raw_rows.extend(e for e in root.iter() if e.tag.split('}')[-1].lower() == 'infotable')
    raw_total = sum(int(next(c.text for c in r if c.tag.split('}')[-1] == 'value')) for r in raw_rows) * scale
    delta = abs(total - int(declared.replace(',', '')) * scale) if declared else float('inf')
    if not holdings or total <= 0 or total != raw_total or delta > (len(raw_rows) + 1) * scale / 2:
        raise ValueError(f'Value reconciliation failed: parsed={total}, raw={raw_total}, cover={declared}')
    ticker_counts = defaultdict(int)
    for ticker in mapping.values():
        ticker_counts[ticker] += 1
    for h in holdings:
        if ticker_counts[h['t'].removesuffix(' CALL').removesuffix(' PUT')] > 1:
            h['t'] += ' [' + h['cusip'] + ' ' + h['asset_class'] + ']'
        h['t'] = h['t'].upper()
        h['w'] = h['v'] / total * 100
    return {'total': total, 'holdings': holdings, 'total_positions': len(holdings), 'complete': True,
            'period_ending': filing['reportDate'], 'filing_date': filing['filingDate'],
            'provider': 'OpenBB SEC', 'warnings': [], 'value_scale': scale, 'value_unit_inferred': inferred_unit, 'cover_rounding_difference_usd': delta}


async def run(args):
    path = Path(args.output)
    data = json.loads(path.read_text())
    mapping = ticker_map()
    ids = args.funds.split(',') if args.funds else list(data['funds'])
    failures = []
    for fid in ids:
        fund = data['funds'][fid]
        fund.setdefault('data_issues', {})
        try:
            filings = filing_list(fund['cik'])
        except Exception as exc:
            failures.append(f'{fid}: {exc}')
            continue
        periods = sorted({f['reportDate'] for f in filings}, reverse=True)[:args.quarters]
        for period in periods:
            candidates = [f for f in filings if f['reportDate'] == period]
            f = candidates[0]
            label = f'Q{int(period[5:7]) // 3} {period[:4]}'
            try:
                accession = f['accessionNumber']
                base = f'https://www.sec.gov/Archives/edgar/data/{int(fund["cik"])}/{accession.replace("-", "")}'
                text = fetch(f'{base}/{accession}.txt')
                source_urls = [f'{base}/{accession}-index.html']
                if f['form'].endswith('/A') and metadata(text, 'amendmentType') == 'NEW HOLDINGS':
                    chain = []
                    for previous in candidates:
                        acc = previous['accessionNumber']
                        prefix = f'https://www.sec.gov/Archives/edgar/data/{int(fund["cik"])}/{acc.replace("-", "")}'
                        document = fetch(f'{prefix}/{acc}.txt')
                        chain.append((previous, document, f'{prefix}/{acc}-index.html'))
                        if previous['form'] == '13F-HR' or metadata(document, 'amendmentType') == 'RESTATEMENT':
                            break
                    if chain[-1][0]['form'] != '13F-HR' and metadata(chain[-1][1], 'amendmentType') != 'RESTATEMENT':
                        raise ValueError('Amendment has no complete base filing')
                    q = await parse(chain[-1][1], chain[-1][0], mapping)
                    for extra, document, _ in reversed(chain[:-1]):
                        if metadata(document, 'amendmentType') != 'NEW HOLDINGS':
                            raise ValueError('Unsupported amendment type')
                        additions = await parse(document, extra, mapping)
                        identities = {(h['cusip'], h['asset_class'], h.get('o')) for h in q['holdings']}
                        if any((h['cusip'], h['asset_class'], h.get('o')) in identities for h in additions['holdings']):
                            raise ValueError('Amendment overlaps base securities; manual reconciliation required')
                        q['holdings'].extend(additions['holdings'])
                    q['total'] = sum(h['v'] for h in q['holdings'])
                    for h in q['holdings']:
                        h['w'] = h['v'] / q['total'] * 100
                    q['holdings'].sort(key=lambda h: h['v'], reverse=True)
                    q['total_positions'] = len(q['holdings'])
                    q['filing_date'] = f['filingDate']
                    q['amendment_note'] = 'Original filing plus disjoint NEW HOLDINGS amendments; sources listed'
                    source_urls = [item[2] for item in reversed(chain)]
                else:
                    if f['form'].endswith('/A') and metadata(text, 'amendmentType') != 'RESTATEMENT':
                        raise ValueError('Unknown amendment type')
                    q = await parse(text, f, mapping)
                q['source_url'] = source_urls[-1]
                q['source_urls'] = source_urls
                fund['quarters'][label] = q
                fund['data_issues'].pop(label, None)
                print(f'{fid} {label}: {len(q["holdings"])} securities, reconciled', flush=True)
            except Exception as exc:
                fund['data_issues'][label] = str(exc)
                failures.append(f'{fid} {label}: {exc}')
                print(f'{fid} {label}: {exc}', flush=True)
                if label in fund['quarters']:
                    fund['quarters'][label]['warnings'] = ['本期最新申报抓取或修订核对未完成，保留旧快照；暂停动作判断。']
        # Persist successful periods, never remove older quarters/funds on failure.
        data['generated'] = datetime.now(timezone.utc).date().isoformat()
        data['source'] = 'SEC EDGAR · OpenBB SEC parser (reconciled filings); legacy snapshots labelled'
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        temp.replace(path)
    if failures:
        print('\nFAILED (existing data preserved):\n' + '\n'.join(failures), flush=True)
        return 1
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(ROOT / 'src/data.json'))
    parser.add_argument('--funds', default='')
    parser.add_argument('--quarters', type=int, default=4)
    args = parser.parse_args()
    raise SystemExit(asyncio.run(run(args)))
