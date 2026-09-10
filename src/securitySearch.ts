import type { Holding } from './types.ts';
export interface SecuritySearchEntry {ticker:string; name:string; cusip?:string; option?:Holding['o']; status?:Holding['ticker_status']}
/** Resolve old identifier links after symbols are filled in; never infer by issuer name. */
export function resolveSecurityIdentity(input:string,index:SecuritySearchEntry[]):string {
  const exact=index.find(r=>r.ticker===input);
  if(exact)return exact.ticker;
  const raw=input.match(/^([A-Z0-9]{8}[0-9])(?: (CALL|PUT))?$/);
  const legacy=input.match(/\[([A-Z0-9]{9})(?:\s|\])/);
  const cusip=raw?.[1] ?? legacy?.[1];
  const option=raw?.[2] ?? (legacy ? input.split(' [')[0].match(/ (CALL|PUT)$/)?.[1] : undefined);
  if(cusip){
    const matches=index.filter(r=>r.cusip===cusip&&r.option===option);
    return matches.length===1 ? matches[0].ticker : input;
  }
  return input;
}
