import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

import rawData from '../data.json';
import type { Data, Holding, Action, SortKey, SortDir } from '../types';
import { fmtValue, fmtShares, fmtPct, getQuarterKeys, getAction, getShareChange, mergeGoogleClasses, inferSector, estimateCost } from '../utils';
import ActionBadge from './ActionBadge';

const data = rawData as unknown as Data;

const ACTION_ORDER: Record<Action, number> = { new: 0, increased: 1, unchanged: 2, decreased: 3, cleared: 4 };
const SECTOR_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#64748b'];

interface Row extends Holding {
  action: Action;
  change: number;
  entryPrice: number | null;
  currentPrice: number | null;
  pnlPct: number | null;
  entryQuarter: string | null;
}

export default function FundDetail() {
  const { id } = useParams<{ id: string }>();
  const fund = id ? data.funds[id] : undefined;

  const quarters = useMemo(() => (fund ? getQuarterKeys(fund) : []), [fund]);
  const [selectedQ, setSelectedQ] = useState(() => quarters[quarters.length - 1] ?? '');
  const [sortKey, setSortKey] = useState<SortKey>('v');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterAction, setFilterAction] = useState<'all' | Action>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!fund || !fund.quarters[selectedQ]) return [];
    const merged = mergeGoogleClasses(fund.quarters[selectedQ].holdings);
    return merged.map((h): Row => {
      const cost = estimateCost(fund, h.t);
      return {
        ...h,
        action: getAction(fund, h.t, selectedQ),
        change: getShareChange(fund, h.t, selectedQ),
        entryPrice: cost?.entryPrice ?? null,
        currentPrice: cost?.currentPrice ?? null,
        pnlPct: cost?.pnlPct ?? null,
        entryQuarter: cost?.entryQuarter ?? null,
      };
    });
  }, [fund, selectedQ]);

  const filtered = useMemo(() => {
    let list = filterAction === 'all' ? rows : rows.filter(r => r.action === filterAction);
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 't': cmp = a.t.localeCompare(b.t); break;
        case 'n': cmp = a.n.localeCompare(b.n); break;
        case 'v': cmp = a.v - b.v; break;
        case 'w': cmp = a.w - b.w; break;
        case 's': cmp = a.s - b.s; break;
        case 'change': cmp = a.change - b.change; break;
        case 'action': cmp = ACTION_ORDER[a.action] - ACTION_ORDER[b.action]; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [rows, filterAction, sortKey, sortDir]);

  /* ── Charts data ─────────────────────────────── */

  const aumTrend = useMemo(() => {
    if (!fund) return [];
    return quarters.map(q => ({ quarter: q, value: fund.quarters[q]?.total ?? 0 }));
  }, [fund, quarters]);

  const sectorData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const sec = inferSector(r.n);
      map.set(sec, (map.get(sec) ?? 0) + r.w);
    }
    return [...map.entries()]
      .map(([name, weight]) => ({ name, weight: +weight.toFixed(2) }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [rows]);

  /* ── Sort handler ────────────────────────────── */

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 't' || key === 'n' ? 'asc' : 'desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-0.5 text-[10px] text-gray-400">{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
  );

  /* ── Sparkline for expanded row ──────────────── */

  const Sparkline = ({ ticker, row }: { ticker: string; row: Row }) => {
    const sparkData = quarters.map(q => {
      const h = mergeGoogleClasses(fund!.quarters[q]?.holdings ?? []).find(x => x.t === ticker);
      return { q, v: h?.v ?? 0, s: h?.s ?? 0 };
    });
    const cost = row;
    return (
      <div className="py-3 px-4">
        {/* Cost basis card */}
        {cost.entryPrice != null && cost.pnlPct != null && (
          <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">估算建仓价</span>
              <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                ${cost.entryPrice < 1 ? cost.entryPrice.toFixed(4) : cost.entryPrice < 100 ? cost.entryPrice.toFixed(2) : cost.entryPrice.toFixed(0)}
              </span>
              <span className="text-[10px] text-gray-400">({cost.entryQuarter})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">现价</span>
              <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-200">
                ${cost.currentPrice! < 1 ? cost.currentPrice!.toFixed(4) : cost.currentPrice! < 100 ? cost.currentPrice!.toFixed(2) : cost.currentPrice!.toFixed(0)}
              </span>
            </div>
            <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${
              cost.pnlPct >= 0
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            }`}>
              {cost.pnlPct >= 0 ? '▲' : '▼'} {fmtPct(cost.pnlPct)}
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">ℹ️ 估算值，基于首次出现在 13F 时的每股市值</span>
          </div>
        )}
        {/* Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Value over Time</div>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={sparkData}>
                <Area type="monotone" dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={1.5} />
                <XAxis dataKey="q" tick={{ fontSize: 9 }} />
                <Tooltip formatter={(val: any) => fmtValue(Number(val))} labelFormatter={(l: any) => String(l)} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Shares over Time</div>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={sparkData}>
                <Area type="monotone" dataKey="s" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={1.5} />
                <XAxis dataKey="q" tick={{ fontSize: 9 }} />
                <Tooltip formatter={(val: any) => fmtShares(Number(val))} labelFormatter={(l: any) => String(l)} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  /* ── Guard ────────────────────────────────────── */

  if (!fund) {
    return (
      <div className="py-20 text-center">
        <p className="text-xl text-gray-400">Fund not found</p>
        <Link to="/" className="mt-4 inline-block text-blue-500 hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }

  const q = fund.quarters[selectedQ];
  const concentration = rows.slice(0, 10).reduce((s, r) => s + r.w, 0);
  const totalPositions = q?.total_positions ?? rows.length;

  /* ── Action filter tabs ──────────────────────── */

  const actionCounts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    for (const r of rows) m[r.action] = (m[r.action] ?? 0) + 1;
    return m;
  }, [rows]);

  const TABS: { key: 'all' | Action; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: '新建' },
    { key: 'increased', label: '加仓' },
    { key: 'decreased', label: '减仓' },
    { key: 'cleared', label: '清仓' },
  ];

  return (
    <div>
      {/* Back link */}
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-blue-500 hover:underline">
        ← Dashboard
      </Link>

      {/* Header */}
      <header className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{fund.name_cn}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{fund.name_en}</p>
            <p className="mt-1 text-xs text-gray-400">👤 {fund.manager} · {fund.manager_en} · CIK {fund.cik}</p>
            <p className="mt-1 text-xs text-gray-400">{fund.description}</p>
          </div>
          <div className="text-right">
            <select
              value={selectedQ}
              onChange={e => setSelectedQ(e.target.value)}
              className="mb-2 rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {quarters.map(q2 => <option key={q2} value={q2}>{q2}</option>)}
            </select>
            <div className="font-mono text-3xl font-bold text-gray-900 dark:text-white">{fmtValue(q?.total ?? 0)}</div>
            <div className="mt-1 flex items-center justify-end gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>📈 {totalPositions} positions</span>
              <span>🎯 Top‑10: {concentration.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </header>

      {/* Charts row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* AUM trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">AUM Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={aumTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => fmtValue(v)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v: any) => fmtValue(Number(v))} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sector breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Sector Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sectorData} layout="vertical" margin={{ left: 60 }}>
              <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
                {sectorData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Action filter tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterAction(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterAction === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label} ({actionCounts[tab.key] ?? 0})
          </button>
        ))}
      </div>

      {totalPositions > rows.length && (
        <p className="mb-2 text-xs text-gray-400">显示前 {rows.length} 大持仓 (共 {totalPositions} 只)</p>
      )}

      {/* ── Holdings table (desktop) ─────────────── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80">
            <tr>
              {([['t','Ticker'],['n','Name'],['v','Value'],['w','Weight%'],['s','Shares'],['change','Change%'],['action','Action']] as [SortKey,string][]).map(([k,label]) => (
                <th
                  key={k}
                  onClick={() => toggleSort(k)}
                  className={`cursor-pointer select-none px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${k === 'v' || k === 'w' || k === 's' || k === 'change' ? 'text-right' : 'text-left'}`}
                >
                  {label}<SortIcon k={k} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((r, i) => (
              <>
                <tr
                  key={r.t}
                  onClick={() => setExpanded(expanded === r.t ? null : r.t)}
                  className={`cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${i % 2 === 1 ? 'bg-gray-50/50 dark:bg-white/[0.02]' : ''}`}
                >
                  <td className="px-3 py-2 font-mono font-semibold text-gray-900 dark:text-white">{r.t}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[200px] truncate">{r.n}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-900 dark:text-white">{fmtValue(r.v)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-600 dark:text-gray-300">{r.w.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-600 dark:text-gray-300">{fmtShares(r.s)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {r.action !== 'new' && r.action !== 'cleared' && r.action !== 'unchanged' ? (
                      <span className={r.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{fmtPct(r.change)}</span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2"><ActionBadge action={r.action} change={r.change} /></td>
                </tr>
                {expanded === r.t && (
                  <tr key={r.t + '_exp'} className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={7}><Sparkline ticker={r.t} row={r} /></td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Holdings cards (mobile) ──────────────── */}
      <div className="md:hidden space-y-3">
        {filtered.map(r => (
          <div
            key={r.t}
            onClick={() => setExpanded(expanded === r.t ? null : r.t)}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-mono font-bold text-gray-900 dark:text-white">{r.t}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{r.n}</div>
              </div>
              <ActionBadge action={r.action} change={r.change} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-400">Value</div>
                <div className="font-mono font-medium text-gray-900 dark:text-white">{fmtValue(r.v)}</div>
              </div>
              <div>
                <div className="text-gray-400">Weight</div>
                <div className="font-mono font-medium text-gray-900 dark:text-white">{r.w.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-gray-400">Shares</div>
                <div className="font-mono font-medium text-gray-900 dark:text-white">{fmtShares(r.s)}</div>
              </div>
              <div>
                <div className="text-gray-400">Est. Cost → P&L</div>
                <div className="font-mono font-medium">
                  {r.entryPrice != null && r.pnlPct != null ? (
                    <>
                      <span className="text-gray-500">${r.entryPrice < 100 ? r.entryPrice.toFixed(2) : r.entryPrice.toFixed(0)}</span>
                      {' '}
                      <span className={r.pnlPct >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmtPct(r.pnlPct)}</span>
                    </>
                  ) : <span className="text-gray-400">—</span>}
                </div>
              </div>
            </div>
            {expanded === r.t && <Sparkline ticker={r.t} row={r} />}
          </div>
        ))}
      </div>
    </div>
  );
}
