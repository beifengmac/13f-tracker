import { Link } from 'react-router-dom';
import type { Fund } from '../types';
import { getQuarterKeys } from '../utils';

export default function FilingNotice({ id, fund, quarter, compact = false }: { id: string; fund: Fund; quarter: string; compact?: boolean }) {
  const notice = fund.notices![quarter];
  const history = getQuarterKeys(fund).filter(q => Number(q.split(' ')[1]) * 4 + Number(q[1]) < Number(quarter.split(' ')[1]) * 4 + Number(quarter[1])).reverse();
  return <section className="rounded-xl border border-amber-200 bg-white p-5 dark:border-amber-800 dark:bg-gray-900">
    <h2 className="font-bold text-gray-900 dark:text-white">{fund.name_cn}</h2>
    <p className="mt-1 text-xs text-gray-500">{fund.name_en} · {fund.manager}</p>
    <p className="mt-4 font-semibold text-amber-700 dark:text-amber-400">{quarter} · 由其他机构申报</p>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">本季提交 {notice.form} 通知，未单独提供持仓明细。这不代表清仓，不计算本季买卖变动。</p>
    <ul className="my-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">{notice.reporting_managers.map(m => <li key={m.file_number || m.name}>{m.name}{!compact && <span className="text-xs text-gray-400"> · 13F 编号 {m.file_number}</span>}</li>)}</ul>
    {!compact && <p className="mb-3 text-sm text-gray-500">以上机构的全部持仓不能直接视为橡树资本或关联人物的持仓。</p>}
    <p className="text-xs text-gray-400">报告期末 {notice.period_ending} · 提交日期 {notice.filing_date}</p>
    <div className="mt-3 flex flex-wrap gap-3 text-sm text-blue-500">
      <a href={notice.source_url} target="_blank" rel="noreferrer">SEC 原始申报 ↗</a>
      {compact && <Link to={`/fund/${id}?quarter=${encodeURIComponent(quarter)}`}>查看通知</Link>}
      {(compact ? history.slice(0, 1) : history).map(q => <Link key={q} to={`/fund/${id}?quarter=${encodeURIComponent(q)}`}>查看 {q} 持仓</Link>)}
    </div>
  </section>;
}
