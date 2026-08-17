import type { Action, Data, Fund, Holding } from './types';
import { fmtPct, fmtShares, fmtValue, getAction, getAllQuarterKeys, getQuarterKeys, getShareChange, mergeGoogleClasses } from './utils';

export interface Insight {
  id: string;
  icon: string;
  tag: string;
  tagColor: string;
  title: string;
  body: string;
  details: string[];
  signal: 'bullish' | 'bearish' | 'neutral' | 'divergent';
}

export interface FundAnalysis {
  latestQ: string;
  prevQ: string | null;
  title: string;
  body: string;
  details: string[];
  counts: Record<Action, number>;
  signal: Insight['signal'];
}

const TAG_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
];

function getHolding(fund: Fund, quarter: string, ticker: string): Holding | undefined {
  return mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []).find(h => h.t === ticker);
}

function positionCount(fund: Fund, quarter: string): number {
  return fund.quarters[quarter]?.total_positions ?? mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []).length;
}

function fundAumChange(fund: Fund, latestQ: string, prevQ: string): number {
  const latest = fund.quarters[latestQ]?.total ?? 0;
  const prev = fund.quarters[prevQ]?.total ?? 0;
  return prev > 0 ? ((latest - prev) / prev) * 100 : 0;
}

function actionLabel(action: Action, change: number): string {
  if (action === 'new') return '新建仓';
  if (action === 'cleared') return '清仓';
  if (action === 'increased') return `加仓 ${fmtPct(change)}`;
  if (action === 'decreased') return `减仓 ${fmtPct(change)}`;
  return '持股不变';
}

export function positionLine(fund: Fund, fundLabel: string, ticker: string, quarter: string): string | null {
  const holding = getHolding(fund, quarter, ticker);
  if (!holding) return null;
  const action = getAction(fund, ticker, quarter);
  const change = getShareChange(fund, ticker, quarter);
  return `${fundLabel}：${ticker} ${holding.w.toFixed(1)}%，${actionLabel(action, change)}，${fmtShares(holding.s)} 股`;
}

function moveRows(fund: Fund, quarter: string, type: Action): Array<{ holding: Holding; action: Action; change: number; weight: number }> {
  const keys = getQuarterKeys(fund);
  const prevQ = keys[keys.indexOf(quarter) - 1];
  if (!prevQ) return [];

  const current = mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []);
  const previous = mergeGoogleClasses(fund.quarters[prevQ]?.holdings ?? []);
  const currentByTicker = new Map(current.map(h => [h.t, h]));
  const previousByTicker = new Map(previous.map(h => [h.t, h]));
  const tickers = new Set([...currentByTicker.keys(), ...previousByTicker.keys()]);

  return [...tickers]
    .map(ticker => {
      const action = getAction(fund, ticker, quarter);
      const holding = action === 'cleared' ? previousByTicker.get(ticker) : currentByTicker.get(ticker);
      return holding ? { holding, action, change: action === 'cleared' ? -100 : getShareChange(fund, ticker, quarter), weight: holding.w } : null;
    })
    .filter((row): row is { holding: Holding; action: Action; change: number; weight: number } => row !== null && row.action === type)
    .sort((a, b) => {
      if (type === 'increased' || type === 'decreased') return Math.abs(b.change) - Math.abs(a.change);
      return b.weight - a.weight;
    });
}

export function topMoves(fund: Fund, quarter: string, type: Action, limit = 4): string {
  const moves = moveRows(fund, quarter, type)
    .slice(0, limit)
    .map(row => type === 'increased' || type === 'decreased'
      ? `${row.holding.t} ${fmtPct(row.change)}`
      : row.holding.t);

  return moves.length > 0 ? moves.join('、') : '无';
}

function countActions(fund: Fund, quarter: string): Record<Action, number> {
  const counts: Record<Action, number> = { new: 0, increased: 0, decreased: 0, cleared: 0, unchanged: 0 };
  for (const action of ['new', 'increased', 'decreased', 'cleared', 'unchanged'] as Action[]) {
    counts[action] = moveRows(fund, quarter, action).length;
  }
  return counts;
}

function topHoldingLine(fund: Fund, quarter: string): string {
  const top = mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? [])[0];
  if (!top) return '第一大仓：无';
  return `第一大仓：${top.t}，权重 ${top.w.toFixed(1)}%，市值 ${fmtValue(top.v)}`;
}

function fundSignal(aumChange: number, counts: Record<Action, number>, latestPositions: number, prevPositions: number): Insight['signal'] {
  const expansion = latestPositions - prevPositions;
  if (aumChange > 10 && (counts.new + counts.increased) > (counts.decreased + counts.cleared)) return 'bullish';
  if (aumChange < -10 || counts.cleared > counts.new + counts.increased) return 'bearish';
  if (Math.abs(expansion) >= 5 || counts.new + counts.cleared >= 8) return 'divergent';
  return 'neutral';
}

function signalText(signal: Insight['signal']): string {
  if (signal === 'bullish') return '风险偏好提升';
  if (signal === 'bearish') return '风险偏好下降';
  if (signal === 'divergent') return '明显换仓';
  return '结构微调';
}

export function generateFundAnalysis(fund: Fund): FundAnalysis | null {
  const quarters = getQuarterKeys(fund);
  const latestQ = quarters[quarters.length - 1];
  const prevQ = quarters[quarters.length - 2] ?? null;
  if (!latestQ || !prevQ) return null;

  const aumChange = fundAumChange(fund, latestQ, prevQ);
  const latestPositions = positionCount(fund, latestQ);
  const prevPositions = positionCount(fund, prevQ);
  const counts = countActions(fund, latestQ);
  const signal = fundSignal(aumChange, counts, latestPositions, prevPositions);
  const label = signalText(signal);

  return {
    latestQ,
    prevQ,
    title: `${fund.name_cn} ${latestQ}：${label}，持仓 ${prevPositions} → ${latestPositions} 只`,
    signal,
    counts,
    body: `13F 市值环比 ${fmtPct(aumChange)}，新建 ${counts.new} 只、加仓 ${counts.increased} 只、减仓 ${counts.decreased} 只、清仓 ${counts.cleared} 只。这个判断完全来自 ${prevQ} 到 ${latestQ} 的持股数变化，避免把股价波动误当成买卖动作。`,
    details: [
      topHoldingLine(fund, latestQ),
      `新建仓：${topMoves(fund, latestQ, 'new', 8)}`,
      `加仓：${topMoves(fund, latestQ, 'increased', 8)}`,
      `减仓：${topMoves(fund, latestQ, 'decreased', 8)}`,
      `清仓：${topMoves(fund, latestQ, 'cleared', 8)}`,
    ],
  };
}

export function generateMarketInsights(data: Data): Insight[] {
  const allQs = getAllQuarterKeys(data.funds);
  const latestQ = allQs[allQs.length - 1];
  const prevQ = allQs[allQs.length - 2];
  if (!latestQ || !prevQ) return [];

  const funds = Object.entries(data.funds);
  const analyses = funds
    .map(([id, fund], index) => ({ id, fund, index, analysis: generateFundAnalysis(fund) }))
    .filter((item): item is { id: string; fund: Fund; index: number; analysis: FundAnalysis } => item.analysis !== null);

  const activeAnalyses = analyses.filter(item => item.analysis.latestQ === latestQ);
  const bullish = activeAnalyses.filter(item => item.analysis.signal === 'bullish').map(item => item.fund.name_cn);
  const bearish = activeAnalyses.filter(item => item.analysis.signal === 'bearish').map(item => item.fund.name_cn);
  const divergent = activeAnalyses.filter(item => item.analysis.signal === 'divergent').map(item => item.fund.name_cn);

  return [
    {
      id: 'latest-regime',
      icon: '📌',
      tag: latestQ,
      tagColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      title: `${latestQ} 主线：用同一套持股数口径重算全部机构动作`,
      signal: divergent.length > 0 ? 'divergent' : bullish.length >= bearish.length ? 'bullish' : 'bearish',
      body: `本页所有结论都由 ${prevQ} → ${latestQ} 的持股数变化生成，不再维护独立手写结论。当前风险偏好提升：${bullish.join('、') || '无'}；风险偏好下降：${bearish.join('、') || '无'}；明显换仓：${divergent.join('、') || '无'}。`,
      details: activeAnalyses.slice(0, 9).map(item => {
        const a = item.analysis;
        return `${item.fund.name_cn}：新建 ${a.counts.new}、加仓 ${a.counts.increased}、减仓 ${a.counts.decreased}、清仓 ${a.counts.cleared}`;
      }),
    },
    ...activeAnalyses.map(({ id, fund, index, analysis }) => ({
      id: `${id}-${analysis.latestQ}`,
      icon: index % 3 === 0 ? '📈' : index % 3 === 1 ? '🔍' : '⚖️',
      tag: fund.name_cn,
      tagColor: TAG_COLORS[index % TAG_COLORS.length],
      title: analysis.title,
      body: analysis.body,
      details: analysis.details,
      signal: analysis.signal,
    })),
  ];
}
