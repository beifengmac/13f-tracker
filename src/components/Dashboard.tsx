import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import rawData from '../data.json';
import type { Data, Fund } from '../types';
import { fmtValue, fmtPct, getAllQuarterKeys, getAction, getShareChange, mergeGoogleClasses } from '../utils';
import ActionBadge from './ActionBadge';

const data = rawData as unknown as Data;

const GLOBAL_IDS = ['berkshire', 'bridgewater', 'blackrock', 'ark'];
const CN_IDS     = ['hhlr', 'himalaya', 'hh', 'danbin'];

interface CardInfo {
  id: string;
  fund: Fund;
  quarter: string;
  total: number;
  prevTotal: number | null;
  count: number;
  totalPositions: number;
  buys: { ticker: string; action: 'new' | 'increased'; change: number }[];
  sells: { ticker: string; action: 'decreased' | 'cleared'; change: number }[];
  turnover: number;
}

function buildCard(id: string, fund: Fund, quarter: string): CardInfo | null {
  const q = fund.quarters[quarter];
  if (!q) return null;

  const holdings = mergeGoogleClasses(q.holdings);
  const allQkeys = Object.keys(fund.quarters).sort();
  const qi = allQkeys.indexOf(quarter);
  const prevQ = qi > 0 ? allQkeys[qi - 1] : null;
  const prevTotal = prevQ ? fund.quarters[prevQ]?.total ?? null : null;

  const buys: CardInfo['buys'] = [];
  const sells: CardInfo['sells'] = [];
  let changed = 0;

  for (const h of holdings) {
    const act = getAction(fund, h.t, quarter);
    const chg = getShareChange(fund, h.t, quarter);
    if (act === 'new' || act === 'increased') { buys.push({ ticker: h.t, action: act, change: chg }); changed++; }
    else if (act === 'decreased' || act === 'cleared') { sells.push({ ticker: h.t, action: act, change: chg }); changed++; }
  }

  buys.sort((a, b) => (a.action === 'new' ? -1 : 0) - (b.action === 'new' ? -1 : 0) || Math.abs(b.change) - Math.abs(a.change));
  sells.sort((a, b) => (a.action === 'cleared' ? -1 : 0) - (b.action === 'cleared' ? -1 : 0) || Math.abs(b.change) - Math.abs(a.change));

  const totalPositions = q.total_positions ?? holdings.length;
  const turnover = totalPositions > 0 ? (changed / totalPositions) * 100 : 0;

  return { id, fund, quarter, total: q.total, prevTotal, count: holdings.length, totalPositions, buys: buys.slice(0, 3), sells: sells.slice(0, 3), turnover };
}

/* ── Ticker tape: most notable moves across all funds ────────── */

function buildTickerTape(quarter: string): string[] {
  const items: string[] = [];
  for (const [, fund] of Object.entries(data.funds)) {
    const q = fund.quarters[quarter];
    if (!q) continue;
    for (const h of q.holdings) {
      const act = getAction(fund, h.t, quarter);
      const chg = getShareChange(fund, h.t, quarter);
      if (act === 'new')       items.push(`🔵 ${fund.name_cn}新建${h.t}`);
      else if (act === 'cleared') items.push(`🟠 ${fund.name_cn}清仓${h.t}`);
      else if (act === 'increased' && Math.abs(chg) > 30) items.push(`🟢 ${fund.name_cn}加仓${h.t} ${fmtPct(chg)}`);
      else if (act === 'decreased' && Math.abs(chg) > 30) items.push(`🔴 ${fund.name_cn}减仓${h.t} ${fmtPct(chg)}`);
    }
  }
  return items.slice(0, 20);
}

export default function Dashboard() {
  const allQuarters = useMemo(() => getAllQuarterKeys(data.funds), []);
  const [quarter, setQuarter] = useState(allQuarters[allQuarters.length - 1]);
  const [search, setSearch] = useState('');

  const tape = useMemo(() => buildTickerTape(quarter), [quarter]);

  const renderGroup = (ids: string[], label: string) => {
    const cards = ids
      .map(id => buildCard(id, data.funds[id], quarter))
      .filter((c): c is CardInfo => c !== null)
      .filter(c => {
        if (!search) return true;
        const s = search.toLowerCase();
        return c.fund.name_cn.toLowerCase().includes(s)
          || c.fund.name_en.toLowerCase().includes(s)
          || c.fund.manager.includes(s)
          || c.fund.manager_en.toLowerCase().includes(s);
      });

    if (cards.length === 0) return null;

    return (
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-700 dark:text-gray-300">{label}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(c => {
            const aumChange = c.prevTotal != null ? ((c.total - c.prevTotal) / c.prevTotal) * 100 : null;
            return (
              <Link
                key={c.id}
                to={`/fund/${c.id}`}
                className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
              >
                <div className="mb-1 text-base font-bold text-gray-900 dark:text-white">{c.fund.name_cn}</div>
                <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">{c.fund.name_en}</div>
                <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">👤 {c.fund.manager} · {c.fund.manager_en}</div>

                <div className="mb-3 flex items-baseline gap-2">
                  <span className="font-mono text-xl font-bold text-gray-900 dark:text-white">{fmtValue(c.total)}</span>
                  {aumChange != null && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${aumChange >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                      {fmtPct(aumChange)}
                    </span>
                  )}
                </div>

                <div className="mb-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>📈 {c.count} 持仓</span>
                  <span>🔄 换手 {c.turnover.toFixed(0)}%</span>
                </div>

                {c.buys.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-gray-400 mr-1">买入</span>
                    {c.buys.map(b => (
                      <ActionBadge key={b.ticker} action={b.action} change={b.change} compact />
                    ))}
                    {c.buys.map(b => (
                      <span key={b.ticker + '_t'} className="text-[10px] font-mono text-gray-600 dark:text-gray-300">{b.ticker}</span>
                    ))}
                  </div>
                )}
                {c.sells.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-gray-400 mr-1">卖出</span>
                    {c.sells.map(b => (
                      <ActionBadge key={b.ticker} action={b.action} change={b.change} compact />
                    ))}
                    {c.sells.map(b => (
                      <span key={b.ticker + '_t'} className="text-[10px] font-mono text-gray-600 dark:text-gray-300">{b.ticker}</span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div>
      {/* Top controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={quarter}
          onChange={e => setQuarter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        >
          {allQuarters.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search fund / manager…"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </div>

      {/* Ticker tape */}
      {tape.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center">
            <span className="shrink-0 bg-blue-600 px-3 py-2 text-xs font-bold text-white">本季度变动</span>
            <div className="overflow-hidden">
              <div className="flex animate-[scroll_40s_linear_infinite] gap-6 whitespace-nowrap px-4 py-2 text-xs text-gray-600 dark:text-gray-300">
                {tape.map((t, i) => <span key={i}>{t}</span>)}
                {tape.map((t, i) => <span key={'d' + i}>{t}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {renderGroup(GLOBAL_IDS, '🌍 Global Legends')}
      {renderGroup(CN_IDS, '🐉 Chinese Value Masters')}
    </div>
  );
}
