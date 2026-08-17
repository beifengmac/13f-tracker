import type { Action, Data, Fund, Holding } from './types';
import { fmtPct, fmtShares, getAction, getAllQuarterKeys, getQuarterKeys, getShareChange, inferSector, mergeGoogleClasses } from './utils';

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

function holdingLabel(holding: Holding): string {
  const ticker = /^\d/.test(holding.t) ? holding.n : holding.t;
  const option = holding.o && !ticker.endsWith(` ${holding.o}`) ? ` ${holding.o}` : '';
  return `${ticker}${option}`;
}

function topHoldingsLine(fund: Fund, quarter: string): string {
  const holdings = mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []);
  const top = holdings.slice(0, 3);
  if (top.length === 0) return '一、核心仓位：暂无持仓数据。';

  const top3Weight = top.reduce((sum, h) => sum + h.w, 0);
  const concentration = top3Weight >= 50
    ? '组合高度集中，胜负主要由少数核心仓决定'
    : top3Weight >= 30
      ? '核心仓集中度较高，主要方向已经比较清晰'
      : '组合相对分散，更像在多条主线里做权重调整';
  const names = top.map(h => `${holdingLabel(h)} ${h.w.toFixed(1)}%`).join('、');
  return `一、核心仓位：${names}；Top 3 合计 ${top3Weight.toFixed(1)}%。${concentration}。`;
}

function topSectorLine(fund: Fund, quarter: string): string {
  const holdings = mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []);
  if (holdings.length === 0) return '行业线索：暂无足够数据。';

  const sectors = new Map<string, number>();
  for (const holding of holdings) {
    const sector = inferSector(holding.n);
    sectors.set(sector, (sectors.get(sector) ?? 0) + holding.w);
  }

  const top = [...sectors.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sector, weight]) => `${sectorLabel(sector)} ${weight.toFixed(1)}%`)
    .join('、');

  return `行业线索：主要暴露在 ${top}。`;
}

function sectorLabel(sector: string): string {
  const labels: Record<string, string> = {
    'ETF/Index': 'ETF/指数',
    Tech: '科技硬件/软件',
    'Tech/Internet': '互联网/平台',
    Finance: '金融',
    Healthcare: '医疗健康',
    Energy: '能源',
    Consumer: '消费',
    'Media/Telecom': '媒体/通信',
    Crypto: '加密资产链',
    'Defense/Aero': '国防/航空',
    Other: '其他/未分类',
  };
  return labels[sector] ?? sector;
}

function rankedMoves(fund: Fund, quarter: string, type: Action, limit = 4): string {
  const rows = moveRows(fund, quarter, type)
    .sort((a, b) => b.holding.v - a.holding.v)
    .slice(0, limit);

  if (rows.length === 0) return '无';

  return rows.map(row => {
    const label = holdingLabel(row.holding);
    if (type === 'increased' || type === 'decreased') {
      return `${label} ${fmtPct(row.change)}（${row.holding.w.toFixed(1)}%）`;
    }
    return `${label}（${row.holding.w.toFixed(1)}%）`;
  }).join('、');
}

function actionReadLine(fund: Fund, quarter: string, counts: Record<Action, number>): string {
  const buySide = counts.new + counts.increased;
  const sellSide = counts.decreased + counts.cleared;

  if (buySide === 0 && sellSide === 0) {
    return '二、交易动作：本季几乎没有明显调仓，重点不是追动作，而是观察核心仓是否继续稳定。';
  }

  const buyText = sideText([
    ['新建仓看', rankedMoves(fund, quarter, 'new', 3)],
    ['加仓端看', rankedMoves(fund, quarter, 'increased', 3)],
  ]);
  const sellText = sideText([
    ['减仓端看', rankedMoves(fund, quarter, 'decreased', 3)],
    ['清仓看', rankedMoves(fund, quarter, 'cleared', 3)],
  ]);

  if (buySide > sellSide * 1.3) return `二、最干净的动作：本季买入端更强，${buyText}。这类变化通常代表经理人在主动提高风险暴露。`;
  if (sellSide > buySide * 1.3) return `二、最干净的动作：本季卖出端更强，${sellText}。这类变化更像是在降风险或从旧主线撤退。`;
  return `二、最干净的动作：本季是双向换仓，${buyText}；${sellText}。重点看资金从哪些旧仓位挪到哪些新仓位。`;
}

function sideText(parts: Array<[string, string]>): string {
  const present = parts.filter(([, value]) => value !== '无');
  return present.length > 0 ? present.map(([label, value]) => `${label} ${value}`).join('；') : '无明显动作';
}

function riskControlLine(fund: Fund, quarter: string, signal: Insight['signal']): string {
  const decreased = rankedMoves(fund, quarter, 'decreased', 4);
  const cleared = rankedMoves(fund, quarter, 'cleared', 4);
  const sellText = sideText([
    ['减仓', decreased],
    ['清仓', cleared],
  ]);

  if (signal === 'bullish') {
    return `三、风险控制：虽然整体偏进攻，仍要看${sellText}，确认这不是单纯扩大组合，而是有选择地换到更强方向。`;
  }
  if (signal === 'bearish') {
    return `三、风险控制：${sellText} 是本季重点。跟踪时先问：这是个股问题、行业问题，还是组合层面的防守。`;
  }
  if (signal === 'divergent') {
    return `三、风险控制：新旧仓切换明显，${sellText} 要和新建仓放在一起读，别只看买入清单。`;
  }
  return `三、风险控制：${sellText}。中性季度里，卖出动作往往比买入动作更能暴露经理人的真实担忧。`;
}

function guidanceLine(signal: Insight['signal'], latestPositions: number, prevPositions: number): string {
  const positionDelta = latestPositions - prevPositions;
  const expansionText = positionDelta > 0
    ? `持仓数量增加 ${positionDelta} 只`
    : positionDelta < 0
      ? `持仓数量减少 ${Math.abs(positionDelta)} 只`
      : '持仓数量不变';

  if (signal === 'bullish') {
    return `四、参考意见：${expansionText}，可以优先研究“加仓后仍有较高权重”的标的；只小额新建、权重很低的股票先当观察名单，不急着下结论。`;
  }
  if (signal === 'bearish') {
    return `四、参考意见：${expansionText}，先尊重减仓和清仓信号；如果你持有同方向资产，应该复查基本面和估值，而不是只因为名人仍有持仓就继续硬扛。`;
  }
  if (signal === 'divergent') {
    return `四、参考意见：${expansionText}，这类季度最适合拆成两张表：新增/加仓代表正在押注的方向，减仓/清仓代表不再值得占用资金的方向。`;
  }
  return `四、参考意见：${expansionText}，不用过度解读小幅调整；更值得跟踪的是核心仓连续多个季度的方向，而不是单季噪音。`;
}

function analysisBody(fund: Fund, aumChange: number, counts: Record<Action, number>, latestPositions: number, prevPositions: number, signal: Insight['signal']): string {
  const label = signalText(signal);
  const positionDelta = latestPositions - prevPositions;
  const activity = counts.new + counts.increased + counts.decreased + counts.cleared;
  const style = activity >= 40
    ? '操作非常密集'
    : activity >= 20
      ? '调仓力度不低'
      : activity >= 8
        ? '有明确动作但不算激进'
        : '整体动作克制';
  const positionText = positionDelta > 0
    ? `持仓扩张 ${positionDelta} 只`
    : positionDelta < 0
      ? `持仓收缩 ${Math.abs(positionDelta)} 只`
      : '持仓数量持平';

  return `${fund.manager} 最新 13F 显示，组合市值环比 ${fmtPct(aumChange)}，${positionText}，新建 ${counts.new} 只、加仓 ${counts.increased} 只、减仓 ${counts.decreased} 只、清仓 ${counts.cleared} 只。整体判断是“${label}”：${style}，适合按“核心仓是否稳定、资金流向哪里、退出了什么”三步来读。`;
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
    body: analysisBody(fund, aumChange, counts, latestPositions, prevPositions, signal),
    details: [
      topHoldingsLine(fund, latestQ),
      topSectorLine(fund, latestQ),
      actionReadLine(fund, latestQ, counts),
      riskControlLine(fund, latestQ, signal),
      guidanceLine(signal, latestPositions, prevPositions),
      `数据口径：以上只基于 ${prevQ} → ${latestQ} 的持股数变化生成，不把股价涨跌误判成买卖动作。`,
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
