import type { Fund, Action, Holding, Quarter } from './types.ts';

/* ── Formatting ──────────────────────────────────────────────── */

export function fmtValue(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  if (abs >= 1e3)  return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function fmtShares(s: number): string {
  if (!Number.isFinite(s)) return '—';
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

/* ── Holding lookup (normalizes GOOG / GOOGL) ────────────────── */

export function normalizeTicker(ticker: string): string {
  return ticker;
}

/** Old snapshots may contain only a top-N slice. Never infer absence from it. */
export function isComplete(q: Quarter | undefined): boolean {
  return q?.complete === true;
}
export function coverage(q: Quarter): number {
  return q.total > 0 ? Math.min(100, q.holdings.reduce((s, h) => s + h.v, 0) / q.total * 100) : 0;
}
export function quarterOrdinal(q: string): number {
  const [part, year] = q.split(' ');
  return Number(year) * 4 + Number(part.slice(1));
}
export function comparablePrevious(fund: Fund, q: string): string | null {
  const previous = getPreviousQuarter(fund, q);
  return previous && quarterOrdinal(q) - quarterOrdinal(previous) === 1 ? previous : null;
}

// Retained API name for existing consumers. Security classes and options stay separate.
export function mergeGoogleClasses(holdings: Holding[]): Holding[] {
  return [...holdings].sort((a, b) => b.v - a.v);
}
const indexes = new WeakMap<Holding[], Map<string, Holding>>();
function findMerged(holdings: Holding[], ticker: string): Holding | undefined {
  let index = indexes.get(holdings);
  if (!index) { index = new Map(holdings.map(h => [h.t, h])); indexes.set(holdings, index); }
  return index.get(ticker);
}
export function getAction(fund: Fund, ticker: string, currentQ: string): Action {
  const prevQ = comparablePrevious(fund, currentQ);
  if (!prevQ || !fund.quarters[currentQ]) return 'unknown';
  const current = fund.quarters[currentQ];
  const previous = fund.quarters[prevQ];
  const curr = findMerged(current.holdings, ticker);
  const prev = findMerged(previous.holdings, ticker);
  if (curr?.comparison_warning || prev?.comparison_warning || current.warnings?.length || previous.warnings?.length) return 'unknown';
  if (curr && !prev) return isComplete(previous) ? 'new' : 'unknown';
  if (!curr && prev) return isComplete(current) ? 'cleared' : 'unknown';
  if (curr && prev) {
    // Conservative corporate-action screen. Unadjusted raw shares cannot prove trades.
    if (!curr.o && curr.s > 0 && prev.s > 0 && curr.v > 0 && prev.v > 0) {
      const ratio = curr.s / prev.s;
      const priceRatio = (curr.v / curr.s) / (prev.v / prev.s);
      if ([2, 3, 4, 5, 10, 20, .5, 1/3, .25, .2, .1, .05].some(factor => Math.abs(ratio / factor - 1) < .08 && Math.abs(priceRatio * factor - 1) < .25)) return 'unknown';
    }
    if (curr.cusip && prev.cusip && curr.cusip !== prev.cusip) return 'unknown';
    if (curr.security_type !== prev.security_type || curr.asset_class !== prev.asset_class) return 'unknown';
    if (curr.s > prev.s) return 'increased';
    if (curr.s < prev.s) return 'decreased';
    return 'unchanged';
  }
  return 'unknown';
}
export function getShareChange(fund: Fund, ticker: string, currentQ: string): number {
  const action = getAction(fund, ticker, currentQ);
  if (action === 'unknown' || action === 'new') return NaN;
  if (action === 'cleared') return -100;
  const prevQ = comparablePrevious(fund, currentQ);
  const curr = findMerged(fund.quarters[currentQ]?.holdings ?? [], ticker);
  const prev = prevQ ? findMerged(fund.quarters[prevQ]?.holdings ?? [], ticker) : undefined;
  return curr && prev && prev.s > 0 ? (curr.s / prev.s - 1) * 100 : NaN;
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
