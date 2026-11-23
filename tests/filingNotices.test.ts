import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getReportingQuarterKeys, getQuarterKeys, getAction} from '../src/utils.ts';
import type {Data} from '../src/types.ts';
const data=JSON.parse(readFileSync(new URL('../src/data.json',import.meta.url),'utf8')) as Data;
test('notice periods are selectable without being empty holdings or cleared positions',()=>{
 const fund=data.funds.oaktree;
 assert.ok(getReportingQuarterKeys(fund).includes('Q3 2026'));
 assert.ok(!getQuarterKeys(fund).includes('Q3 2026'));
 assert.equal(fund.notices?.['Q3 2026'].reporting_managers.length,3);
 for(const h of fund.quarters['Q2 2026'].holdings) assert.equal(getAction(fund,h.t,'Q3 2026'),'unknown');
});
