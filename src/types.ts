export interface Holding {
  t: string;  // ticker
  n: string;  // name
  v: number;  // value in USD
  s: number;  // shares
  w: number;  // weight %
}

export interface Quarter {
  total: number;
  holdings: Holding[];
  total_positions?: number;
}

export interface Fund {
  name_en: string;
  name_cn: string;
  manager: string;
  manager_en: string;
  description: string;
  cik: string;
  quarters: Record<string, Quarter>;
}

export interface Data {
  funds: Record<string, Fund>;
  generated: string;
  source: string;
}

export type Action = 'new' | 'increased' | 'decreased' | 'cleared' | 'unchanged';

export type SortKey = 't' | 'n' | 'v' | 'w' | 's' | 'change' | 'action';
export type SortDir = 'asc' | 'desc';
