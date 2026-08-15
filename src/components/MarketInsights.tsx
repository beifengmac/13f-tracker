import { useMemo } from 'react';
import rawData from '../data.json';
import type { Data, Fund, Holding } from '../types';
import { fmtValue, fmtPct, fmtShares, getAllQuarterKeys, getQuarterKeys, getAction, getShareChange, mergeGoogleClasses } from '../utils';

const data = rawData as unknown as Data;

interface Insight {
  id: string;
  icon: string;
  tag: string;
  tagColor: string;
  title: string;
  body: string;
  details: string[];
  signal: 'bullish' | 'bearish' | 'neutral' | 'divergent';
}

const FUND_LABELS: Record<string, string> = {
  berkshire: '巴菲特',
  bridgewater: '桥水',
  blackrock: '贝莱德',
  ark: 'ARK',
  hhlr: '高瓴',
  himalaya: '李录',
  hh: '段永平',
  danbin: '但斌',
  duquesne: '杜肯',
};

function getHolding(fund: Fund, quarter: string, ticker: string): Holding | undefined {
  return mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []).find(h => h.t === ticker);
}

function positionLine(fundId: string, ticker: string, quarter: string): string | null {
  const fund = data.funds[fundId];
  const holding = getHolding(fund, quarter, ticker);
  if (!holding) return null;
  const action = getAction(fund, ticker, quarter);
  const change = getShareChange(fund, ticker, quarter);
  const actionText =
    action === 'new' ? '新建仓'
      : action === 'cleared' ? '清仓'
        : action === 'increased' ? `加仓 ${fmtPct(change)}`
          : action === 'decreased' ? `减仓 ${fmtPct(change)}`
            : '持股不变';

  return `${FUND_LABELS[fundId]}：${ticker} ${holding.w.toFixed(1)}%，${actionText}，${fmtShares(holding.s)} 股`;
}

function topMoves(fundId: string, quarter: string, type: 'new' | 'increased' | 'decreased' | 'cleared', limit = 4): string {
  const fund = data.funds[fundId];
  const quarterKeys = getQuarterKeys(fund);
  const prevQ = quarterKeys[quarterKeys.indexOf(quarter) - 1];
  const current = mergeGoogleClasses(fund.quarters[quarter]?.holdings ?? []);
  const rows = type === 'cleared'
    ? mergeGoogleClasses(fund.quarters[prevQ]?.holdings ?? [])
    : current;

  const moves = rows
    .map(h => ({
      ticker: h.t,
      weight: h.w,
      action: getAction(fund, h.t, quarter),
      change: getShareChange(fund, h.t, quarter),
    }))
    .filter(h => h.action === type)
    .sort((a, b) => type === 'new' || type === 'cleared' ? b.weight - a.weight : Math.abs(b.change) - Math.abs(a.change))
    .slice(0, limit)
    .map(h => type === 'new' || type === 'cleared' ? h.ticker : `${h.ticker} ${fmtPct(h.change)}`);

  return moves.length > 0 ? moves.join('、') : '无';
}

function fundAumChange(fund: Fund, latestQ: string, prevQ: string): number {
  const latest = fund.quarters[latestQ]?.total ?? 0;
  const prev = fund.quarters[prevQ]?.total ?? 0;
  return prev > 0 ? ((latest - prev) / prev) * 100 : 0;
}

function generateInsights(): Insight[] {
  const allQs = getAllQuarterKeys(data.funds);
  const latestQ = allQs[allQs.length - 1];
  const prevQ = allQs[allQs.length - 2];
  if (!latestQ || !prevQ) return [];

  const brk = data.funds.berkshire;
  const hhlr = data.funds.hhlr;
  const danbin = data.funds.danbin;
  const hh = data.funds.hh;
  const himalaya = data.funds.himalaya;
  const ark = data.funds.ark;
  const bridgewater = data.funds.bridgewater;
  const blackrock = data.funds.blackrock;
  const duquesne = data.funds.duquesne;

  const brkGoog = getHolding(brk, latestQ, 'GOOG');
  const brkBacChange = getShareChange(brk, 'BAC', latestQ);
  const hhlrPddChange = getShareChange(hhlr, 'PDD', latestQ);
  const hhlrBabaChange = getShareChange(hhlr, 'BABA', latestQ);
  const hhNvdaChange = getShareChange(hh, 'NVDA', latestQ);
  const hhPddChange = getShareChange(hh, 'PDD', latestQ);
  const liLuPddChange = getShareChange(himalaya, 'PDD', latestQ);
  const danbinMuChange = getShareChange(danbin, 'MU', latestQ);
  const arkTsla = getHolding(ark, latestQ, 'TSLA');
  const duqAum = fundAumChange(duquesne, latestQ, prevQ);

  return [
    {
      id: 'q2-regime',
      icon: '📌',
      tag: latestQ,
      tagColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      title: `${latestQ} 主线：不是单边看多，而是“指数资金扩张 + 主动资金分化”`,
      signal: 'divergent',
      body: `这次 9 家机构全部刷新到 ${latestQ}。表面上多数 13F 市值上升，但拆开看并不是同一种信号：贝莱德这类大资管更像被动跟随美股大盘扩张，桥水在 ETF 和因子之间轮动，真正值得读的是巴菲特、段永平、高瓴、李录、但斌、杜肯这些主动组合的方向变化。`,
      details: [
        `贝莱德 13F 市值 ${fmtValue(blackrock.quarters[latestQ].total)}，环比 ${fmtPct(fundAumChange(blackrock, latestQ, prevQ))}，更偏市场 Beta 信号`,
        `桥水 13F 市值 ${fmtValue(bridgewater.quarters[latestQ].total)}，环比 ${fmtPct(fundAumChange(bridgewater, latestQ, prevQ))}，但个股层面大幅换仓`,
        `高瓴 13F 市值 ${fmtValue(hhlr.quarters[latestQ].total)}，环比 ${fmtPct(fundAumChange(hhlr, latestQ, prevQ))}，是本轮最明显的收缩信号`,
        `杜肯 13F 市值 ${fmtValue(duquesne.quarters[latestQ].total)}，环比 ${fmtPct(duqAum)}，是主动资金里最明显的进攻信号`,
      ],
    },
    {
      id: 'berkshire-q2',
      icon: '🧭',
      tag: '巴菲特',
      tagColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      title: `伯克希尔新增 ${latestQ}：核心不是“躺平”，而是加 Google、减金融风险`,
      signal: 'neutral',
      body: `伯克希尔 ${latestQ} 持仓市值升至 ${fmtValue(brk.quarters[latestQ].total)}，29 个持仓数量没变。最重要的变化是 Alphabet 合并后权重约 ${brkGoog?.w.toFixed(1)}%，环比持股加仓 ${fmtPct(getShareChange(brk, 'GOOG', latestQ))}；同时继续减 BAC、COF、Kroger、Nucor。这更像在保留消费和金融核心仓的同时，把组合向更确定的现金流科技倾斜。`,
      details: [
        positionLine('berkshire', 'GOOG', latestQ) ?? 'Alphabet：Q2 明显加仓',
        positionLine('berkshire', 'BAC', latestQ) ?? `BAC：减仓 ${fmtPct(brkBacChange)}`,
        positionLine('berkshire', 'COF', latestQ) ?? 'COF：大幅减仓',
        '新进入/重新映射的边际持仓：DHI；Chubb 名称变化来自 SEC issuer name，不改变核心判断',
      ],
    },
    {
      id: 'china-internet',
      icon: '🛒',
      tag: '中概',
      tagColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
      title: '拼多多共识还在，但高瓴明显撤退，不能再写成“无脑一致看多”',
      signal: 'divergent',
      body: `PDD 在李录和段永平组合里继续增强：李录加仓 ${fmtPct(liLuPddChange)}，段永平加仓 ${fmtPct(hhPddChange)}。但高瓴 Q2 同时大幅减 PDD 和 BABA，说明华人投资人对中概的共识已经从“板块机会”收窄成“只买少数最强公司”。`,
      details: [
        positionLine('himalaya', 'PDD', latestQ) ?? '李录：PDD 继续加仓',
        positionLine('hh', 'PDD', latestQ) ?? '段永平：PDD 继续加仓',
        `高瓴：PDD 减仓 ${fmtPct(hhlrPddChange)}，BABA 减仓 ${fmtPct(hhlrBabaChange)}`,
        positionLine('hh', 'BABA', latestQ) ?? '段永平：BABA 只是很小的新仓，不能解读成强看多',
      ],
    },
    {
      id: 'ai-semiconductors',
      icon: '🔌',
      tag: 'AI 硬件',
      tagColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
      title: 'AI 交易进入分层：但斌转向半导体组合，段永平反而降低高波动暴露',
      signal: 'divergent',
      body: `但斌 Q2 的变化最激进：清掉上一季度的大额 GOOG/AAPL/TSLA 暴露，重新建立 GOOGL、INTC、SNDK、AMD、MRVL、ARM、AVGO，并把 MU 加仓 ${fmtPct(danbinMuChange)}。段永平则相反，NVDA 减仓 ${fmtPct(hhNvdaChange)}，CRDO 也小幅减仓。这说明 AI 主线还在，但资金正在从“单一龙头叙事”分化到存储、网络、CPU/GPU 周边。`,
      details: [
        `但斌新建：${topMoves('danbin', latestQ, 'new', 8)}`,
        `但斌加仓：${topMoves('danbin', latestQ, 'increased', 3)}`,
        positionLine('hh', 'NVDA', latestQ) ?? '段永平：NVDA Q2 减仓',
        positionLine('hhlr', 'NVDA', latestQ) ?? '高瓴：NVDA 小仓位加仓',
      ],
    },
    {
      id: 'li-lu-quality',
      icon: '🔍',
      tag: '李录',
      tagColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      title: '李录组合更集中：清掉金融数据/能源长尾，加码 Alphabet + PDD + BRK.B',
      signal: 'bullish',
      body: `喜马拉雅 Q2 从 14 个持仓收缩到 8 个，市值环比上升 ${fmtPct(fundAumChange(himalaya, latestQ, prevQ))}。他清掉 BAC、OXY、SPGI、HRB、MCO、MSCI，但加仓 PDD 和 BRK.B，Alphabet 合并后仍接近半仓。这是典型的“少数高确定性资产”组合，而不是分散试错。`,
      details: [
        positionLine('himalaya', 'GOOG', latestQ) ?? 'Alphabet：仍是第一大集中仓',
        positionLine('himalaya', 'PDD', latestQ) ?? 'PDD：Q2 大幅加仓',
        positionLine('himalaya', 'BRK.B', latestQ) ?? 'BRK.B：Q2 加仓',
        `清仓：${topMoves('himalaya', latestQ, 'cleared', 8)}`,
      ],
    },
    {
      id: 'high-beta',
      icon: '⚡',
      tag: '高波动成长',
      tagColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      title: '高波动成长股：ARK 继续拥抱，段永平开始降速',
      signal: 'divergent',
      body: `ARK 的 TSLA 仍是第一大仓，权重 ${arkTsla?.w.toFixed(1)}%，同时新建 SpaceX、Cerebras 等非传统成长资产；但段永平在 TSLA、NVDA、GOOGL、MSFT、UNH 上都减仓。这个分歧说明成长风格并没有退潮，但价值投资人已经开始控制高估值资产的仓位弹性。`,
      details: [
        positionLine('ark', 'TSLA', latestQ) ?? 'ARK：TSLA 仍是核心仓',
        `ARK 新建：${topMoves('ark', latestQ, 'new', 6)}`,
        `ARK 减仓：${topMoves('ark', latestQ, 'decreased', 6)}`,
        `段永平减仓：${topMoves('hh', latestQ, 'decreased', 7)}`,
      ],
    },
    {
      id: 'duquesne-risk-on',
      icon: '📈',
      tag: '杜肯',
      tagColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      title: `杜肯 Q2 明显进攻：市值环比 ${fmtPct(duqAum)}，持仓从 65 只扩到 86 只`,
      signal: 'bullish',
      body: `杜肯是这轮主动资金里最明显的风险偏好提升信号：新建 AMZN、GOOG、FOX、CDW、Bitdeer、DAL、DHI，同时大幅加 UAL、STX、DAKT、CLF。它不是单押科技，而是科技、航空、周期、加密算力一起扩张。`,
      details: [
        `杜肯新建：${topMoves('duquesne', latestQ, 'new', 8)}`,
        `杜肯加仓：${topMoves('duquesne', latestQ, 'increased', 8)}`,
        `杜肯清仓：${topMoves('duquesne', latestQ, 'cleared', 6)}`,
        '投资含义：如果只看巴菲特会偏防守，但看杜肯会发现宏观交易资金已经在重新押风险资产',
      ],
    },
    {
      id: 'bridgewater-factor',
      icon: '⚖️',
      tag: '桥水',
      tagColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
      title: '桥水不是简单看空科技，而是在从个股半导体切回 ETF/指数暴露',
      signal: 'neutral',
      body: `桥水 Q2 市值环比 ${fmtPct(fundAumChange(bridgewater, latestQ, prevQ))}，但动作很像因子轮动：加 SPY、VWO、KLA，减 MU、GEV、AMD、AMZN、GOOG，并清掉 TSM、MRVL、META、ARISTA、CRDO 等上一轮强势科技链。`,
      details: [
        `桥水加仓：${topMoves('bridgewater', latestQ, 'increased', 7)}`,
        `桥水减仓：${topMoves('bridgewater', latestQ, 'decreased', 7)}`,
        `桥水清仓：${topMoves('bridgewater', latestQ, 'cleared', 7)}`,
        '投资含义：这是降低单股拥挤度、提高指数和地域分散的动作，不应被简单解读为全面看空美股',
      ],
    },
  ];
}

function SignalBadge({ signal }: { signal: Insight['signal'] }) {
  const config = {
    bullish:   { label: '看多信号', icon: '↑', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    bearish:   { label: '看空信号', icon: '↓', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    neutral:   { label: '中性信号', icon: '—', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    divergent: { label: '分歧信号', icon: '⇄', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  };
  const c = config[signal];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>
      <span>{c.icon}</span> {c.label}
    </span>
  );
}

export default function MarketInsights() {
  const insights = useMemo(() => generateInsights(), []);

  if (insights.length === 0) return null;

  return (
    <section className="mt-12 mb-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-lg">
          💡
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">持仓变动深度解读</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">基于 9 位顶级投资人的最新 13F 变化，提炼组合动作背后的市场信号</p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        ⚠️ 以下分析仅基于 13F 公开持仓数据的变化趋势，不构成投资建议。13F 有 45 天延迟，且不反映空头、衍生品和非美股资产。投资者应独立研究、审慎决策。
      </div>

      <div className="space-y-4">
        {insights.map(insight => (
          <details
            key={insight.id}
            className="group rounded-xl border border-gray-200 bg-white shadow-sm transition-all open:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <summary className="flex cursor-pointer items-start gap-4 px-5 py-4 select-none list-none [&::-webkit-details-marker]:hidden">
              <span className="mt-0.5 text-2xl shrink-0">{insight.icon}</span>

              <div className="flex-1 min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${insight.tagColor}`}>{insight.tag}</span>
                  <SignalBadge signal={insight.signal} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">{insight.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{insight.body}</p>
              </div>

              <span className="mt-2 shrink-0 text-gray-400 transition-transform group-open:rotate-180">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </summary>

            <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <ul className="space-y-2">
                {insight.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
