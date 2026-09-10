import type { Action, Data, Fund, Holding } from './types.ts';
import { comparablePrevious, coverage, fmtPct, fmtValue, getAction, getQuarterKeys, getShareChange, inferSector, isComplete, quarterOrdinal } from './utils.ts';

export interface Insight {
  id: string; icon: string; tag: string; tagColor: string; title: string;
  body: string; details: string[]; signal: 'neutral' | 'divergent';
}
export interface Move {
  holding: Holding; action: Action; change: number; previousWeight: number;
  weight: number; weightDelta: number; importance: number;
}
export const actionNames: Record<Action, string> = {
  new: '新出现', increased: '披露股数增加', decreased: '披露股数减少',
  cleared: '本期未持有', unchanged: '披露股数不变', unknown: '待核实',
};
export function moves(fund: Fund, quarter: string): Move[] {
  const prevQ = comparablePrevious(fund, quarter);
  const current = new Map((fund.quarters[quarter]?.holdings ?? []).map(h => [h.t, h]));
  const previous = new Map((prevQ ? fund.quarters[prevQ].holdings : []).map(h => [h.t, h]));
  return [...new Set([...current.keys(), ...previous.keys()])].map(t => {
    const c = current.get(t), p = previous.get(t);
    const action = getAction(fund, t, quarter);
    // Missing rows in partial snapshots have unknown weight, not zero.
    const currentKnown = !!c || isComplete(fund.quarters[quarter]);
    const previousKnown = !!p || (!!prevQ && isComplete(fund.quarters[prevQ]));
    const weight = currentKnown ? c?.w ?? 0 : NaN;
    const previousWeight = previousKnown ? p?.w ?? 0 : NaN;
    const change = getShareChange(fund, t, quarter);
    const scale = Math.max(c?.w ?? 0, p?.w ?? 0);
    // Explicit research-ranking heuristic, not cash flow or conviction.
    const importance = action === 'new' || action === 'cleared' ? scale
      : Number.isFinite(change) ? scale * Math.min(Math.abs(change) / 100, 1) : 0;
    return { holding: (c ?? p)!, action, change, weight, previousWeight, weightDelta: weight - previousWeight, importance };
  }).sort((a, b) => b.importance - a.importance || (b.holding.v - a.holding.v));
}
export function positionLine(fund: Fund, label: string, ticker: string, quarter: string): string | null {
  const row = moves(fund, quarter).find(r => r.holding.t === ticker);
  return row ? `${label}：${ticker} · ${actionNames[row.action]} · ${row.holding.w.toFixed(1)}%` : null;
}
export function topMoves(fund: Fund, quarter: string, type: Action, limit = 4): string {
  return moves(fund, quarter).filter(r => r.action === type).slice(0, limit).map(r => r.holding.t).join('、') || '无';
}
export function quarterMetrics(fund: Fund, quarter: string) {
  const q = fund.quarters[quarter];
  const rows = [...q.holdings].sort((a, b) => b.v - a.v);
  const weight = (n: number) => rows.slice(0, n).reduce((sum, h) => sum + h.w, 0);
  return {
    quarter, count: rows.length, complete: isComplete(q), coverage: coverage(q),
    top1: weight(1), top3: weight(3), top10: weight(10),
    etf: rows.filter(h => !h.o && inferSector(h.n) === 'ETF/Index').reduce((s, h) => s + h.w, 0),
    call: rows.filter(h => h.o === 'CALL').reduce((s, h) => s + h.w, 0),
    put: rows.filter(h => h.o === 'PUT').reduce((s, h) => s + h.w, 0),
  };
}
export function weightDistance(fund: Fund, quarter: string): number | null {
  const prevQ = comparablePrevious(fund, quarter);
  if (!prevQ || !isComplete(fund.quarters[quarter]) || !isComplete(fund.quarters[prevQ]) || fund.quarters[quarter].warnings?.length || fund.quarters[prevQ].warnings?.length) return null;
  return moves(fund, quarter).reduce((s, r) => s + Math.abs(r.weightDelta), 0) / 2;
}
export function historyProfile(fund: Fund, through: string) {
  const quarters = getQuarterKeys(fund).filter(q => quarterOrdinal(q) <= quarterOrdinal(through));
  const metrics = quarters.map(q => quarterMetrics(fund, q));
  const companies = new Map<string, { ticker: string; name: string; seen: number; sum: number; max: number; top10: number; first: string; last: string; longest: number; streak: number }>();
  for (const q of quarters) {
    const ranked = [...fund.quarters[q].holdings].sort((a, b) => b.v - a.v);
    for (const [i, h] of ranked.entries()) {
      if (h.o || h.security_type === 'PRN' || inferSector(h.n) === 'ETF/Index') continue;
      const key = h.cusip ? `${h.cusip}:${h.asset_class ?? ''}` : h.t;
      const c = companies.get(key) ?? { ticker: h.t, name: h.n, seen: 0, sum: 0, max: 0, top10: 0, first: q, last: q, longest: 0, streak: 0 };
      c.streak = c.seen > 0 && quarterOrdinal(q) - quarterOrdinal(c.last) === 1 ? c.streak + 1 : 1;
      c.longest = Math.max(c.longest, c.streak);
      c.seen++; c.sum += h.w; c.max = Math.max(c.max, h.w); c.top10 += i < 10 ? 1 : 0; c.last = q;
      companies.set(key, c);
    }
  }
  return { quarters, metrics, companies: [...companies.values()].sort((a, b) => b.seen - a.seen || b.sum - a.sum),
    changes: quarters.map(q => ({ quarter: q, previous: comparablePrevious(fund, q), distance: weightDistance(fund, q) }))
      .filter((r): r is { quarter: string; previous: string; distance: number } => r.distance !== null && !!r.previous)
      .sort((a, b) => b.distance - a.distance) };
}
export function generateFundAnalysis(fund: Fund, selected?: string) {
  const keys = getQuarterKeys(fund);
  const latestQ = selected ?? keys[keys.length - 1];
  if (!fund.quarters[latestQ]) return null;
  const prevQ = comparablePrevious(fund, latestQ);
  const rows = moves(fund, latestQ);
  const counts: Record<Action, number> = { new: 0, increased: 0, decreased: 0, cleared: 0, unchanged: 0, unknown: 0 };
  for (const r of rows) counts[r.action]++;
  const metric = quarterMetrics(fund, latestQ);
  const lead = rows.find(r => r.action !== 'unknown' && r.action !== 'unchanged');
  const top = [...fund.quarters[latestQ].holdings].sort((a, b) => b.v - a.v)[0];
  const distance = weightDistance(fund, latestQ);
  const signal: Insight['signal'] = counts.new + counts.increased > 0 && counts.decreased + counts.cleared > 0 ? 'divergent' : 'neutral';
  return {
    latestQ, prevQ, counts, signal,
    title: lead ? `${fund.name_cn}：${lead.holding.t} ${actionNames[lead.action]}` : `${fund.name_cn}：持仓快照`,
    body: `已记录 ${metric.count} 项证券，覆盖申报市值 ${metric.coverage.toFixed(1)}%。${top ? `最大披露仓位 ${top.t}，权重 ${top.w.toFixed(1)}%；前三项合计 ${metric.top3.toFixed(1)}%。` : ''}`,
    details: [
      `事实｜${prevQ ? `${prevQ} → ${latestQ}` : '无相邻前季'}：新出现 ${counts.new}、股数增加 ${counts.increased}、股数减少 ${counts.decreased}、本期未持有 ${counts.cleared}、待核实 ${counts.unknown}。`,
      lead ? `重点｜${lead.holding.t} ${actionNames[lead.action]}${Number.isFinite(lead.change) ? ` ${fmtPct(lead.change)}` : ''}；权重 ${Number.isFinite(lead.previousWeight) ? lead.previousWeight.toFixed(2) : '未知'}% → ${Number.isFinite(lead.weight) ? lead.weight.toFixed(2) : '未知'}%。权重变化同时受价格和组合分母影响。` : '重点｜没有足够可比数据支持动作排序。',
      `结构｜${distance === null ? '缺少可比完整快照，暂不计算组合权重变动。' : `组合权重变动指标 ${distance.toFixed(1)}%，表示季度末结构差异，不是真实换手率。`}`,
      '解释｜持仓变化提供配置线索，不能单独证明经理人的动机、风险偏好或对公司的信心。机构申报也不等于某位个人的完整投资组合。',
      '后续观察｜核查公司行动和修订申报；观察下一季度是否延续变化，并结合经营数据验证。披露股数尚未统一拆股复权，不能还原真实交易。',
    ],
  };
}
export function generateMarketInsights(data: Data, quarter?: string): Insight[] {
  return Object.entries(data.funds).flatMap(([id, fund]) => {
    const a = generateFundAnalysis(fund, quarter);
    return a ? [{ id, icon: '↗', tag: a.latestQ, tagColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', ...a }] : [];
  });
}
export function notableMoves(data: Data, quarter: string) {
  return Object.entries(data.funds).flatMap(([id, fund]) => fund.quarters[quarter] ? moves(fund, quarter)
    .filter(r => r.action !== 'unknown' && r.action !== 'unchanged' && !r.holding.o)
    .map(r => ({ ...r, fundId: id, fundName: fund.name_cn })) : [])
    .sort((a, b) => b.importance - a.importance).slice(0, 8);
}
export function secInstitutionUrl(fund: Fund): string {
  return `https://www.sec.gov/edgar/browse/?CIK=${fund.cik}&owner=exclude`;
}
export function reportedValue(fund: Fund, quarter: string) { return fmtValue(fund.quarters[quarter].total); }
