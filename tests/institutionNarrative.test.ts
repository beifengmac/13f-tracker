import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {institutionNarrative} from '../src/institutionNarrative.ts';
import {getQuarterKeys} from '../src/utils.ts';
import type {Data} from '../src/types.ts';
const data=JSON.parse(readFileSync(new URL('../src/data.json',import.meta.url),'utf8')) as Data;
test('every institution receives six data-specific sections, independent of Stan baskets',()=>{
 const summaries=new Set();
 for(const f of Object.values(data.funds)){
   const r=institutionNarrative(f,getQuarterKeys(f).at(-1)!);
   assert.equal(r.sections.length,6);
   assert.ok(r.sections[0].facts.length>0);
   assert.ok(r.sections[5].facts.length>0);
   assert.ok(r.summary.includes(f.name_cn));
   assert.doesNotMatch(JSON.stringify(r),/NaN|undefined/);
   summaries.add(r.summary);
 }
 assert.equal(summaries.size,Object.keys(data.funds).length);
});
test('historical selection limits history and missing comparisons suppress trade analysis',()=>{
 const f=data.funds.berkshire;
 const first=getQuarterKeys(f)[0];
 const r=institutionNarrative(f,first);
 assert.equal(r.historyCount,1);
 assert.equal(r.complete,false);
 assert.equal(r.sections[1].facts.length,0);
 assert.match(r.sections[5].judgment,/不足 12/);
 const partial=structuredClone(f), latest=getQuarterKeys(f).at(-1)!;
 partial.quarters[latest].warnings=['unreconciled'];
 const p=institutionNarrative(partial,latest);
 assert.equal(p.complete,false);
 assert.equal(p.sections[1].facts.length,0);
 assert.equal(p.sections[2].facts.length,0);
});
test('options are separate and stable shares are not called active allocation changes',()=>{
 const r=institutionNarrative(data.funds.duquesne,'Q2 2026');
 assert.ok(r.sections[4].facts.some(f=>f.includes('CALL')));
 for(const s of r.sections.slice(0,4)) assert.ok(s.facts.every(f=>!f.includes(' CALL')));
 assert.match(r.sections[3].judgment,/不能称为主动加减仓|两期配置数量延续/);
});
