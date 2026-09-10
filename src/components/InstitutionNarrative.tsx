import { useMemo } from 'react';
import type { Fund } from '../types';
import { institutionNarrative } from '../institutionNarrative';
export default function InstitutionNarrative({fund,quarter}:{fund:Fund;quarter:string}) {
  const report=useMemo(()=>institutionNarrative(fund,quarter),[fund,quarter]);
  const q=fund.quarters[quarter];
  return <section className="report-block" data-institution-report>
    <h3>{fund.name_cn}：本季配置分析</h3>
    <p className="report-note">{report.prev || '缺少相邻季度'} → {quarter} · 根据本机构持仓选择重点证券，新增与减持各列重要性靠前的三项；普通证券排除期权与本金证券。</p>
    <div className="report-callout"><b>综合判断 · {report.complete?'基于完整相邻快照':'数据不足，暂不判断调整方向'}</b><p>{report.summary}</p></div>
    <div className="flex flex-wrap gap-4 text-xs my-4">{q.source_url&&<a href={q.source_url} target="_blank" rel="noreferrer">本期 SEC 申报 ↗</a>}{report.prev&&fund.quarters[report.prev].source_url&&<a href={fund.quarters[report.prev].source_url} target="_blank" rel="noreferrer">前期 SEC 申报 ↗</a>}</div>
    {report.sections.map((s,i)=><section className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800" key={s.id} data-analysis-section={s.id}>
      <h4 className="text-sm font-semibold mb-3">{i+1}. {s.title}</h4>
      {s.facts.length>0&&<ul className="report-bullets">{s.facts.map(f=><li key={f}>{f}</li>)}</ul>}
      <p className="mt-3"><b>{report.complete?'分析判断':'样本观察'}：</b>{s.judgment}</p>
      <p className="mt-2"><b>后续验证：</b>{s.watch}</p>
    </section>)}
  </section>;
}
