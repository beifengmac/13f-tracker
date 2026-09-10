import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAction, getShareChange, mergeGoogleClasses } from '../src/utils.ts';
import { generateFundAnalysis, historyProfile, weightDistance, moves } from '../src/analysis.ts';
import type { Fund, Holding, Quarter } from '../src/types.ts';
const h = (t: string, s: number, v: number, w: number, o?: 'CALL' | 'PUT'): Holding => ({ t, n: t, s, v, w, o });
const q = (holdings: Holding[], complete = true): Quarter => ({ holdings, total: holdings.reduce((sum, x) => sum+x.v, 0), complete });
const fund = (quarters: Record<string, Quarter>): Fund => ({ name_en: 'Fixture', name_cn: '测试', manager: '', manager_en: '', description: '', cik: '1', quarters });
test('partial lists never infer a new or exited position', () => {
 const f = fund({'Q1 2025':q([h('A',10,100,50)],false),'Q2 2025':q([h('B',10,100,50)],false)});
 assert.equal(getAction(f,'A','Q2 2025'),'unknown'); assert.equal(getAction(f,'B','Q2 2025'),'unknown');
 assert.equal(weightDistance(f,'Q2 2025'),null);
 assert.ok(Number.isNaN(moves(f,'Q2 2025')[0].weightDelta));
});
test('price-only change does not imply a trade or a change in conviction', () => {
 const f = fund({'Q1 2025':q([h('A',10,100,100)]),'Q2 2025':q([h('A',10,200,100)])});
 assert.equal(getAction(f,'A','Q2 2025'),'unchanged');
 assert.equal(getShareChange(f,'A','Q2 2025'),0);
 assert.equal(generateFundAnalysis(f,'Q2 2025')?.signal,'neutral');
});
test('full snapshots permit absence inference; weight distance is symmetric and bounded', () => {
 const f = fund({'Q1 2025':q([h('A',10,100,100)]),'Q2 2025':q([h('B',10,100,100)])});
 assert.equal(getAction(f,'A','Q2 2025'),'cleared'); assert.equal(getAction(f,'B','Q2 2025'),'new');
 assert.equal(weightDistance(f,'Q2 2025'),100);
});
test('missing adjacent quarter and likely split fail closed', () => {
 const f = fund({'Q1 2025':q([h('A',10,100,100)]),'Q3 2025':q([h('A',20,100,100)])});
 assert.equal(getAction(f,'A','Q3 2025'),'unknown');
 f.quarters['Q2 2025'] = q([h('A',20,100,100)]);
 assert.equal(getAction(f,'A','Q2 2025'),'unknown');
});
test('historical selection does not leak future holdings', () => {
 const f = fund({'Q1 2025':q([h('A',10,100,100)]),'Q2 2025':q([h('B',10,100,100)])});
 assert.deepEqual(historyProfile(f,'Q1 2025').companies.map(c=>c.ticker),['A']);
 assert.equal(generateFundAnalysis(f,'Q1 2025')?.counts.new,0);
});
test('share classes and option holdings remain separate', () => {
 const rows = [h('GOOG',10,100,30),h('GOOGL',10,100,30),h('GOOG CALL',10,100,40,'CALL')];
 assert.equal(mergeGoogleClasses(rows).length,3);
 assert.equal(historyProfile(fund({'Q1 2025':q(rows)}),'Q1 2025').companies.length,2);
});
test('warnings and changed security identifiers suppress direction', () => {
 const f=fund({'Q1 2025':q([h('A',10,100,100)]),'Q2 2025':q([h('A',11,110,100)])});
 f.quarters['Q2 2025'].warnings=['Unreconciled amendment'];
 assert.equal(getAction(f,'A','Q2 2025'),'unknown'); assert.equal(weightDistance(f,'Q2 2025'),null);
});
