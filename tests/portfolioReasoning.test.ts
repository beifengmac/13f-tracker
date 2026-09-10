import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {portfolioReasoning} from '../src/portfolioReasoning.ts';
import {getQuarterKeys} from '../src/utils.ts';
import type {Data,Fund,Holding,Quarter} from '../src/types.ts';
const data=JSON.parse(readFileSync(new URL('../src/data.json',import.meta.url),'utf8')) as Data;
const h=(t:string,s:number,w:number,o?:'CALL'|'PUT'):Holding=>({t,n:t,s,v:s*10,w,o,cusip:t.replace(/ (CALL|PUT)/,'')});
const q=(holdings:Holding[]):Quarter=>({holdings,total:1000,complete:true});
const f=(quarters:Fund['quarters']):Fund=>({...data.funds.berkshire,cik:'1',quarters});
test('core continuity and core replacement produce different conclusions',()=>{
 const before=q([h('A',10,70),h('B',10,30)]);
 const retained=portfolioReasoning(f({'Q1 2026':before,'Q2 2026':q([h('A',10,50),h('B',10,20),h('C',5,30)])}),'Q2 2026');
 const replaced=portfolioReasoning(f({'Q1 2026':before,'Q2 2026':q([h('A',10,50),h('C',5,50)])}),'Q2 2026');
 assert.match(retained.blocks.core.tendency,/全部延续/);
 assert.match(retained.blocks.core.judgment,/向其余证券分散/);
 assert.match(replaced.blocks.core.tendency,/核心名单发生替换/);
 assert.notEqual(retained.summary,replaced.summary);
});
test('relative size distinguishes new leading positions from smaller additions',()=>{
 const a=q([h('A',10,100)]);
 const small=portfolioReasoning(f({'Q1 2026':a,'Q2 2026':q([h('A',10,60),...['B','C','D','E','F'].map((x,i)=>h(x,10,10-i))])}),'Q2 2026');
 assert.match(small.blocks.adds.judgment,/最大普通证券 A/);
 assert.match(small.blocks.adds.facts.join(''),/新出现普通证券 5 项/);
});
test('a share-count trend ends at a reversal, gap, or warning; weight gains alone do not establish it',()=>{
 const fund=f({'Q4 2025':q([h('A',10,40)]),'Q1 2026':q([h('A',12,50)]),'Q2 2026':q([h('A',14,60)])});
 assert.match(portfolioReasoning(fund,'Q2 2026').blocks.history.tendency,/连续 2 次增持/);
 fund.quarters['Q2 2026']=q([h('A',11,60)]);
 assert.doesNotMatch(portfolioReasoning(fund,'Q2 2026').blocks.history.tendency,/连续 2 次/);
 fund.quarters['Q2 2026']=q([h('A',14,60)]);fund.quarters['Q1 2026'].warnings=['unreconciled'];
 assert.doesNotMatch(portfolioReasoning(fund,'Q2 2026').blocks.history.tendency,/连续 2 次/);
 delete fund.quarters['Q1 2026'];
 assert.doesNotMatch(portfolioReasoning(fund,'Q2 2026').blocks.history.tendency,/连续 2 次/);
});
test('PUT and common additions do not become an unqualified bullish claim',()=>{
 const r=portfolioReasoning(f({'Q1 2026':q([h('A',10,90)]),'Q2 2026':q([h('A',12,80),h('A PUT',2,20,'PUT')])}),'Q2 2026');
 assert.match(r.blocks.options.judgment,/PUT 可能用于保护/);
 assert.match(r.blocks.options.counterevidence,/不能直接合成/);
});
test('every institution gets grounded reasoning without nonfinite values or future records',()=>{
 for(const fund of Object.values(data.funds)){
   const keys=getQuarterKeys(fund);
   for(const quarter of [keys[0],keys.at(-1)!]){
     const report=portfolioReasoning(fund,quarter);
     assert.equal(Object.keys(report.blocks).length,6);
     assert.doesNotMatch(JSON.stringify(report),/NaN|undefined|Infinity/);
     if(quarter===keys[0]) assert.ok(!report.blocks.history.facts.join('').includes(keys.at(-1)!));
   }
 }
});
