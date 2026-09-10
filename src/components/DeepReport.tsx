import { useMemo, type ReactNode } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import type { Fund } from '../types';
import { historyProfile, moves, quarterMetrics, secInstitutionUrl } from '../analysis';
import { fmtPct, fmtValue, quarterOrdinal } from '../utils';
import ActionBadge from './ActionBadge';
import ResearchNarrative from './ResearchNarrative';
import InstitutionNarrative from './InstitutionNarrative';

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <section className="report-block"><h3>{title}</h3>{note && <p className="report-note">{note}</p>}{children}</section>;
}
const percent = (n: number) => Number.isFinite(n) ? `${n.toFixed(1)}%` : '未知';
export default function DeepReport({ fund, quarter }: { fund: Fund; quarter: string }) {
  const profile = useMemo(() => historyProfile(fund, quarter), [fund, quarter]);
  const metric = quarterMetrics(fund, quarter);
  const q = fund.quarters[quarter];
  const important = moves(fund, quarter).filter(r => r.action !== 'unknown' && r.action !== 'unchanged').slice(0, 8);
  const first = profile.quarters[0];
  const gaps = Object.keys(fund.data_issues ?? {}).filter(q => quarterOrdinal(q) <= quarterOrdinal(quarter));
  const fullCount = profile.metrics.filter(m => m.complete).length;
  return <article className="deep-report" id="deep-report">
    <div className="report-hero">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2>持仓深度分析</h2><p className="report-eyebrow">{fund.name_cn} · {quarter}</p></div>
        <button className="report-print" onClick={() => window.print()}>打印 / 保存 PDF</button>
      </div>
      <p className="mt-2 text-xs leading-6 text-gray-500 dark:text-gray-400">{fund.name_en} · {first} — {quarter} · {profile.quarters.length} 个季度，其中 {fullCount} 期已核对完整申报。</p>
      {gaps.length > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">未纳入完整统计的季度：{gaps.join('、')}。追加申报存在重叠记录，待人工核对，未将缺失当作空仓。</p>}
      <div className="report-stats">
        {[['最大披露仓位', percent(metric.top1)], ['前三项合计', percent(metric.top3)], ['前十项合计', percent(metric.top10)], ['本季样本覆盖', percent(metric.coverage)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
    </div>
    <InstitutionNarrative fund={fund} quarter={quarter} />
    {fund.cik.replace(/^0+/, '') === '1536411' && <details className="report-method"><summary>专题补充：医疗、芯片、基础设施与周期配置</summary><ResearchNarrative fund={fund} quarter={quarter} /></details>}
    <Block title="持仓结构的变化" note="权重以各期完整申报市值为分母。期权为对应标的名义市值占比，不是权利金、投入比例或风险敞口；ETF 不含期权。">
      <div style={{ width: '100%', height: 220 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={profile.metrics} margin={{ top: 10, right: 12, left: -15, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="quarter" minTickGap={55} tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} /><Tooltip formatter={v => percent(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line name="前三项" type="linear" dataKey="top3" stroke="#3b82f6" dot={false} strokeWidth={2} isAnimationActive={false} /><Line name="前十项" type="linear" dataKey="top10" stroke="#22c55e" dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
      <div className="report-table-scroll"><table><thead><tr><th>季度</th><th>记录数</th><th>前三项</th><th>前十项</th><th>ETF*</th><th>CALL</th><th>PUT</th><th>覆盖市值</th></tr></thead><tbody>{profile.metrics.map(m => <tr key={m.quarter}><td>{m.quarter}</td><td>{m.count}</td><td>{percent(m.top3)}</td><td>{percent(m.top10)}</td><td>{percent(m.etf)}</td><td>{percent(m.call)}</td><td>{percent(m.put)}</td><td>{percent(m.coverage)}{!m.complete ? ' · 待核对' : ''}</td></tr>)}</tbody></table></div>
    </Block>
    <div className="report-grid">
      <Block title="反复出现的证券" note="按出现季度数排序；同一 CUSIP / 股类统计，ETF（名称识别）、期权及已标识本金证券排除。平均权重只计算出现季度。">
        <div className="report-table-scroll"><table><thead><tr><th>证券</th><th>出现季度</th><th>最长连续</th><th>平均权重</th><th>最高权重</th><th>前十次数</th></tr></thead><tbody>{profile.companies.slice(0, 10).map((c, i) => <tr key={`${c.ticker}-${i}`}><td><Link to={`/stock/${encodeURIComponent(c.ticker)}?quarter=${encodeURIComponent(quarter)}`}>{c.ticker}</Link><small>{c.name}</small></td><td>{c.seen} / {profile.quarters.length}</td><td>{c.longest} 季</td><td>{percent(c.sum / c.seen)}</td><td>{percent(c.max)}</td><td>{c.top10}</td></tr>)}</tbody></table></div>
      </Block>
      <Block title="重要仓位变化" note="按最大前后权重 × 股数变动幅度（最高取 100%）排序；新出现及退出用其披露权重。该规则用于研究排序。">
        <div className="report-table-scroll"><table><thead><tr><th>证券</th><th>股数变化</th><th>前期权重</th><th>本期权重</th></tr></thead><tbody>{important.map(r => <tr key={r.holding.t}><td><Link to={`/stock/${encodeURIComponent(r.holding.t)}?quarter=${encodeURIComponent(quarter)}`}>{r.holding.t}</Link><small>{r.holding.n}</small></td><td><ActionBadge action={r.action} change={r.change} /></td><td>{percent(r.previousWeight)}</td><td>{percent(r.weight)}</td></tr>)}</tbody></table></div>
        {!important.length && <p className="report-note">暂无可确认的相邻季度变化。</p>}
      </Block>
    </div>
    <Block title="结构变化较大的季度" note="仅比较相邻且已核对完整的季度。指标 = ½ × Σ|本季权重 − 上季权重|，包含价格变化，不能解释为真实换手率。">
      {profile.changes.length ? profile.changes.slice(0, 4).map(c => <details key={c.quarter} className="report-quarter"><summary>{c.previous} → {c.quarter}<strong>{percent(c.distance)}</strong></summary><p>{moves(fund, c.quarter).filter(r => r.action !== 'unknown' && r.action !== 'unchanged').slice(0, 5).map(r => `${r.holding.t}：${percent(r.previousWeight)} → ${percent(r.weight)}${Number.isFinite(r.change) ? `，股数 ${fmtPct(r.change)}` : ''}`).join('；') || '本期无可确认的股数变化，结构差异可能来自价格变化或待核实项目。'}</p></details>) : <p className="report-note">尚无相邻且已核对完整的季度对；不以部分名单估算。</p>}
    </Block>
    <details className="report-method"><summary>数据来源、计算方法与分析边界</summary>
      <p>交易代码由完整 CUSIP 对照 OpenFIGI 证券库，无法唯一识别的记录保留编号和发行人名称。代码为查询时的参考标签，不保证等于历史季度当时的代码；同名、不同股类不自动合并。</p>
      <p>机构申报不等于经理人个人或单只基金的全部持仓。13F 不覆盖现金、空头及完整衍生品组合，季度末持仓变化不等于基金业绩；不能单凭快照确认投资动机。ETF 识别基于名称规则，未做穿透。</p>
        <a className="report-source" href={q.source_url || secInstitutionUrl(fund)} target="_blank" rel="noreferrer">{q.source_url ? '查看本期 SEC 申报 ↗' : '前往 SEC 核查申报 ↗'}</a>
        {q.source_urls && q.source_urls.length > 1 && <p className="report-note">包含追加型修订：{q.source_urls.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer"> {i === 0 ? "原始申报" : `修订 ${i}`} ↗ </a>)}</p>}
        <p className="report-note">{q.provider || '历史快照：原始申报链接尚未补齐'}{q.value_unit_inferred ? ' · 金额单位由每股市值推断，美元金额待独立核验；权重不受倍数影响' : ''} · 披露日 {q.filing_date || '待补充'}{q.warnings?.length ? ` · ${q.warnings.join('；')}` : ''}</p>

      <p>申报市值 {fmtValue(q.total)}；数据源 {q.provider || 'SEC 历史快照'}。股数为原始披露数，未统一拆股复权；可能的拆股异常、证券类型变化及不完整名单的缺失项标为待核实。权重变化单位为百分点。历史季度选择会截断其后的数据，不使用未来持仓。</p>
      <p>报告由确定性计算生成，不伪装成 AI 已核实的投资意见。OpenBB 仅承担数据解析；来源失败或申报修订未完成时保留旧快照并标示缺口。</p>
    </details>
  </article>;
}
