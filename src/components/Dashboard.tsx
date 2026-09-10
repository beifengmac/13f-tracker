import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import rawData from '../data.json';
import type { Data } from '../types';
import { fmtPct, fmtValue, getAllQuarterKeys } from '../utils';
import { notableMoves, quarterMetrics, weightDistance, moves } from '../analysis';
import MarketInsights from './MarketInsights';
import ActionBadge from './ActionBadge';
const data = rawData as Data;
export default function Dashboard() {
  const quarters = getAllQuarterKeys(data.funds);
  const [quarter, setQuarter] = useState(quarters.at(-1)!);
  const [search, setSearch] = useState('');
  const important = useMemo(() => notableMoves(data, quarter), [quarter]);
  const funds = Object.entries(data.funds).filter(([, f]) => f.quarters[quarter]);
  return <div>
    <header className="mb-7 rounded-2xl bg-slate-900 p-6 sm:p-8 text-white">
      <p className="text-xs tracking-widest text-emerald-300">INSTITUTIONAL RESEARCH</p>
      <h1 className="mt-3 text-3xl font-semibold">看懂持仓变化，找到研究线索。</h1>
      <p className="mt-3 text-sm text-slate-300 leading-7">从季度动作走向历史证据。关注仓位大小、连续性与机构分歧，保留尚未证实的部分。</p>
      <div className="mt-5 flex flex-wrap gap-3 items-center">
        <select aria-label="报告季度" value={quarter} onChange={e => setQuarter(e.target.value)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm">{quarters.map(q => <option key={q}>{q}</option>)}</select>
        <span className="text-xs text-slate-300">已收录 {funds.length} / {Object.keys(data.funds).length} 家 · 数据更新 {data.generated}</span>
        <Link className="ml-auto rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800" to="/fund/duquesne">Stanley 深度报告 →</Link>
      </div>
    </header>
    <section className="mb-8">
      <h2 className="text-lg font-semibold">本季值得研究的变化</h2>
      <p className="my-2 text-xs text-gray-500">按仓位大小与披露股数变动幅度综合排序，仅含非期权证券。部分名单的缺失项不判为清仓。</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {important.map(r => <Link key={`${r.fundId}-${r.holding.t}`} to={`/fund/${r.fundId}?quarter=${encodeURIComponent(quarter)}`} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 hover:border-emerald-500">
          <div className="text-xs text-gray-500">{r.fundName}</div><div className="flex flex-wrap items-center justify-between gap-2 mt-3"><strong className="text-lg">{r.holding.t}</strong><ActionBadge action={r.action} /></div>
          <p className="mt-3 text-xs text-gray-500">权重 {Number.isFinite(r.previousWeight) ? r.previousWeight.toFixed(1) : '未知'}% → {Number.isFinite(r.weight) ? r.weight.toFixed(1) : '未知'}%</p>
          <p className="mt-1 text-xs text-gray-500">披露股数变化 {fmtPct(r.change)}</p>
        </Link>)}
      </div>
      {!important.length && <p className="py-5 text-sm text-gray-500">本期缺少可比的相邻季度数据，暂不生成动作排行。</p>}
    </section>
    <div className="flex flex-wrap justify-between gap-3 mb-4"><h2 className="text-lg font-semibold">机构研究档案</h2><input aria-label="搜索机构" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索机构 / 管理人" className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" /></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {funds.filter(([, f]) => `${f.name_cn} ${f.name_en} ${f.manager} ${f.manager_en}`.toLowerCase().includes(search.toLowerCase())).map(([id, f]) => {
        const m = quarterMetrics(f, quarter), distance = weightDistance(f, quarter);
        const changes = moves(f, quarter).filter(r => r.action !== 'unknown' && r.action !== 'unchanged').slice(0, 2);
        return <Link key={id} to={`/fund/${id}?quarter=${encodeURIComponent(quarter)}`} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 hover:border-emerald-500">
          <h3 className="font-semibold">{f.name_cn}</h3><p className="mt-1 text-xs text-gray-500">{f.name_en}</p>
          <p className="mt-4 font-mono text-2xl font-semibold">{fmtValue(f.quarters[quarter].total)}</p><p className="text-[11px] text-gray-500">13F 申报市值 · 非管理资产总额{f.quarters[quarter].value_unit_inferred ? ' · 金额单位待核验' : ''}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500"><span>已记录 {m.count} 项</span><span>覆盖 {m.coverage.toFixed(1)}%</span><span>Top 3 {m.top3.toFixed(1)}%</span></div>
          <p className="mt-2 text-xs text-gray-500">权重变动指标 {distance === null ? '待核对' : distance.toFixed(1) + '%'} · 非换手率</p>
          <div className="mt-4 flex flex-wrap gap-2">{changes.map(r => <span key={r.holding.t} className="flex items-center gap-1 text-xs"><span>{r.holding.t}</span><ActionBadge action={r.action} compact /></span>)}</div>
          <p className="mt-4 text-xs text-emerald-700 dark:text-emerald-400">一页结论 · 历史证据 →</p>
        </Link>;
      })}
    </div>
    <MarketInsights quarter={quarter} />
  </div>;
}
