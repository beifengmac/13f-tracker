import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import rawData from '../data.json';
import type { Data } from '../types';
import { generateMarketInsights, type Insight } from '../analysis';

const data = rawData as unknown as Data;

function SignalBadge({ signal }: { signal: Insight['signal'] }) {
  const config = {
    bullish:   { label: '增加记录', icon: '↑', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    bearish:   { label: '减少记录', icon: '↓', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    neutral:   { label: '持仓观察', icon: '—', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    divergent: { label: '双向调整', icon: '⇄', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  };
  const c = config[signal];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>
      <span>{c.icon}</span> {c.label}
    </span>
  );
}

export default function MarketInsights({ quarter }: { quarter: string }) {
  const insights = useMemo(() => generateMarketInsights(data, quarter), [quarter]);

  if (insights.length === 0) return null;

  return (
    <section className="mt-12 mb-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-lg">
          💡
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">机构证据摘要</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">先看可核对的变化，再进入机构深度报告查看历史证据</p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        ⚠️ 以下分析仅基于 13F 公开持仓数据的变化趋势，不构成投资建议。13F 通常在季末后 45 天内披露，包含部分期权，但不覆盖空头、现金及完整资产组合。
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
              <Link className="inline-block mb-4 text-blue-600 hover:underline" to={`/fund/${insight.id}?quarter=${encodeURIComponent(quarter)}`}>查看深度报告 →</Link>
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
