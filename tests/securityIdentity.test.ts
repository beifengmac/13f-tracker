import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {normalizeTicker} from '../src/utils.ts';
import type {Data} from '../src/types.ts';
const data=JSON.parse(readFileSync(new URL('../src/data.json',import.meta.url),'utf8')) as Data;
test('all TSM and TER history has one correct identity for stock lookup',()=>{
 const rows=Object.values(data.funds).flatMap(f=>Object.values(f.quarters).flatMap(q=>q.holdings));
 const tsm=rows.filter(h=>h.t==='TSM');const ter=rows.filter(h=>h.t==='TER');
 assert.ok(tsm.length>0&&ter.length>0);
 assert.ok(tsm.every(h=>h.cusip==='874039100'&&h.n.toUpperCase().includes('TAIWAN SEMICONDUCTOR')));
 assert.ok(ter.every(h=>h.cusip==='880770102'&&h.n.toUpperCase().includes('TERADYNE')));
 assert.ok(!rows.some(h=>h.t.startsWith('TSM [')));
});
test('old TSM bookmarks resolve by CUSIP without confusing Teradyne and Taiwan Semiconductor',()=>{
 assert.equal(normalizeTicker('TSM [880770102 COM]'),'TER');
 assert.equal(normalizeTicker('TSM [874039100 SPONSORED ADS]'),'TSM');
 assert.equal(normalizeTicker('TSM CALL [874039100 ADR]'),'TSM CALL');
 assert.equal(normalizeTicker('GOOGL'),'GOOGL');
});

test('bond labels preserve maturity and identify principal separately from shares',async()=>{
 const {securityTypeLabel}=await import('../src/utils.ts');
 assert.equal(normalizeTicker('AVAV 0 07/15/30'),'AVAV 0 07/15/30');
 assert.equal(securityTypeLabel({security_type:'PRN',asset_class:'CONVERTIBLE BOND'}),'可转债');
 assert.equal(securityTypeLabel({security_type:'PRN',asset_class:'NOTE 1.000%'}),'债券');
 assert.equal(securityTypeLabel({security_type:'SH',asset_class:'COM'}),'');
});
