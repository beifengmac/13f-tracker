import type { Action, Data, Fund, Holding } from './types';
import { fmtPct, fmtShares, fmtValue, getAction, getAllQuarterKeys, getQuarterKeys, getShareChange, inferSector, mergeGoogleClasses } from './utils';

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

function holdingTheme(holding: Holding): string {
  const text = `${holding.t} ${holding.n}`.toUpperCase();
  if (/NVIDIA|BROADCOM|MICRON|INTEL|LATTICE|LUMENTUM|COHERENT|TAIWAN SEMI|TSM|STMICRO|STM|SEAGATE|CELESTICA|AMPHENOL|ARISTA|KLA|ASML|QUALCOMM|ADVANCED MICRO|AMD|ARM HOLD|CREDO/.test(text)) return 'AI 算力/半导体硬件';
  if (/GE VERNOVA|VISTRA|NRG|TALEN|NUCOR|ENERGY|EXXON|CHEVRON|OCCIDENTAL|BAKER HU/.test(text)) return '电力/能源周期';
  if (/NATERA|INSMED|PHARMA|THERAPEUT|HEALTH|MEDIC|BIOSC|LILLY|MERCK|ABBVIE|BRISTOL|CRISPR|BEIGENE|GENOMIC|ILLUMINA|GUARDANT/.test(text)) return '医疗/生物科技';
  if (/AMAZON|META PLATFORM|ALPHABET|GOOGLE|NETFLIX|SHOPIFY|ROKU|UBER|DOORDASH|PINTEREST|REDDIT/.test(text)) return '互联网平台/消费科技';
  if (/BANK|FINL|FINANCIAL|JPMORGAN|CITIGROUP|WELLS FARGO|VISA|MASTERCARD|CAPITAL ONE|ALLY|BERKSHIRE|CHUBB|MANULIFE/.test(text)) return '金融/利率周期';
  if (/ISHARES INC|EWZ|YPF|BBB FOODS|MERCADOLIBRE|PDD|ALIBABA|JD.COM|NETEASE|BAIDU|TRIP.COM/.test(text)) return '新兴市场/中国资产';
  if (/COCA COLA|COSTCO|WALMART|PROCTER|KROGER|DOMINO|DEERE|HOME DEPOT|LENNAR|NVR|HORTON|PULTE/.test(text)) return '消费/地产周期';
  if (/BITCOIN|CRYPTO|COINBASE|CIRCLE|ROBINHOOD|BLOCK INC/.test(text)) return '加密资产链';
  if (/DEFENSE|KRATOS|AEROVIRONMENT|L3HARRIS|ROCKET LAB|ARCHER|JOBY|ELBIT/.test(text)) return '国防/航空航天';
  if (holding.o === 'CALL') return `${sectorLabel(inferSector(holding.n))} 看涨期权`;
  if (holding.o === 'PUT') return `${sectorLabel(inferSector(holding.n))} 看跌期权`;
  return sectorLabel(inferSector(holding.n));
}

function rankInQuarter(fund: Fund, quarter: string, ticker: string): number | null {
  const holdings = mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []);
  const index = holdings.findIndex(h => h.t === ticker);
  return index >= 0 ? index + 1 : null;
}

function rankText(rank: number | null): string {
  return rank ? `第 ${rank} 大重仓` : '非当前持仓';
}

function actionMeaning(action: Action): string {
  if (action === 'new') return '判断刚开始进入验证期';
  if (action === 'increased') return '长期判断在增强';
  if (action === 'decreased') return '信心边际转弱';
  if (action === 'cleared') return '已经退出这条线索';
  return '核心判断暂时稳定';
}

function themeSummary(rows: Array<{ holding: Holding; action: Action; change: number; weight: number }>, limit = 2): string {
  const themes = themeList(rows, limit);
  return themes.length > 0 ? themes.join('、') : '无明显方向';
}

function themeList(rows: Array<{ holding: Holding; action: Action; change: number; weight: number }>, limit = 2): string[] {
  const themes = new Map<string, { score: number; count: number }>();
  for (const row of rows) {
    const theme = holdingTheme(row.holding);
    const current = themes.get(theme) ?? { score: 0, count: 0 };
    themes.set(theme, { score: current.score + row.weight + 0.75, count: current.count + 1 });
  }
  const entries = [...themes];
  const focused = entries.filter(([theme]) => theme !== '其他/未分类');
  return (focused.length > 0 ? focused : entries)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([theme]) => theme);
}

function topHoldingsLine(fund: Fund, quarter: string, prevQ: string): string {
  const holdings = mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []);
  const top = holdings.slice(0, 3);
  if (top.length === 0) return '一、核心仓位：暂无持仓数据。';

  const top3Weight = top.reduce((sum, h) => sum + h.w, 0);
  const concentration = top3Weight >= 50
    ? '组合高度集中，胜负主要由少数核心仓决定'
    : top3Weight >= 30
      ? '核心仓集中度较高，主要方向已经比较清晰'
      : '组合相对分散，更像在多条主线里做权重调整';
  const names = top.map((holding, index) => {
    const action = getAction(fund, holding.t, quarter);
    const change = getShareChange(fund, holding.t, quarter);
    const prevRank = rankInQuarter(fund, prevQ, holding.t);
    const rankMove = prevRank && prevRank !== index + 1 ? `，由第 ${prevRank} 大变为第 ${index + 1} 大` : '';
    return `${holding.n}（${holdingLabel(holding)}）是${rankText(index + 1)}${rankMove}，持有 ${fmtShares(holding.s)} 股，市值 ${fmtValue(holding.v)}，权重 ${holding.w.toFixed(1)}%，本季${actionLabel(action, change)}，说明对 ${holdingTheme(holding)} 的${actionMeaning(action)}`;
  }).join('；');
  return `一、核心仓位是否动摇：${names}。Top 3 合计 ${top3Weight.toFixed(1)}%，${concentration}。`;
}

function topSectorLine(fund: Fund, quarter: string): string {
  const holdings = mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []);
  if (holdings.length === 0) return '行业线索：暂无足够数据。';

  const sectors = new Map<string, number>();
  for (const holding of holdings) {
    const sector = holdingTheme(holding);
    sectors.set(sector, (sectors.get(sector) ?? 0) + holding.w);
  }

  const entries = [...sectors.entries()];
  const focused = entries.filter(([sector]) => sector !== '其他/未分类');
  const top = (focused.length > 0 ? focused : entries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sector, weight]) => `${sector} ${weight.toFixed(1)}%`)
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

function strongestRows(fund: Fund, quarter: string, types: Action[], limit = 4): Array<{ holding: Holding; action: Action; change: number; weight: number }> {
  return types
    .flatMap(type => moveRows(fund, quarter, type))
    .sort((a, b) => b.holding.v - a.holding.v)
    .slice(0, limit);
}

function movePhrase(row: { holding: Holding; action: Action; change: number; weight: number }): string {
  const action = row.action === 'new'
    ? '新建'
    : row.action === 'cleared'
      ? '清仓'
      : row.action === 'increased'
        ? `加仓 ${fmtPct(row.change)}`
        : `减仓 ${fmtPct(row.change)}`;
  return `${holdingLabel(row.holding)} ${action}，权重 ${row.holding.w.toFixed(1)}%，对应 ${holdingTheme(row.holding)}`;
}

function buyActionLine(fund: Fund, quarter: string): string {
  const rows = strongestRows(fund, quarter, ['new', 'increased'], 4);
  if (rows.length === 0) return '二、最干净的买入动作：本季没有显著新建或加仓，不能硬解读成新的进攻方向。';

  const [lead, ...rest] = rows;
  const restText = rest.length > 0 ? `；同时还可以看 ${rest.map(movePhrase).join('；')}` : '';
  return `二、最干净的买入动作：最值得看的买入不是数量最多的股票，而是 ${movePhrase(lead)}。这说明组合在主动押注 ${holdingTheme(lead.holding)}${restText}。`;
}

function sellActionLine(fund: Fund, quarter: string): string {
  const rows = strongestRows(fund, quarter, ['cleared', 'decreased'], 4);
  const allCleared = moveRows(fund, quarter, 'cleared');
  if (rows.length === 0 && allCleared.length === 0) return '三、最明确的卖出/清仓信号：本季没有显著减仓或清仓，负面信息不强。';

  const cleared = rows.filter(row => row.action === 'cleared');
  const decreased = rows.filter(row => row.action === 'decreased');
  const sellThemes = themeSummary([...rows, ...allCleared], 2);
  const thematicClears = allCleared
    .reduce((groups, row) => {
      const theme = holdingTheme(row.holding);
      groups.set(theme, [...(groups.get(theme) ?? []), row]);
      return groups;
    }, new Map<string, Array<{ holding: Holding; action: Action; change: number; weight: number }>>());
  const clusterEntries = [...thematicClears.entries()];
  const focusedClusters = clusterEntries.filter(([theme]) => theme !== '其他/未分类');
  const clearestCluster = (focusedClusters.length > 0 ? focusedClusters : clusterEntries)
    .filter(([, group]) => group.length >= 3)
    .sort((a, b) => b[1].reduce((sum, row) => sum + row.weight, 0) - a[1].reduce((sum, row) => sum + row.weight, 0))[0];
  const clearedRows = clearestCluster
    ? clearestCluster[1].sort((a, b) => b.weight - a.weight).slice(0, 8)
    : cleared;
  const clearedText = clearedRows.length > 0 ? `清仓 ${clearedRows.map(row => holdingLabel(row.holding)).join('、')}` : '';
  const decreasedText = decreased.length > 0 ? `大幅减仓 ${decreased.map(row => `${holdingLabel(row.holding)} ${fmtPct(row.change)}`).join('、')}` : '';
  const joined = [clearedText, decreasedText].filter(Boolean).join('，');
  return `三、最明确的卖出/清仓信号：卖出端更有信息量，${joined}，代表他在退出或降低 ${sellThemes}。如果你持有同类资产，要重点复查业绩兑现、估值位置、周期拐点和竞争格局，不要只看他还买了什么。`;
}

function actionReadLine(fund: Fund, quarter: string, counts: Record<Action, number>): string {
  const buySide = counts.new + counts.increased;
  const sellSide = counts.decreased + counts.cleared;

  if (buySide === 0 && sellSide === 0) {
    return '四、组合意图判断：这是一次核心仓维护，交易不多，重点是确认第一大仓和前几大仓是否继续稳定。';
  }

  const buyThemes = themeSummary(strongestRows(fund, quarter, ['new', 'increased'], 8), 2);
  const sellThemes = themeSummary(strongestRows(fund, quarter, ['cleared', 'decreased'], 8), 2);

  if (buySide > sellSide * 1.3) return `四、组合意图判断：这是一次进攻型扩仓，买入端强于卖出端，资金主要流向 ${buyThemes}，说明风险偏好上升。`;
  if (sellSide > buySide * 1.3) return `四、组合意图判断：这是一次防守型收缩，清仓和减仓更重要，资金主要从 ${sellThemes} 撤出，说明经理人在降低不确定性暴露。`;
  return `四、组合意图判断：这是一次结构性换仓，不是简单看多或看空，而是从 ${sellThemes} 切到 ${buyThemes}。`;
}

function guidanceLine(signal: Insight['signal'], latestPositions: number, prevPositions: number): string {
  const positionDelta = latestPositions - prevPositions;
  const expansionText = positionDelta > 0
    ? `持仓数量增加 ${positionDelta} 只`
    : positionDelta < 0
      ? `持仓数量减少 ${Math.abs(positionDelta)} 只`
      : '持仓数量不变';

  if (signal === 'bullish') {
    return `五、给投资者的参考意见：${expansionText}。普通投资者不要机械抄作业，优先研究高权重且继续加仓的标的，其次看新建后直接进入前十大、或被清仓但市场仍很热门的股票；低权重新建只能放观察名单，不能当强信号。`;
  }
  if (signal === 'bearish') {
    return `五、给投资者的参考意见：${expansionText}。先尊重减仓和清仓信号；如果你持有同方向资产，应该复查基本面、估值和周期位置，而不是只因为名人仍有持仓就继续硬扛。`;
  }
  if (signal === 'divergent') {
    return `五、给投资者的参考意见：${expansionText}。这类季度最适合拆成两张表：新增/加仓代表正在押注的方向，减仓/清仓代表不再值得占用资金的方向，重点看资金迁移，而不是孤立看单只股票。`;
  }
  return `五、给投资者的参考意见：${expansionText}。不用过度解读小幅调整，更值得跟踪的是核心仓连续多个季度的方向，而不是单季噪音。`;
}

function analysisBody(fund: Fund, latestQ: string, prevQ: string, aumChange: number, counts: Record<Action, number>, latestPositions: number, prevPositions: number, signal: Insight['signal']): string {
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
  const buyThemes = themeList(strongestRows(fund, latestQ, ['new', 'increased'], 8), 2);
  const sellThemes = themeList(strongestRows(fund, latestQ, ['cleared', 'decreased'], 8), 2);
  const distinctSellThemes = sellThemes.filter(theme => !buyThemes.includes(theme));
  const overlappingThemes = sellThemes.filter(theme => buyThemes.includes(theme));
  const buyThemeText = buyThemes.join('、') || '无明显方向';
  const sellThemeText = distinctSellThemes.join('、') || sellThemes.join('、') || '无明显方向';
  const flowText = buyThemes.length > 0 || sellThemes.length > 0
    ? overlappingThemes.length > 0 && distinctSellThemes.length === 0
      ? `这一季最重要的变化不是单只股票，而是在 ${overlappingThemes.join('、')} 内部做强弱切换。`
      : `这一季最重要的变化不是单只股票，而是资金从 ${sellThemeText} 转向 ${buyThemeText}${overlappingThemes.length > 0 ? `，同时在 ${overlappingThemes.join('、')} 内部换股` : ''}。`
    : '这一季没有足够清晰的资金迁移线索，重点看核心仓是否保持稳定。';

  return `${fund.manager} 的 ${fund.name_cn} 最新 13F 显示，${prevQ} → ${latestQ} 组合市值环比 ${fmtPct(aumChange)}，持仓 ${prevPositions} → ${latestPositions} 只，${positionText}。整体风格是：${label}、${style}、主线偏向 ${buyThemeText}。${flowText}`;
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

function mainThemeTitle(fund: Fund, quarter: string, signal: Insight['signal']): string {
  const buyThemes = themeList(strongestRows(fund, quarter, ['new', 'increased'], 8), 2);
  const sellThemes = themeList(strongestRows(fund, quarter, ['cleared', 'decreased'], 8), 2);
  const distinctSellThemes = sellThemes.filter(theme => !buyThemes.includes(theme));
  const overlappingThemes = sellThemes.filter(theme => buyThemes.includes(theme));
  if (signal === 'divergent' && buyThemes.length > 0 && sellThemes.length > 0) return `卖 ${distinctSellThemes.join('、') || sellThemes.join('、')}，买 ${buyThemes.join('、')}`;
  if (signal === 'bullish' && buyThemes.length > 0 && overlappingThemes.length > 0) return `加码 ${buyThemes.join('、')}，同时清理部分 ${overlappingThemes.join('、')}`;
  if (signal === 'bullish' && buyThemes.length > 0) return `加码 ${buyThemes.join('、')}`;
  if (signal === 'bearish' && sellThemes.length > 0) return `降低 ${sellThemes.join('、')} 暴露`;
  if (buyThemes.length > 0) return `围绕 ${buyThemes.join('、')} 做结构调整`;
  return signalText(signal);
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
  const themeTitle = mainThemeTitle(fund, latestQ, signal);

  return {
    latestQ,
    prevQ,
    title: `${fund.manager} ${latestQ} 13F 仓位复盘：${themeTitle}`,
    signal,
    counts,
    body: analysisBody(fund, latestQ, prevQ, aumChange, counts, latestPositions, prevPositions, signal),
    details: [
      topHoldingsLine(fund, latestQ, prevQ),
      topSectorLine(fund, latestQ),
      buyActionLine(fund, latestQ),
      sellActionLine(fund, latestQ),
      actionReadLine(fund, latestQ, counts),
      guidanceLine(signal, latestPositions, prevPositions),
      `六、数据口径提醒：13F 有约 45 天延迟，只披露美股多头和部分期权，不披露空头、现金、海外资产和实时交易。以上解读只基于 ${prevQ} → ${latestQ} 的持股数变化，不把股价涨跌误判为买卖动作。`,
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
