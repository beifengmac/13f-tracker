#!/usr/bin/env python3
"""Fail builds on inconsistent monetary totals, duplicate securities, or invalid weights."""
import json
import math
from pathlib import Path
path = Path(__file__).resolve().parents[1] / 'src/data.json'
data = json.loads(path.read_text())
quarters = rows = 0
for fid, fund in data['funds'].items():
    for label, quarter in fund['quarters'].items():
        holdings = quarter['holdings']
        assert len({h['t'] for h in holdings}) == len(holdings), (fid,label,'duplicate ticker')
        assert quarter['total'] > 0, (fid,label,'nonpositive total')
        for h in holdings:
            assert all(math.isfinite(h[k]) and h[k] >= 0 for k in ('s','v','w')), (fid,label,h)
            assert abs(h['w'] - h['v']/quarter['total']*100) < .02, (fid,label,'weight mismatch')
        if quarter.get('complete'):
            assert sum(h['v'] for h in holdings) == quarter['total'], (fid,label,'total mismatch')
            assert abs(sum(h['w'] for h in holdings)-100) < .001, (fid,label,'weights do not sum to 100')
            assert quarter.get('source_url','').startswith('https://www.sec.gov/Archives/'), (fid,label,'missing provenance')
        quarters += 1
        rows += len(holdings)
print(f'Validated {len(data["funds"])} funds, {quarters} snapshots, {rows} securities')
