import { useMemo } from 'react';
import type { Fund } from '../types';
import { researchNarrative, referenceChecks } from '../researchNarrative';
export default function ResearchNarrative({fund,quarter}:{fund:Fund;quarter:string}) {
  const report=useMemo(()=>researchNarrative(fund,quarter),[fund,quarter]);
  const checks=referenceChecks(fund,quarter);
  const source=fund.quarters[quarter].source_url;
  const previous=report.prev ? fund.quarters[report.prev].source_url : undefined;
  return <section className="report-block">
    <h3>从持仓事实到配置判断</h3>
    <p className="report-note">{report.prev || '缺少相邻季度'} → {quarter} · 下列主题为明确列出证券的研究篮子，不是全组合行业分类。</p>
    <div className="flex gap-4 text-xs mb-4">{source&&<a href={source} target="_blank" rel="noreferrer">本期 SEC 原始申报 ↗</a>}{previous&&<a href={previous} target="_blank" rel="noreferrer">前期 SEC 原始申报 ↗</a>}</div>
    <h4 className="text-sm font-semibold mb-2">1. 先看核心仓有没有变化</h4>
    {report.coreFacts.map(f=><p className="mb-2" key={f}>{f}</p>)}
    <p className="report-note">以上前三项普通证券合计 {report.topWeight.toFixed(2)}%，排除了期权及已标识本金证券；连续出现指季度末记录，不证明季内一直持有。</p>
    <div className="report-callout"><b>综合判断 · 置信度{report.complete?'中':'低'}</b><p>{report.synthesis}</p></div>
    {report.sections.map((s,i)=><section className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800" key={s.id}>
      <h4 className="text-sm font-semibold mb-3">{i+2}. {s.title}</h4>
      <p><b>事实：</b>{s.facts || '本组仅有期权记录，普通证券方向未确认。'}</p>
      <p className="mt-2"><b>规模：</b>{report.complete?'本组普通证券权重':'已收录普通证券权重'} {s.previousWeight===null?'未知':s.previousWeight.toFixed(2)+'%'} → {s.currentWeight.toFixed(2)}%。{s.previousWeight!==null?`变化 ${(s.currentWeight-s.previousWeight).toFixed(2)} 个百分点，不能视为实际净流入。`:''}</p>
      {s.options.length>0&&<p className="mt-2"><b>期权另列：</b>{s.optionFacts}。未与普通证券合成风险敞口。</p>}
      <p className="mt-3"><b>配置倾向：</b>{s.direction}。</p>
      <p className="mt-2"><b>判断 · 置信度{s.confidence}：</b>{s.confidence==='中'?s.judgment:'缺少完整可比快照，暂不采用本组投资解释；先补齐和核对数据。'}</p>
      <p className="mt-2"><b>进一步分析：</b>{s.hypothesis}</p>
      <p className="mt-2"><b>反例与替代解释：</b>{s.alternative}</p>
      <p className="mt-2"><b>后续验证：</b>{s.watch}</p>
    </section>)}
    {checks.length>0&&<details className="report-method"><summary>参考文章核对：哪些事实采用，哪些结论需要修正</summary><p className="report-note">参考材料为用户提供的持仓复盘截图。仅借鉴问题结构，以下核对以 SEC 明细和本站计算为准。</p>{checks.map(c=><p className="mt-3" key={c.claim}><b>{c.claim}：</b>{c.finding}</p>)}</details>}
  </section>;
}
