import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import rawData from '../data.json';
import type { Data, Action } from '../types';
import { fmtValue, getAllQuarterKeys, getAction, mergeGoogleClasses } from '../utils';
import ActionBadge from './ActionBadge';

const data = rawData as unknown as Data;
const FUND_IDS = Object.keys(data.funds);

interface MatrixCell {
  weight: number;
  value: number;
  action: Action;
}

interface MatrixRow {
  ticker: string;
  name: string;
  cells: (MatrixCell | null)[];
  totalValue: number;
  consensus: 'buy' | 'sell' | 'mixed' | 'neutral';
}

export default function CompareView() {
  const allQuarters = useMemo(() => getAllQuarterKeys(data.funds), []);
  const [quarter, setQuarter] = useState(allQuarters[allQuarters.length - 1]);
  const [selected, setSelected] = useState<string[]>(() => FUND_IDS.slice(0, 3));

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const matrix = useMemo((): MatrixRow[] => {
    if (selected.length < 2) return [];

    // Collect all tickers across selected funds
    const tickerMap = new Map<string, { name: string; totalValue: number }>();
    for (const fid of selected) {
      const fund = data.funds[fid];
      const q = fund.quarters[quarter];
      if (!q) continue;
      const holdings = mergeGoogleClasses(q.holdings);
      for (const h of holdings) {
        const existing = tickerMap.get(h.t);
        if (existing) {
          existing.totalValue += h.v;
        } else {
          tickerMap.set(h.t, { name: h.n, totalValue: h.v });
        }
      }
    }

    // Sort by total value and take top 25
    const sorted = [...tickerMap.entries()]
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .slice(0, 25);

    return sorted.map(([ticker, info]): MatrixRow => {
      const cells = selected.map((fid): MatrixCell | null => {
        const fund = data.funds[fid];
        const q = fund.quarters[quarter];
        if (!q) return null;
        const holdings = mergeGoogleClasses(q.holdings);
        const h = holdings.find(x => x.t === ticker);
        if (!h) return null;
        return {
          weight: h.w,
          value: h.v,
          action: getAction(fund, ticker, quarter),
        };
      });

      // Determine consensus
      const actions = cells.filter((c): c is MatrixCell => c !== null).map(c => c.action);
      const buyCount = actions.filter(a => a === 'new' || a === 'increased').length;
      const sellCount = actions.filter(a => a === 'decreased' || a === 'cleared').length;
      let consensus: MatrixRow['consensus'] = 'neutral';
      if (buyCount > 0 && sellCount > 0) consensus = 'mixed';
      else if (buyCount > 0) consensus = 'buy';
      else if (sellCount > 0) consensus = 'sell';

      return { ticker, name: info.name, cells, totalValue: info.totalValue, consensus };
    });
  }, [selected, quarter]);

  const consensusBg: Record<string, string> = {
    buy: 'bg-green-50/50 dark:bg-green-900/10',
    sell: 'bg-red-50/50 dark:bg-red-900/10',
    mixed: 'bg-yellow-50/50 dark:bg-yellow-900/10',
    neutral: '',
  };

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-blue-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Compare Funds</h1>

      {/* Controls */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Select 2–4 funds:</span>
          <select
            value={quarter}
            onChange={e => setQuarter(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {allQuarters.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {FUND_IDS.map(id => {
            const f = data.funds[id];
            const isSelected = selected.includes(id);
            const disabled = !isSelected && selected.length >= 4;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                disabled={disabled}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : disabled
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600 dark:border-gray-700'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                }`}
              >
                {f.name_cn}
              </button>
            );
          })}
        </div>
      </div>

      {selected.length < 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-400">Please select at least 2 funds to compare</p>
        </div>
      )}

      {selected.length >= 2 && (
        <>
          {/* Legend */}
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-100 dark:bg-green-900/40" /> Consensus Buy</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-100 dark:bg-red-900/40" /> Consensus Sell</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-100 dark:bg-yellow-900/40" /> Divergence</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Stock</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Value</th>
                  {selected.map(fid => (
                    <th key={fid} className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {data.funds[fid].name_cn}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {matrix.map(row => (
                  <tr key={row.ticker} className={`transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/10 ${consensusBg[row.consensus]}`}>
                    <td className="px-3 py-2">
                      <Link to={`/stock/${encodeURIComponent(row.ticker)}`} className="font-mono font-semibold text-blue-600 hover:underline dark:text-blue-400">
                        {row.ticker}
                      </Link>
                      <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{row.name}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-600 dark:text-gray-300">{fmtValue(row.totalValue)}</td>
                    {row.cells.map((cell, i) => (
                      <td key={selected[i]} className="px-3 py-2 text-center">
                        {cell ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-mono text-xs tabular-nums text-gray-900 dark:text-white">{cell.weight.toFixed(2)}%</span>
                            <ActionBadge action={cell.action} compact />
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      {row.consensus === 'buy' && <span className="text-green-600 dark:text-green-400 text-xs font-medium">📈 All Buy</span>}
                      {row.consensus === 'sell' && <span className="text-red-600 dark:text-red-400 text-xs font-medium">📉 All Sell</span>}
                      {row.consensus === 'mixed' && <span className="text-yellow-600 dark:text-yellow-400 text-xs font-medium">⚡ Diverge</span>}
                      {row.consensus === 'neutral' && <span className="text-gray-400 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
