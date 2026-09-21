import { Fragment, useState, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

import rawData from '../data.json';
import type { Data, Holding, Action, SortKey, SortDir } from '../types';
import { fmtValue, fmtShares, fmtPct, getQuarterKeys, comparablePrevious, getAction, getShareChange, mergeGoogleClasses, inferSector, tickerStatusLabel, securityTypeLabel } from '../utils';
import { generateFundAnalysis } from '../analysis';
import DeepReport from './DeepReport';
import ActionBadge from './ActionBadge';

const data = rawData as unknown as Data;

const ACTION_ORDER: Record<Action, number> = { new: 0, increased: 1, unchanged: 2, decreased: 3, cleared: 4, unknown: 5 };
const SECTOR_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#64748b'];

interface Row extends Holding {
  sector: string;
  action: Action;
  change: number;

}

export default function FundDetail() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const fund = id ? data.funds[id] : undefined;

  const quarters = useMemo(() => (fund ? getQuarterKeys(fund) : []), [fund]);
  const selectedQ = quarters.includes(params.get('quarter') ?? '') ? params.get('quarter')! : quarters.at(-1) ?? '';
  const setSelectedQ = (q: string) => setParams({ quarter: q });
  const [sortKey, setSortKey] = useState<SortKey>('v');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterAction, setFilterAction] = useState<'all' | Action>('all');
  const [visibleRows, setVisibleRows] = useState(100);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!fund || !fund.quarters[selectedQ]) return [];
    const current = mergeGoogleClasses(fund.quarters[selectedQ].holdings);
    const prevQ = comparablePrevious(fund, selectedQ);
    const previous = prevQ ? mergeGoogleClasses(fund.quarters[prevQ]?.holdings ?? []) : [];
    const currentTickers = new Set(current.map(h => h.t));
    const cleared = previous
      .filter(h => !currentTickers.has(h.t) && getAction(fund, h.t, selectedQ) === 'cleared')
      .map(h => ({ ...h, v: 0, s: 0, w: 0 }));

    return [...current, ...cleared].map((h): Row => {
      const action = getAction(fund, h.t, selectedQ);
      return {
        ...h,
        sector: inferSector(h.n),
        action,
        change: action === 'cleared' ? -100 : getShareChange(fund, h.t, selectedQ),

      };
    });
  }, [fund, selectedQ]);

  const filtered = useMemo(() => {
    const currentRows = rows.filter(r => r.action !== 'cleared');
    let list = filterAction === 'all' ? currentRows : rows.filter(r => r.action === filterAction);
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 't': cmp = a.t.localeCompare(b.t); break;
        case 'n': cmp = a.n.localeCompare(b.n); break;
        case 'sector': cmp = a.sector.localeCompare(b.sector); break;
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
    return quarters.slice(0, quarters.indexOf(selectedQ) + 1).map(q => ({ quarter: q, value: fund.quarters[q]?.total ?? 0 }));
  }, [fund, quarters, selectedQ]);

  const sectorData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows.filter(row => row.action !== 'cleared')) {
      map.set(r.sector, (map.get(r.sector) ?? 0) + r.w);
    }
    return [...map.entries()]
      .map(([name, weight]) => ({ name, weight: +weight.toFixed(2) }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [rows]);

  const quarterSummary = useMemo(() => {
    if (!fund || !fund.quarters[selectedQ]) {
      return { prevQ: null, prevTotal: null, aumDelta: 0, aumChange: null, buyValue: 0, sellValue: 0, netValue: 0 };
    }

    const prevQ = comparablePrevious(fund, selectedQ);
    if (!prevQ) {
      return { prevQ: null, prevTotal: null, aumDelta: 0, aumChange: null, buyValue: 0, sellValue: 0, netValue: 0 };
    }

    const prevTotal = fund.quarters[prevQ]?.total ?? 0;
    const currentTotal = fund.quarters[selectedQ]?.total ?? 0;
    const aumDelta = currentTotal - prevTotal;
    const aumChange = prevTotal > 0 ? (aumDelta / prevTotal) * 100 : null;

    return { prevQ, prevTotal, aumDelta, aumChange };
  }, [fund, selectedQ]);

  /* ── Sort handler ────────────────────────────── */

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 't' || key === 'n' || key === 'sector' ? 'asc' : 'desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-0.5 text-[10px] text-gray-400">{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
  );

  const actionCounts = useMemo(() => {
    const m: Record<string, number> = { all: rows.filter(r => r.action !== 'cleared').length };
    for (const r of rows) m[r.action] = (m[r.action] ?? 0) + 1;
    return m;
  }, [rows]);

  /* ── Sparkline for expanded row ──────────────── */

  const Sparkline = ({ ticker }: { ticker: string; row: Row }) => {
    const sparkData = quarters.slice(0, quarters.indexOf(selectedQ) + 1).map(q => {
      const h = mergeGoogleClasses(fund!.quarters[q]?.holdings ?? []).find(x => x.t === ticker);
      return { q, v: h?.v ?? 0, s: h?.s ?? 0 };
    });
    return (
      <div className="py-3 px-4">
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
  const currentHoldingCount = rows.filter(r => r.action !== 'cleared').length;
  const concentration = rows.slice(0, 10).reduce((s, r) => s + r.w, 0);
  const totalPositions = q?.total_positions ?? currentHoldingCount;
  const isAumUp = quarterSummary.aumDelta >= 0;
  const fundAnalysis = fund ? generateFundAnalysis(fund, selectedQ) : null;

  /* ── Action filter tabs ──────────────────────── */

  const TABS: { key: 'all' | Action; label: string }[] = [
    { key: 'all', label: '当前持仓' },
    { key: 'new', label: '新建' },
    { key: 'increased', label: '加仓' },
    { key: 'decreased', label: '减仓' },
    { key: 'cleared', label: '清仓' },
    { key: 'unknown', label: '待核实' },
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
            <p className="mt-1 text-xs text-gray-400">机构申报口径；不代表关联人物的全部个人持仓。</p>
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
            {q?.value_unit_inferred && <p className="text-xs text-amber-600">金额单位为推断值，待独立核验</p>}
            <div className="mt-1 flex items-center justify-end gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>📈 {totalPositions} positions</span>
              <span>🎯 Top‑10: {concentration.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">证券代码已核对 {q.holdings.filter(h=>h.ticker_status==='resolved').length} / {q.holdings.length} 条 · 未匹配项保留证券编号和公司名，持仓仍计入统计。债券显示完整债券代码，数量为申报本金。</p>
      </header>

      <details className="deep-report-shell mb-6 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">持仓深度分析 · 历史趋势与证据</summary><DeepReport fund={fund} quarter={selectedQ} /></details>

      {/* Quarter summary */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">本季度总结</h2>
          <span className="text-[11px] text-gray-400">
            {quarterSummary.prevQ ? `${quarterSummary.prevQ} → ${selectedQ} · 申报市值变化，不代表投资收益` : `${selectedQ} · 无上一季度对比`}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs text-gray-500 dark:text-gray-400">13F 申报市值变化（非收益）</div>
            <div className={`mt-1 font-mono text-xl font-bold ${isAumUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {isAumUp ? '+' : '-'}{fmtValue(Math.abs(quarterSummary.aumDelta))}
            </div>
            <div className="mt-1 text-xs text-gray-400">{quarterSummary.aumChange == null ? '—' : fmtPct(quarterSummary.aumChange)}</div>
          </div>

        </div>
      </section>

      {fundAnalysis && selectedQ === fundAnalysis.latestQ && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">本季证据摘要</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fundAnalysis.prevQ} → {fundAnalysis.latestQ} · 按持股数变化自动生成</p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
              <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">新建 {fundAnalysis.counts.new}</span>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">加仓 {fundAnalysis.counts.increased}</span>
              <span className="rounded-md bg-red-50 px-2 py-1 text-red-700 dark:bg-red-900/30 dark:text-red-300">减仓 {fundAnalysis.counts.decreased}</span>
              <span className="rounded-md bg-orange-50 px-2 py-1 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">清仓 {fundAnalysis.counts.cleared}</span>
            </div>
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{fundAnalysis.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{fundAnalysis.body}</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
            {fundAnalysis.details.map(detail => (
              <li key={detail} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">{detail}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Charts row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* AUM trend */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">13F 申报市值历史</h3>
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
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">样本行业分布（名称推断）</h3>
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

      {/* Holdings filters */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
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
        <p className="mb-2 text-xs text-gray-400">当前显示前 {currentHoldingCount} 大持仓 (共 {totalPositions} 只)</p>
      )}

      {filtered.length > visibleRows && <button className="mb-3 rounded-lg border px-3 py-2 text-xs" onClick={() => setVisibleRows(n => n + 100)}>再显示 100 条（已显示 {visibleRows} / {filtered.length}）</button>}
      {/* ── Holdings table (desktop) ─────────────── */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {filterAction === 'cleared' ? '已清仓证券' : '当前持仓证券'}
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {filterAction === 'cleared'
              ? `显示 ${selectedQ} 相比上一季度已经退出的证券`
              : `显示 ${selectedQ} 这家机构当前仍持有的证券`}
          </p>
        </div>
        <span className="text-xs text-gray-400">当前列表 {filtered.length} 只</span>
      </div>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80">
            <tr>
              {([['t','Ticker'],['n','Name'],['sector','分类'],['v','Value'],['w','Weight%'],['s','股数 / 本金'],['change','Change%'],['action','Action']] as [SortKey,string][]).map(([k,label]) => (
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
            {filtered.slice(0, visibleRows).map((r, i) => (
              <Fragment key={r.t}>
                <tr
                  onClick={() => setExpanded(expanded === r.t ? null : r.t)}
                  className={`cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${i % 2 === 1 ? 'bg-gray-50/50 dark:bg-white/[0.02]' : ''}`}
                >
                  <td className="px-3 py-2 font-mono font-semibold text-gray-900 dark:text-white">{r.t}{securityTypeLabel(r) && <small className="block font-sans text-xs font-normal text-blue-500">{securityTypeLabel(r)} · CUSIP {r.cusip}</small>}{tickerStatusLabel(r.ticker_status)&&<small className="block font-sans font-normal text-gray-400">{tickerStatusLabel(r.ticker_status)}</small>}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[200px] truncate">{r.n}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{r.sector}</span>
                  </td>
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
                    <td colSpan={8}><Sparkline ticker={r.t} row={r} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Holdings cards (mobile) ──────────────── */}
      <div className="md:hidden space-y-3">
        {filtered.slice(0, visibleRows).map(r => (
          <div
            key={r.t}
            onClick={() => setExpanded(expanded === r.t ? null : r.t)}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-mono font-bold text-gray-900 dark:text-white">{r.t}{securityTypeLabel(r) && <small className="block font-sans text-xs font-normal text-blue-500">{securityTypeLabel(r)} · CUSIP {r.cusip}</small>}{tickerStatusLabel(r.ticker_status)&&<small className="ml-2 font-sans font-normal text-gray-400">{tickerStatusLabel(r.ticker_status)}</small>}</div>
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
                <div className="text-gray-400">分类</div>
                <div className="font-medium text-gray-700 dark:text-gray-200">{r.sector}</div>
              </div>
              <div>
                <div className="text-gray-400">Weight</div>
                <div className="font-mono font-medium text-gray-900 dark:text-white">{r.w.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-gray-400">{r.security_type === 'PRN' ? '债券本金' : 'Shares'}</div>
                <div className="font-mono font-medium text-gray-900 dark:text-white">{fmtShares(r.s)}</div>
              </div>

            </div>
            {expanded === r.t && <Sparkline ticker={r.t} row={r} />}
          </div>
        ))}
      </div>
    </div>
  );
}
