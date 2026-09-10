#!/usr/bin/env python3
"""Relabel all snapshots after identity resolution; financial fields stay untouched."""
import json
from collections import Counter
from pathlib import Path
try:
    from security_identity import checked_mapping, identity_status, validate_identity
except ModuleNotFoundError:
    from scripts.security_identity import checked_mapping, identity_status, validate_identity
ROOT=Path(__file__).resolve().parents[1]

def apply(data):
    mapping=checked_mapping();counts=Counter(mapping.values());changed=0
    for f in data['funds'].values():
        for q in f['quarters'].values():
            for h in q['holdings']:
                c=h.get('cusip')
                if not c:continue
                base=mapping.get(c,c)
                t=base+(' '+h['o'] if h.get('o') else '')
                if counts[base]>1:t+=' ['+c+']'
                changed+=h['t']!=t
                h['t']=t;h['ticker_status']=identity_status(c)
            # Same CUSIP can contain different classes/types in one filing.
            dup=Counter(h['t'] for h in q['holdings'])
            for h in q['holdings']:
                if dup[h['t']]>1:
                    h['t']+=' ['+h.get('cusip','')+' '+h.get('asset_class','')+' '+h.get('security_type','')+']'
                validate_identity(h)
    return changed

if __name__=='__main__':
    path=ROOT/'src/data.json';data=json.loads(path.read_text())
    print(f'Relabelled {apply(data)} records; quantities and valuations unchanged.')
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
