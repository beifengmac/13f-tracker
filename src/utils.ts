import type { Fund, Action, Holding } from './types';

/* ── Formatting ──────────────────────────────────────────────── */

export function fmtValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  if (abs >= 1e3)  return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function fmtShares(s: number): string {
  const abs = Math.abs(s);
  if (abs >= 1e9) return `${(s / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(s / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(s / 1e3).toFixed(1)}K`;
  return `${s}`;
}

export function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

/* ── Quarter helpers ─────────────────────────────────────────── */

const Q_ORDER: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

export function getQuarterKeys(fund: Fund): string[] {
  return Object.keys(fund.quarters).sort((a, b) => {
    const [qa, ya] = a.split(' ');
    const [qb, yb] = b.split(' ');
    if (ya !== yb) return Number(ya) - Number(yb);
    return (Q_ORDER[qa] ?? 0) - (Q_ORDER[qb] ?? 0);
  });
}

export function getLatestQuarter(fund: Fund): string {
  const keys = getQuarterKeys(fund);
  return keys[keys.length - 1];
}

export function getEarliestQuarter(fund: Fund): string {
  return getQuarterKeys(fund)[0];
}

export function getPreviousQuarter(fund: Fund, current: string): string | null {
  const keys = getQuarterKeys(fund);
  const idx = keys.indexOf(current);
  return idx > 0 ? keys[idx - 1] : null;
}

/** All unique quarter keys across every fund, sorted chronologically. */
export function getAllQuarterKeys(funds: Record<string, Fund>): string[] {
  const set = new Set<string>();
  for (const f of Object.values(funds)) {
    for (const k of Object.keys(f.quarters)) set.add(k);
  }
  return [...set].sort((a, b) => {
    const [qa, ya] = a.split(' ');
    const [qb, yb] = b.split(' ');
    if (ya !== yb) return Number(ya) - Number(yb);
    return (Q_ORDER[qa] ?? 0) - (Q_ORDER[qb] ?? 0);
  });
}

/* ── Holding lookup (merges GOOG / GOOGL) ────────────────────── */

function findMerged(holdings: Holding[], ticker: string): Holding | undefined {
  if (ticker === 'GOOG' || ticker === 'GOOGL') {
    const both = holdings.filter(h => h.t === 'GOOG' || h.t === 'GOOGL');
    if (both.length === 0) return undefined;
    return {
      t: 'GOOG', n: 'ALPHABET INC',
      v: both.reduce((s, h) => s + h.v, 0),
      s: both.reduce((s, h) => s + h.s, 0),
      w: both.reduce((s, h) => s + h.w, 0),
    };
  }
  return holdings.find(h => h.t === ticker);
}

/* ── Action / Change computation ─────────────────────────────── */

export function getAction(fund: Fund, ticker: string, currentQ: string): Action {
  const prevQ = getPreviousQuarter(fund, currentQ);
  if (!prevQ) return 'unchanged';

  const curr = findMerged(fund.quarters[currentQ]?.holdings ?? [], ticker);
  const prev = findMerged(fund.quarters[prevQ]?.holdings ?? [], ticker);

  if (curr && !prev) return 'new';
  if (!curr && prev) return 'cleared';
  if (curr && prev) {
    if (curr.s > prev.s) return 'increased';
    if (curr.s < prev.s) return 'decreased';
  }
  return 'unchanged';
}

export function getShareChange(fund: Fund, ticker: string, currentQ: string): number {
  const prevQ = getPreviousQuarter(fund, currentQ);
  if (!prevQ) return 0;

  const curr = findMerged(fund.quarters[currentQ]?.holdings ?? [], ticker);
  const prev = findMerged(fund.quarters[prevQ]?.holdings ?? [], ticker);

  if (!curr || !prev || prev.s === 0) return 0;
  return ((curr.s - prev.s) / prev.s) * 100;
}

/* ── Merge Google share classes ──────────────────────────────── */

export function mergeGoogleClasses(holdings: Holding[]): Holding[] {
  const googl = holdings.filter(h => h.t === 'GOOGL' || h.t === 'GOOG');
  if (googl.length <= 1) return holdings;

  const merged: Holding = {
    t: 'GOOG', n: 'ALPHABET INC',
    v: googl.reduce((s, h) => s + h.v, 0),
    s: googl.reduce((s, h) => s + h.s, 0),
    w: googl.reduce((s, h) => s + h.w, 0),
  };
  return [...holdings.filter(h => h.t !== 'GOOGL' && h.t !== 'GOOG'), merged]
    .sort((a, b) => b.v - a.v);
}

/* ── Estimated cost basis ────────────────────────────────── */

export interface CostEstimate {
  /** Estimated entry price per share (from first appearance quarter) */
  entryPrice: number;
  /** Current price per share */
  currentPrice: number;
  /** Estimated P&L % */
  pnlPct: number;
  /** Quarter when the stock first appeared */
  entryQuarter: string;
}

/**
 * Estimate cost basis by finding the earliest quarter a ticker appears in,
 * then using value/shares from that quarter as the proxy entry price.
 */
export function estimateCost(fund: Fund, ticker: string): CostEstimate | null {
  const keys = getQuarterKeys(fund);
  if (keys.length === 0) return null;

  // Find first quarter where this ticker appears
  let entryQ: string | null = null;
  let entryHolding: Holding | undefined;
  for (const q of keys) {
    const h = findHolding(fund.quarters[q]?.holdings ?? [], ticker);
    if (h && h.s > 0) {
      entryQ = q;
      entryHolding = h;
      break;
    }
  }
  if (!entryQ || !entryHolding) return null;

  // Get latest quarter data
  const latestQ = keys[keys.length - 1];
  const latestH = findHolding(fund.quarters[latestQ]?.holdings ?? [], ticker);
  if (!latestH || latestH.s === 0) return null;

  const entryPrice = entryHolding.v / entryHolding.s;
  const currentPrice = latestH.v / latestH.s;
  const pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;

  return { entryPrice, currentPrice, pnlPct, entryQuarter: entryQ };
}

function findHolding(holdings: Holding[], ticker: string): Holding | undefined {
  if (ticker === 'GOOG' || ticker === 'GOOGL') {
    const both = holdings.filter(h => h.t === 'GOOG' || h.t === 'GOOGL');
    if (both.length === 0) return undefined;
    return {
      t: 'GOOG', n: 'ALPHABET INC',
      v: both.reduce((s, h) => s + h.v, 0),
      s: both.reduce((s, h) => s + h.s, 0),
      w: both.reduce((s, h) => s + h.w, 0),
    };
  }
  return holdings.find(h => h.t === ticker);
}

/* ── Sector inference ────────────────────────────────────────── */

export function inferSector(name: string): string {
  const n = name.toUpperCase();
  if (/ETF|ISHARES|SPDR|VANGUARD|INDEX|PROSHARES|DIREXION|GRANITESHARES|MONTREAL/.test(n)) return 'ETF/Index';
  if (/SEMICONDUCTOR|NVIDIA|APPLE|MICROSOFT|ALPHABET|BROADCOM|SALESFORCE|ADOBE|ORACLE|CISCO|PALANTIR|MICRON|AMD|ADVANCED MICRO|TAIWAN SEMI|QUALCOMM|ASML|KLA|SYNOPSYS|MARVELL|ARM HOLD|CREDO|SEAGATE|CELESTICA|AMPHENOL|ARISTA|APPLIED MAT/.test(n)) return 'Tech';
  if (/META PLATFORM|AMAZON|TESLA|NETFLIX|SHOPIFY|ROKU|ROBLOX|UBER|DOORDASH|AIRBNB|SPOTIFY|PINTEREST|REDDIT|TOAST|FIGMA|ROBINHOOD|COINBASE|BLOCK INC/.test(n)) return 'Tech/Internet';
  if (/BANK|FINL|FINANCIAL|CITIGROUP|WELLS FARGO|JPMORGAN|EXPRESS|VISA|MASTERCARD|FISERV|PAYPAL|BERKSHIRE|CHUBB|METLIFE|ALLEGION|CAPITAL ONE|ALLY FIN|MANULIFE/.test(n)) return 'Finance';
  if (/PHARMA|THERAPEUT|HEALTH|MEDIC|BIOSC|GENOMIC|LILLY|MERCK|JOHNSON|ABBVIE|BRISTOL|CIGNA|DAVITA|CRISPR|BEIGENE|LEGEND BIO|ILLUMINA|NATERA|RECURSION|INTELLIA|VERACYTE|GUARDANT|IONIS|ADAPTIVE|GENEDX|PERSONALIS|PACIFIC BIO|CAREDX/.test(n)) return 'Healthcare';
  if (/ENERGY|PETROL|CHEVRON|EXXON|OCCIDENTAL|NUCOR|BAKER HU|GE VERNOVA|VISTRA|NRG|TALEN/.test(n)) return 'Energy';
  if (/COCA COLA|KRAFT|WALMART|COSTCO|HOME DEPOT|PROCTER|KROGER|DOMINO|CONSTELLATION BR|POOL CORP|DEERE|LENNAR|NVR|D R HORTON|PULTE|LOUISIANA|DIAGEO|ALTRIA|BRITISH AM/.test(n)) return 'Consumer';
  if (/TELECOM|T-MOBILE|AT&T|COMCAST|CHARTER|SIRIUS|LIBERTY|LAMAR|IRIDIUM/.test(n)) return 'Media/Telecom';
  if (/BITCOIN|CRYPTO|BITMINE|BULLISH|ARK 21SH|CIRCLE/.test(n)) return 'Crypto';
  if (/DEFENSE|KRATOS|AEROVIRONMENT|L3HARRIS|BWX|ELBIT|ROCKET LAB|ARCHER|JOBY/.test(n)) return 'Defense/Aero';
  return 'Other';
}
