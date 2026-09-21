#!/usr/bin/env python3
"""Resolve public CUSIPs through OpenFIGI; preserve raw responses and ambiguity.
No credentials required. Maximum 10 jobs/request, request starts at least 2.6s apart.
"""
import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import ssl
import certifi

ROOT=Path(__file__).resolve().parents[1]
REGISTRY=ROOT/'scripts/security_registry.json'
CACHE=ROOT/'.cache/openfigi'

def identifier_job(cusip, security_type='SH'):
    job = {'idType':'ID_CINS' if cusip[0].isalpha() else 'ID_CUSIP','idValue':cusip}
    # PRN is principal, not shares. Corporate bonds need no equity venue filter.
    return {**job, **({'marketSecDes':'Corp'} if security_type == 'PRN' else {'exchCode':'US'})}

def select_result(response, security_type='SH'):
    bond = security_type == 'PRN'
    candidates=[r for r in response.get('data',[]) if
                (r.get('marketSector') == 'Corp' if bond else r.get('exchCode')=='US' and r.get('marketSector')=='Equity')
                and r.get('ticker') and r.get('name') and (r.get('compositeFIGI') or r.get('figi'))]
    identities={(r['ticker'],r.get('compositeFIGI') or r.get('figi')) for r in candidates}
    if len(identities)!=1:
        return {'status':'ambiguous' if candidates else 'unresolved','candidates':candidates,'reason':response.get('warning') or ('No unique corporate bond match' if bond else 'No unique US equity match')}
    r=candidates[0]
    return {'status':'resolved','ticker':r['ticker'],'name':r['name'],'figi':r.get('figi'),
            'composite_figi':r.get('compositeFIGI'),'security_type':r.get('securityType'),
            'security_type2':r.get('securityType2'),'market_sector':r.get('marketSector'),'exchange':r.get('exchCode'),'source':'https://api.openfigi.com/v3/mapping'}

def save(path,data):
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp.replace(path)

def main(limit=0,refresh_days=90):
    data=json.loads((ROOT/'src/data.json').read_text())
    scores={}
    security_types={}
    for f in data['funds'].values():
        for q in f['quarters'].values():
            for h in q['holdings']:
                c=h.get('cusip')
                if c:
                    scores[c]=max(scores.get(c,0),h['w'])
                    security_types.setdefault(c,set()).add(h.get('security_type','SH'))
    # Mixed/unknown types retain the stricter equity lookup.
    kinds={c: 'PRN' if types == {'PRN'} else 'SH' for c,types in security_types.items()}
    jobs={c:identifier_job(c,kinds[c]) for c in scores}
    registry=json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {}
    def stale(c):
        r=registry.get(c)
        if not r:return True
        if kinds[c]=='PRN' and r.get('query') != jobs[c]:return True
        if r.get('status')=='invalid':return False
        if c[0].isalpha() and r.get('id_type')!='ID_CINS':return True
        try:return (datetime.now(timezone.utc)-datetime.fromisoformat(r['queried_at'])).days>=refresh_days
        except (KeyError,ValueError):return True
    pending=[c for c in sorted(scores,key=lambda c:-scores[c]) if stale(c)]
    if limit:pending=pending[:limit]
    CACHE.mkdir(parents=True,exist_ok=True)
    print(f'Need {len(pending)} CUSIPs; {len(registry)} cached',flush=True)
    errors=0
    for start in range(0,len(pending),10):
        started=time.monotonic()
        batch=pending[start:start+10]
        request=Request('https://api.openfigi.com/v3/mapping',
            data=json.dumps([jobs[c] for c in batch]).encode(),
            headers={'Content-Type':'application/json','User-Agent':'13FTracker/1.0'},method='POST')
        response=None
        for attempt in range(4):
            try:
                with urlopen(request,timeout=45,context=ssl.create_default_context(cafile=certifi.where())) as r:response=json.load(r)
                if not isinstance(response,list) or len(response)!=len(batch):raise ValueError('Unexpected batch response')
                break
            except Exception as exc:
                response=None
                print(f'Retry {attempt+1}: {type(exc).__name__} {exc}',flush=True)
                if isinstance(exc,HTTPError) and exc.code==429:
                    try:delay=int(exc.headers.get('Retry-After','60'))
                    except ValueError:delay=60
                    time.sleep(max(60,delay))
                else:time.sleep(3*(attempt+1))
        if response is None:
            errors+=len(batch)
            if errors>=30:raise RuntimeError('Repeated API failures; cached progress preserved')
            continue
        stamp=datetime.now(timezone.utc).isoformat()
        for c,r in zip(batch,response):
            save(CACHE/f'{c}.json',r)
            # API/validation errors are retryable, not permanent missing mappings.
            if 'error' in r:
                print(f'{c}: {r["error"]}',flush=True)
                if 'Invalid idValue format' in r['error']:
                    registry[c]={'status':'invalid','reason':r['error'],'queried_at':stamp,'query':jobs[c]}
                continue
            registry[c]={**select_result(r,kinds[c]),'query':jobs[c],'queried_at':stamp,'id_type':'ID_CINS' if c[0].isalpha() else 'ID_CUSIP'}
        save(REGISTRY,registry)
        if start%100==0 or start+10>=len(pending):
            resolved=sum(r['status']=='resolved' for r in registry.values())
            print(f'Progress {min(start+10,len(pending))}/{len(pending)}; resolved {resolved}/{len(registry)}',flush=True)
        time.sleep(max(0,2.6-(time.monotonic()-started)))
    return registry

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--limit',type=int,default=0);p.add_argument('--refresh-days',type=int,default=90)
    args=p.parse_args();main(args.limit,args.refresh_days)
