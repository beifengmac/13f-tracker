import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { researchNarrative, referenceChecks } from '../src/researchNarrative.ts';
import type { Fund, Data } from '../src/types.ts';
const data=JSON.parse(readFileSync(new URL('../src/data.json',import.meta.url),'utf8')) as Data;
const stan=data.funds.duquesne;
test('Q2 research checks article figures and separates options from ordinary weights',()=>{
 const r=researchNarrative(stan,'Q2 2026');
 const bio=r.sections.find(s=>s.id==='biotech')!;
 assert.ok(Math.abs(bio.currentWeight-19.51355)<.001);
 assert.match(bio.judgment,/数量增加，但合计权重下降/);
 assert.match(bio.optionFacts,/INSM CALL 新出现/);
 assert.match(r.synthesis,/11.79% → 10.68%/);
 assert.match(r.synthesis,/0.00% → 2.78%/);
 const checks=referenceChecks(stan,'Q2 2026');
 assert.match(checks[0].finding,/3,186,306/);
 assert.match(checks[1].finding,/GOOG，CUSIP 02079K305/);
 assert.match(checks[2].finding,/11.83 倍/);
});
test('historical selection never includes the later article or future new baskets',()=>{
 assert.deepEqual(referenceChecks(stan,'Q1 2026'),[]);
 assert.equal(researchNarrative(stan,'Q1 2026').sections.find(s=>s.id==='infrastructure'),undefined);
});
test('incomplete snapshots suppress interpretation and do not imply exits',()=>{
 const f=structuredClone(stan); f.quarters['Q2 2026'].complete=false;
 const r=researchNarrative(f,'Q2 2026');
 assert.equal(r.complete,false);
 assert.ok(r.sections.every(s=>s.confidence==='低' && s.previousWeight===null));
 assert.match(r.synthesis,/暂不输出/);
});
test('opposite basket directions and cleared options never use stale bullish prose or quantities',()=>{
 const q1=structuredClone(stan.quarters['Q2 2026']);
 const q2=structuredClone(stan.quarters['Q1 2026']);
 const f:Fund={...stan,cik:'1',quarters:{'Q1 2026':q1,'Q2 2026':q2}};
 const r=researchNarrative(f,'Q2 2026');
 assert.doesNotMatch(r.synthesis,/两组权重同时提高/);
 assert.match(r.sections.find(s=>s.id==='infrastructure')!.judgment,/支持降低/);
 assert.match(r.sections.find(s=>s.id==='biotech')!.optionFacts,/→ 0/);
 assert.deepEqual(referenceChecks(f,'Q2 2026'),[]);
});
test('all available funds and quarters render finite aggregate weights and bounded histories',()=>{
 for(const f of Object.values(data.funds)) for(const quarter of Object.keys(f.quarters)){
   const r=researchNarrative(f,quarter);
   assert.ok(Number.isFinite(r.topWeight));
   for(const s of r.sections) assert.ok(Number.isFinite(s.currentWeight));
   assert.doesNotMatch(r.synthesis,/NaN|undefined/);
 }
});
