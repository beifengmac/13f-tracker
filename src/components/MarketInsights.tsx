import { useMemo } from 'react';
import rawData from '../data.json';
import type { Data } from '../types';
import { fmtValue, fmtPct, getAllQuarterKeys, getAction, getShareChange, mergeGoogleClasses } from '../utils';

const data = rawData as unknown as Data;

/* ── Types ───────────────────────────────────────────────────── */

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

/* ── Fund display helpers ────────────────────────────────────── */

const FUND_LABELS: Record<string, string> = {
  berkshire: '巴菲特', bridgewater: '达利欧', blackrock: '贝莱德',
  ark: '木头姐', hhlr: '高瓴/张磊', himalaya: '李录',
  hh: '段永平', danbin: '但斌',
};

/* ── Build insights from actual data ─────────────────────────── */

function generateInsights(): Insight[] {
  const allQs = getAllQuarterKeys(data.funds);
  const latestQ = allQs[allQs.length - 1];
  const earliestQ = allQs[0];
  const insights: Insight[] = [];

  // 1. Gather cross-fund stock data
  interface StockSignal {
    ticker: string;
    name: string;
    holders: { fundId: string; weight: number; action: string; change: number }[];
  }

  const stockMap = new Map<string, StockSignal>();

  for (const [fundId, fund] of Object.entries(data.funds)) {
    const q = fund.quarters[latestQ];
    if (!q) continue;
    const holdings = mergeGoogleClasses(q.holdings);
    for (const h of holdings) {
      const act = getAction(fund, h.t, latestQ);
      const chg = getShareChange(fund, h.t, latestQ);
      if (!stockMap.has(h.t)) {
        stockMap.set(h.t, { ticker: h.t, name: h.n, holders: [] });
      }
      stockMap.get(h.t)!.holders.push({ fundId, weight: h.w, action: act, change: chg });
    }
    // Also check cleared positions
    const prevQ = allQs[allQs.indexOf(latestQ) - 1];
    if (prevQ && fund.quarters[prevQ]) {
      const prevHoldings = mergeGoogleClasses(fund.quarters[prevQ].holdings);
      for (const h of prevHoldings) {
        const act = getAction(fund, h.t, latestQ);
        if (act === 'cleared') {
          if (!stockMap.has(h.t)) {
            stockMap.set(h.t, { ticker: h.t, name: h.n, holders: [] });
          }
          const existing = stockMap.get(h.t)!.holders;
          if (!existing.find(e => e.fundId === fundId)) {
            existing.push({ fundId, weight: 0, action: 'cleared', change: -100 });
          }
        }
      }
    }
  }

  // === INSIGHT: AAPL — Buffett's conviction vs Duan Yongping ===
  const aapl = stockMap.get('AAPL');
  if (aapl) {
    const buffett = aapl.holders.find(h => h.fundId === 'berkshire');
    const duan = aapl.holders.find(h => h.fundId === 'hh');
    if (buffett && duan) {
      // Get YoY change for Berkshire AAPL
      const brkFund = data.funds['berkshire'];
      const brkEarliest = brkFund.quarters[earliestQ];
      const brkLatest = brkFund.quarters[latestQ];
      const brkAaplEarly = brkEarliest?.holdings.find(h => h.t === 'AAPL');
      const brkAaplLate = brkLatest?.holdings.find(h => h.t === 'AAPL');
      const brkChange = brkAaplEarly && brkAaplLate
        ? ((brkAaplLate.s - brkAaplEarly.s) / brkAaplEarly.s * 100) : 0;

      const hhFund = data.funds['hh'];
      const hhEarliest = hhFund.quarters[earliestQ];
      const hhLatest = hhFund.quarters[latestQ];
      const hhAaplEarly = hhEarliest?.holdings.find(h => h.t === 'AAPL');
      const hhAaplLate = hhLatest?.holdings.find(h => h.t === 'AAPL');
      const hhChange = hhAaplEarly && hhAaplLate
        ? ((hhAaplLate.s - hhAaplEarly.s) / hhAaplEarly.s * 100) : 0;

      insights.push({
        id: 'aapl',
        icon: '🍎',
        tag: 'AAPL',
        tagColor: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        title: '苹果：两大重仓者的微妙分歧',
        signal: 'neutral',
        body: `苹果仍然是巴菲特（${buffett.weight.toFixed(1)}%）和段永平（${duan.weight.toFixed(1)}%）的第一大持仓，但两人都在年内小幅减持。巴菲特连续减持表明他认为当前估值已经充分反映了价值——这不是看空，而是组合再平衡。段永平减持苹果的资金大部分流向了英伟达和拼多多。`,
        details: [
          `巴菲特：占比 ${buffett.weight.toFixed(1)}%，年内持股变化 ${fmtPct(brkChange)}`,
          `段永平：占比 ${duan.weight.toFixed(1)}%，年内持股变化 ${fmtPct(hhChange)}`,
          '巴菲特已连续多个季度减持苹果，但仍是绝对第一大重仓，说明核心信仰不变',
          '个人投资者启示：苹果仍是顶级公司，但估值已高，不宜追涨，适合持有',
        ],
      });
    }
  }

  // === INSIGHT: PDD — Chinese investor consensus ===
  const pdd = stockMap.get('PDD');
  if (pdd) {
    const cnHolders = pdd.holders.filter(h => ['hhlr', 'himalaya', 'hh', 'danbin'].includes(h.fundId));
    if (cnHolders.length >= 3) {
      const holderDetails = cnHolders.map(h => {
        const label = FUND_LABELS[h.fundId];
        return `${label}（${h.weight.toFixed(1)}%，${h.action === 'new' ? '新建仓' : h.change > 0 ? `加仓${fmtPct(h.change)}` : h.change < 0 ? `减仓${fmtPct(h.change)}` : '持平'}）`;
      });

      // Get YoY data for Duan Yongping PDD
      const hhFund = data.funds['hh'];
      const hhPddEarly = hhFund.quarters[earliestQ]?.holdings.find(h => h.t === 'PDD');
      const hhPddLate = hhFund.quarters[latestQ]?.holdings.find(h => h.t === 'PDD');
      const hhPddYoY = hhPddEarly && hhPddLate
        ? ((hhPddLate.s - hhPddEarly.s) / hhPddEarly.s * 100) : 0;

      insights.push({
        id: 'pdd',
        icon: '🛒',
        tag: 'PDD',
        tagColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
        title: '拼多多：华人投资人最大共识',
        signal: 'bullish',
        body: `四位华人价值投资人中有 ${cnHolders.length} 位重仓拼多多，这是最强的共识信号。段永平年内加仓 ${fmtPct(hhPddYoY)}（从 775 万股到近 2000 万股），李录更是在 Q2 2025 一次性建仓 460 万股后持股不动——典型的"看准了一把到位"风格。当多个独立判断的顶级投资人同时重仓同一标的，个人投资者应该认真研究其投资逻辑。`,
        details: [
          ...holderDetails,
          '核心逻辑：Temu 海外扩张 + 中国农业电商深耕，双引擎增长',
          '风险提示：海外监管风险、与 SHEIN 竞争、中美地缘政治',
          '个人投资者启示：多位顶级投资人的共识降低了判断错误的概率，但仍需独立研究基本面',
        ],
      });
    }
  }

  // === INSIGHT: BABA — Being abandoned ===
  const baba = stockMap.get('BABA');
  if (baba) {
    const clearers = baba.holders.filter(h => h.action === 'cleared');
    const reducers = baba.holders.filter(h => h.action === 'decreased');
    if (clearers.length + reducers.length >= 2) {
      insights.push({
        id: 'baba',
        icon: '📦',
        tag: 'BABA',
        tagColor: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        title: '阿里巴巴：被系统性抛弃',
        signal: 'bearish',
        body: `段永平清仓阿里（原持仓 4.4%）、高瓴减持 55%，李录从未持有。这不是个别投资人的判断，而是对阿里竞争力的系统性重新评估。当最了解中国互联网的投资人们集体用脚投票选择拼多多而非阿里，个人投资者应该高度警惕。`,
        details: [
          ...clearers.map(h => `${FUND_LABELS[h.fundId]}：清仓`),
          ...reducers.map(h => `${FUND_LABELS[h.fundId]}：减仓 ${fmtPct(h.change)}`),
          '核心问题：组织效率低下、国内电商份额被拼多多蚕食、云业务增长放缓',
          '对比信号：同一批投资人在加仓拼多多的同时减仓阿里，说明他们不是看空中概整体，而是看空阿里个体',
          '个人投资者启示：便宜不等于有价值，"深度价值陷阱"是最大风险',
        ],
      });
    }
  }

  // === INSIGHT: NVDA — Duan Yongping all-in AI ===
  const nvda = stockMap.get('NVDA');
  if (nvda) {
    const duan = nvda.holders.find(h => h.fundId === 'hh');
    if (duan) {
      // Year-over-year
      const hhFund = data.funds['hh'];
      const hhNvdaEarly = hhFund.quarters[earliestQ]?.holdings.find(h => h.t === 'NVDA');
      const hhNvdaLate = hhFund.quarters[latestQ]?.holdings.find(h => h.t === 'NVDA');
      const yoyChg = hhNvdaEarly && hhNvdaLate
        ? ((hhNvdaLate.s - hhNvdaEarly.s) / hhNvdaEarly.s * 100) : 0;

      const allNvdaHolders = nvda.holders.filter(h => h.weight > 0.5);

      insights.push({
        id: 'nvda',
        icon: '🤖',
        tag: 'NVDA',
        tagColor: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
        title: `英伟达：段永平年内加仓 ${fmtPct(yoyChg)}，AI 信仰最强信号`,
        signal: 'bullish',
        body: `段永平在一年内将英伟达持仓从 64.5 万股暴增至 1384 万股，加仓幅度超过 20 倍。这是一个以"只买看得懂的公司"著称的投资人对 AI 赛道的全面拥抱。同时他还新建仓了 Credo Technology（AI 数据中心光互联，加仓 432%）和 Palantir，形成了完整的 AI 基础设施投资矩阵。`,
        details: [
          ...allNvdaHolders.map(h => `${FUND_LABELS[h.fundId]}：${h.weight.toFixed(1)}%`),
          '段永平 AI 布局：NVDA（GPU）+ CRDO（光互联）+ MSFT（云平台）+ PLTR（数据分析）',
          '高瓴也在小仓位试水光通信链：MRVL + Coherent + Lumentum + Corning',
          '个人投资者启示：AI 基础设施是当前最大的投资主题，但需注意估值已高，优先关注产业链上游',
        ],
      });
    }
  }

  // === INSIGHT: TSLA — ARK + Duan Yongping convergence ===
  const tsla = stockMap.get('TSLA');
  if (tsla) {
    const arkHolder = tsla.holders.find(h => h.fundId === 'ark');
    const duanHolder = tsla.holders.find(h => h.fundId === 'hh');
    if (arkHolder && duanHolder) {
      insights.push({
        id: 'tsla',
        icon: '⚡',
        tag: 'TSLA',
        tagColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
        title: '特斯拉：成长派与价值派的罕见交汇',
        signal: 'bullish',
        body: `木头姐的 ARK 一直是特斯拉最坚定的多头，但更令人意外的是，以价值投资著称的段永平也在本季度新建仓特斯拉（直接成为第 5 大持仓，占比 ${duanHolder.weight.toFixed(1)}%）。当成长派和价值派同时看好一家公司，这个信号的权重远大于任何单一投资人的判断。`,
        details: [
          `木头姐 ARK：${arkHolder.weight.toFixed(1)}%`,
          `段永平：${duanHolder.weight.toFixed(1)}%（🆕 新建仓）`,
          '段永平此前公开表示过不看好特斯拉，态度 180° 转变说明 FSD/Robotaxi 可能已到拐点',
          '个人投资者启示：关注特斯拉 FSD 的商业化进展和 Robotaxi 落地时间表',
        ],
      });
    }
  }

  // === INSIGHT: Google — Li Lu's massive conviction ===
  const goog = stockMap.get('GOOG');
  if (goog) {
    const liLu = goog.holders.find(h => h.fundId === 'himalaya');
    if (liLu && liLu.weight > 30) {
      insights.push({
        id: 'goog',
        icon: '🔍',
        tag: 'GOOG',
        tagColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
        title: `Google：李录 ${liLu.weight.toFixed(0)}% 重仓不动，AI 时代最强信仰`,
        signal: 'bullish',
        body: `李录将近一半的投资组合放在 Google 上（GOOGL + GOOG 合计 ${liLu.weight.toFixed(1)}%），而且四个季度一股没动。作为查理·芒格生前唯一委托管理资金的华人基金经理，李录的投资风格是"极度集中 + 极度长期"。他对 Google 在 AI 时代的竞争力有着超越市场的信心。段永平也在年内加仓 Google 234%，进一步验证了这一判断。`,
        details: [
          '李录对 Google 的信念：搜索垄断 + YouTube + Cloud + Gemini AI，护城河极深',
          '段永平 GOOG 年内加仓 234%（111万→371万股），从另一个角度验证',
          '高瓴反向操作：清仓了 Google（但高瓴持仓极小，不具代表性）',
          '个人投资者启示：Google 是 AI 时代的核心基础设施之一，当前估值相对合理',
        ],
      });
    }
  }

  // === INSIGHT: Financial data infrastructure ===
  const spgi = stockMap.get('SPGI');
  const mco = stockMap.get('MCO');
  const msci = stockMap.get('MSCI');
  if (spgi || mco || msci) {
    const liLuFinData = [spgi, mco, msci].filter(Boolean).flatMap(s =>
      s!.holders.filter(h => h.fundId === 'himalaya')
    );
    if (liLuFinData.length >= 2) {
      insights.push({
        id: 'fin-data',
        icon: '📊',
        tag: '金融数据',
        tagColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
        title: '李录新主题：全球金融基础设施三巨头',
        signal: 'bullish',
        body: `李录在本季度同时新建仓 S&P Global、Moody's 和 MSCI——这三家公司构成了全球金融数据和评级的基础设施。这不是简单的行业配置，而是一个完整的主题投资：全球资本市场越发展，对标准化数据、信用评级和指数的需求就越大。这些公司拥有极深的护城河和定价权。`,
        details: [
          ...liLuFinData.map((h, i) => {
            return `${['SPGI', 'MCO', 'MSCI'][i] ?? ''}: 占比 ${h.weight.toFixed(1)}%（🆕 新建仓）`;
          }),
          '商业模式：数据+评级+指数 = 三重订阅收入，高壁垒、高毛利、低周期性',
          '个人投资者启示：金融基础设施是"卖铲人"逻辑——不管谁赚钱，数据和评级永远有需求',
        ],
      });
    }
  }

  // === INSIGHT: Berkshire's massive cash / defensive moves ===
  const berkshire = data.funds['berkshire'];
  if (berkshire) {
    const latestBrk = berkshire.quarters[latestQ];
    const earliestBrk = berkshire.quarters[earliestQ];
    if (latestBrk && earliestBrk) {
      const aumChange = ((latestBrk.total - earliestBrk.total) / earliestBrk.total) * 100;
      const latestCount = latestBrk.holdings.length;
      const earliestCount = earliestBrk.holdings.length;

      if (latestCount < earliestCount) {
        insights.push({
          id: 'brk-defensive',
          icon: '🛡️',
          tag: '巴菲特',
          tagColor: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
          title: `巴菲特持续收缩：持仓从 ${earliestCount} 只减至 ${latestCount} 只`,
          signal: 'bearish',
          body: `巴菲特在过去一年将持仓数量从 ${earliestCount} 只收缩到 ${latestCount} 只，同时持续减持苹果。结合伯克希尔创纪录的现金储备（超过 3000 亿美元），巴菲特正在用行动表达他对当前市场估值的看法——"当别人贪婪时恐惧"。这是一个值得所有投资者关注的宏观信号。`,
          details: [
            `13F 持仓市值变化：${fmtValue(earliestBrk.total)} → ${fmtValue(latestBrk.total)}（${fmtPct(aumChange)}）`,
            '现金储备创历史新高：暗示巴菲特认为当前市场缺乏足够吸引力的大型投资机会',
            '策略含义：不是看空经济，而是认为优质资产价格已经被充分定价',
            '个人投资者启示：在市场狂热时保持一定现金比例是审慎的做法',
          ],
        });
      }
    }
  }

  // === INSIGHT: High-conviction new position (CRDO) ===
  const crdo = stockMap.get('CRDO');
  if (crdo) {
    const duanCrdo = crdo.holders.find(h => h.fundId === 'hh');
    if (duanCrdo && duanCrdo.action === 'new') {
      insights.push({
        id: 'crdo',
        icon: '🔌',
        tag: 'AI 基础设施',
        tagColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
        title: '段永平的 AI "隐藏下注"：Credo Technology',
        signal: 'bullish',
        body: `在大家关注段永平加仓英伟达时，他还悄悄建仓了 Credo Technology（CRDO），并在一个季度内加仓 432%。Credo 是 AI 数据中心高速以太网连接芯片的核心供应商，直接受益于 AI 算力扩张。高瓴也在布局相关的光通信产业链（Marvell、Coherent、Lumentum）。当两个独立的投资人同时布局 AI 连接层，这条产业链值得重点关注。`,
        details: [
          '段永平：Credo Technology 新建仓后加仓 432%',
          '高瓴：新建仓 Marvell、Coherent、Lumentum、Corning（光通信全产业链）',
          '投资逻辑：GPU 算力越多 → 数据中心间连接需求越大 → 高速以太网/光互联是瓶颈',
          '个人投资者启示：AI 投资不只有英伟达，"连接层"公司可能提供更好的风险回报比',
        ],
      });
    }
  }

  return insights;
}

/* ── Signal badge ────────────────────────────────────────────── */

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

/* ── Main component ──────────────────────────────────────────── */

export default function MarketInsights() {
  const insights = useMemo(() => generateInsights(), []);

  if (insights.length === 0) return null;

  return (
    <section className="mt-12 mb-8">
      {/* Section header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-lg">
          💡
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">持仓变动深度解读</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">基于 8 位顶级投资人的持仓变化，分析背后的市场逻辑与投资信号</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        ⚠️ 以下分析仅基于 13F 公开持仓数据的变化趋势，不构成投资建议。13F 有 45 天延迟，且不反映空头、衍生品和非美股资产。投资者应独立研究、审慎决策。
      </div>

      {/* Insight cards */}
      <div className="space-y-4">
        {insights.map(insight => (
          <details
            key={insight.id}
            className="group rounded-xl border border-gray-200 bg-white shadow-sm transition-all open:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <summary className="flex cursor-pointer items-start gap-4 px-5 py-4 select-none list-none [&::-webkit-details-marker]:hidden">
              {/* Icon */}
              <span className="mt-0.5 text-2xl shrink-0">{insight.icon}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${insight.tagColor}`}>{insight.tag}</span>
                  <SignalBadge signal={insight.signal} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">{insight.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{insight.body}</p>
              </div>

              {/* Expand arrow */}
              <span className="mt-2 shrink-0 text-gray-400 transition-transform group-open:rotate-180">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </summary>

            {/* Detail content */}
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
