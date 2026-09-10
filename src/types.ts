export interface Holding {
  t: string;  // ticker
  n: string;  // name
  v: number;  // value in USD
  s: number;  // shares
  w: number;  // weight %
  cusip?: string;
  asset_class?: string;
  security_type?: string;
  comparison_warning?: string;
  o?: 'CALL' | 'PUT';  // option type, when the 13F row is an option
}

export interface Quarter {
  total: number;
  holdings: Holding[];
  total_positions?: number;
  complete?: boolean;
  period_ending?: string;
  filing_date?: string;
  source_url?: string;
  provider?: string;
  source_urls?: string[];
  amendment_note?: string;
  value_unit_inferred?: boolean;
  warnings?: string[];
}

export interface Fund {
  name_en: string;
  name_cn: string;
  manager: string;
  manager_en: string;
  description: string;
  cik: string;
  data_issues?: Record<string, string>;
  quarters: Record<string, Quarter>;
}

export interface Data {
  funds: Record<string, Fund>;
  generated: string;
  source: string;
}

export type Action = 'new' | 'increased' | 'decreased' | 'cleared' | 'unchanged' | 'unknown';

export type SortKey = 't' | 'n' | 'sector' | 'v' | 'w' | 's' | 'change' | 'action';
export type SortDir = 'asc' | 'desc';
