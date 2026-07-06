import { useState, useMemo, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

import rawData from '../data.json';
import type { Data, Action } from '../types';
import { fmtValue, fmtShares, getAllQuarterKeys, getAction, getShareChange, mergeGoogleClasses } from '../utils';
import ActionBadge from './ActionBadge';

const data = rawData as unknown as Data;

const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

interface FundRow {
  fundId: string;
  fundName: string;
  weight: number;
  shares: number;
  value: number;
  action: Action;
  change: number;
}

export default function StockLookup() {
  const { ticker: paramTicker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState(paramTicker?.toUpperCase() ?? '');
  const ticker = paramTicker?.toUpperCase() ?? '';

  const allQuarters = useMemo(() => getAllQuarterKeys(data.funds), []);
  const latestQ = allQuarters[allQuarters.length - 1];

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const t = search.trim().toUpperCase();
    if (t) navigate(`/stock/${encodeURIComponent(t)}`);
  };

  const fundRows = useMemo((): FundRow[] => {
    if (!ticker) return [];
    const rows: FundRow[] = [];
    for (const [fundId, fund] of Object.entries(data.funds)) {
      const q = fund.quarters[latestQ];
      if (!q) continue;
      const holdings = mergeGoogleClasses(q.holdings);
      const h = holdings.find(x => x.t === ticker);
      if (!h) continue;
      rows.push({
        fundId,
        fundName: fund.name_cn,
        weight: h.w,
        shares: h.s,
        value: h.v,
        action: getAction(fund, ticker, latestQ),
        change: getShareChange(fund, ticker, latestQ),
      });
    }
    return rows.sort((a, b) => b.weight - a.weight);
  }, [ticker, latestQ]);

  const chartData = useMemo(() => fundRows.map(r => ({ name: r.fundName, weight: r.weight })), [fundRows]);

  const buying = fundRows.filter(r => r.action === 'new' || r.action === 'increased').length;
  const selling = fundRows.filter(r => r.action === 'decreased' || r.action === 'cleared').length;
  const holding = fundRows.filter(r => r.action === 'unchanged').length;
  const total = fundRows.length;
  const consensusPct = total > 0 ? (buying / total) * 100 : 50;

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-blue-500 hover:underline">
        ← Dashboard
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Stock Lookup</h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g. AAPL, GOOG)…"
            className="flex-1 max-w-xs rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-mono outline-none focus:border-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Search
          </button>
        </form>
      </div>

      {ticker && fundRows.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-lg text-gray-400">No funds hold <span className="font-mono font-bold">{ticker}</span> in {latestQ}</p>
        </div>
      )}

      {fundRows.length > 0 && (
        <>
          {/* Consensus meter */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">{ticker}</span> — Consensus ({latestQ})
            </h2>
            <div className="mb-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="text-green-600 dark:text-green-400">🟢 Buying: {buying}</span>
              <span className="text-red-600 dark:text-red-400">🔴 Selling: {selling}</span>
              <span className="text-gray-500">⚫ Holding: {holding}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                style={{ width: `${consensusPct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-400">
              <span>Bullish</span>
              <span>Bearish</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-6">
            {/* Weight chart */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Weight by Fund</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                  <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Fund list */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Holdings Detail</h3>
              <div className="space-y-2">
                {fundRows.map(r => (
                  <Link
                    key={r.fundId}
                    to={`/fund/${r.fundId}`}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 hover:border-gray-300 transition dark:border-gray-800 dark:bg-gray-800/50 dark:hover:border-gray-600"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">{r.fundName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        {fmtValue(r.value)} · {fmtShares(r.shares)} shares · {r.weight.toFixed(2)}%
                      </div>
                    </div>
                    <ActionBadge action={r.action} change={r.change} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
