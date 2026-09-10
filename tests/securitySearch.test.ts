import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveSecurityIdentity,type SecuritySearchEntry} from '../src/securitySearch.ts';
const index:SecuritySearchEntry[]=[{ticker:'CRM',name:'Salesforce',cusip:'79466L302'},{ticker:'CRM CALL',name:'Salesforce',cusip:'79466L302',option:'CALL'},{ticker:'TER',name:'Teradyne',cusip:'880770102'}];
test('raw CUSIP bookmarks resolve after code completion, with options kept separate',()=>{
 assert.equal(resolveSecurityIdentity('79466L302',index),'CRM');
 assert.equal(resolveSecurityIdentity('79466L302 CALL',index),'CRM CALL');
 assert.equal(resolveSecurityIdentity('79466L302 PUT',index),'79466L302 PUT');
});
test('legacy incorrect symbols resolve by the bracketed identifier, not by their old name',()=>{
 assert.equal(resolveSecurityIdentity('TSM [880770102 COM]',index),'TER');
 assert.equal(resolveSecurityIdentity('UNKNOWN [123456789 COM]',index),'UNKNOWN [123456789 COM]');
 assert.equal(resolveSecurityIdentity('CRM',index),'CRM');
});

test('ambiguous identifier matches are not resolved to the first entry',()=>{
 assert.equal(resolveSecurityIdentity('79466L302',[...index,{ticker:'CRM OTHER',name:'Other class',cusip:'79466L302'}]),'79466L302');
});
