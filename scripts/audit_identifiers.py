#!/usr/bin/env python3
"""Summarize identifier coverage and retain every missing/ambiguous security."""
import json
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'src/data.json').read_text());registry=json.loads((ROOT/'scripts/security_registry.json').read_text())
held={h['cusip'] for f in data['funds'].values() for q in f['quarters'].values() for h in q['holdings'] if h.get('cusip')}
result={'source':'https://api.openfigi.com/v3/mapping','unique_cusips':len(held),'registry_entries':len(registry),'queried_through':max((r.get('queried_at','') for r in registry.values()),default=''),'statuses':dict(Counter(registry.get(c,{}).get('status','pending') for c in held)),'funds':{}}
for fid,f in data['funds'].items():
    key=max(f['quarters'],key=lambda k:(int(k.split()[1]),int(k[1])))
    rows=f['quarters'][key]['holdings'];unknown=[h for h in rows if h.get('ticker_status')!='resolved']
    result['funds'][fid]={'quarter':key,'records':len(rows),'unresolved_records':len(unknown),'unresolved_weight':sum(h['w'] for h in unknown),'unresolved':[{'cusip':h.get('cusip'),'name':h['n'],'class':h.get('asset_class'),'weight':h['w'],'status':h.get('ticker_status')} for h in unknown]}
path=ROOT/'docs/security-identification-audit.json';path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({**result,'funds':{k:{x:y for x,y in v.items() if x!='unresolved'} for k,v in result['funds'].items()}},ensure_ascii=False,indent=2))
