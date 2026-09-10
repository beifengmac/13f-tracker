import type { Fund } from './types.ts';
import { actionNames, historyProfile, moves, quarterMetrics, type Move } from './analysis.ts';
import { comparablePrevious, fmtPct, isComplete } from './utils.ts';

const pct = (n: number) => Number.isFinite(n) ? `${n.toFixed(2)}%` : '未知';
const name = (r: Move) => `${r.holding.n}（${r.holding.t}）`;
export function institutionNarrative(fund: Fund, quarter: string) {
  const q = fund.quarters[quarter], prev = comparablePrevious(fund, quarter);
  const complete = !!prev && isComplete(q) && isComplete(fund.quarters[prev]) && !q.warnings?.length && !fund.quarters[prev].warnings?.length;
  const rows = moves(fund, quarter);
  const ordinary = rows.filter(r => !r.holding.o && r.holding.security_type !== 'PRN');
  const core = ordinary.filter(r => r.weight > 0).sort((a,b) => b.weight-a.weight).slice(0,5);
  const additions = ordinary.filter(r => ['new','increased'].includes(r.action)).slice(0,3);
  const reductions = ordinary.filter(r => ['cleared','decreased'].includes(r.action)).slice(0,3);
  const stable = ordinary.filter(r => r.action === 'unchanged').sort((a,b)=>b.weight-a.weight).slice(0,3);
  const options = rows.filter(r=>r.holding.o).slice(0,3);
  const metric = quarterMetrics(fund,quarter), before = prev ? quarterMetrics(fund,prev) : null;
  const profile = historyProfile(fund,quarter);
  const history = profile.companies.slice(0,3);
  const detail = (r:Move) => {
    const current = q.holdings.find(h=>h.t===r.holding.t);
    const previous = prev ? fund.quarters[prev].holdings.find(h=>h.t===r.holding.t) : undefined;
    const shares = (h: typeof current, known: boolean) => h ? h.s.toLocaleString('en-US') : known ? '0' : '未知';
    return `${name(r)}：${actionNames[r.action]}${Number.isFinite(r.change)?` ${fmtPct(r.change)}`:''}；披露数量 ${shares(previous,complete)} → ${shares(current,complete)}，权重 ${pct(r.previousWeight)} → ${pct(r.weight)}。`;
  };
  const interpretation = (r:Move) => {
    if (r.action === 'unknown') return `${r.holding.t} 的相邻记录暂不可确认，暂不判断主动调整。`;
    if (r.action === 'new') return `${r.holding.t} 本期新出现，占 ${pct(r.weight)}；其规模相当于本期最大普通证券仓位的 ${core[0] ? (r.weight/core[0].weight*100).toFixed(1) : '0'}%，应据此判断新配置的量级。`;
    if (r.action === 'cleared') return `${r.holding.t} 从前期 ${pct(r.previousWeight)} 降至本期未出现，构成本组明确的退出记录；无法由季末快照判断卖出价格。`;
    if (r.action === 'unchanged') return `${r.holding.t} 数量不变而权重${r.weight > r.previousWeight?'提高':r.weight < r.previousWeight?'下降':'不变'}，${r.weight!==r.previousWeight?'应优先检查相对价格和组合分母变化，不能称为主动加减仓。':'两期配置数量延续。'}`;
    const aligned = r.action === 'increased' ? r.weight > r.previousWeight : r.weight < r.previousWeight;
    return `${r.holding.t} 的数量与权重${aligned?'同向变化，支持其在披露组合中的配置'+(r.action==='increased'?'扩大':'收缩')+'。':'变化不一致，数量调整尚不能直接翻译为组合占比的同向变化。'}`;
  };
  const concentration = complete && before ? `前十项权重从 ${pct(before.top10)} 变为 ${pct(metric.top10)}，变化 ${(metric.top10-before.top10).toFixed(2)} 个百分点；前十项在季末披露组合中的比重${metric.top10>before.top10?'上升':metric.top10<before.top10?'下降':'不变'}。` : `本期已收录前十项权重 ${pct(metric.top10)}，缺少完整可比快照，暂不判断集中度方向。`;
  const summary = `${fund.name_cn}本期已收录 ${q.holdings.length} 项证券，最大普通证券为 ${core[0]?name(core[0]):'暂无记录'}（${pct(core[0]?.weight ?? 0)}）。${concentration}${complete ? `普通证券中，${additions[0]?`${additions[0].holding.t} 是按变化重要性排序的首项新增或增持`:'未确认新增或增持'}；${reductions[0]?`${reductions[0].holding.t} 是首项减持或退出`:'未确认减持或退出'}。` : ''}`;
  const empty = complete ? '本期没有符合这一类别的可确认动作。' : '缺少完整可比快照，本期不据缺失名单推断动作。';
  return { complete, prev, summary, historyCount:profile.quarters.length, sections:[
    {id:'core',title:`核心配置：${core.slice(0,3).map(r=>r.holding.t).join('、') || '暂无记录'}`,facts:core.map(detail),judgment:concentration,watch:core.length?`下期先看 ${core.slice(0,3).map(r=>r.holding.t).join('、')} 的数量是否延续当前方向，再看前十项权重是否继续变化。`:'补齐持仓记录。'},
    {id:'adds',title:`新增与增持：${additions.map(r=>r.holding.t).join('、') || '暂无确认动作'}`,facts:additions.map(detail),judgment:additions.map(interpretation).join(' ') || empty,watch:additions.length?`跟踪 ${additions.map(r=>r.holding.t).join('、')} 下一期是否保留或继续增加；新出现也可能是阶段性配置，需用后续持仓和公司经营证据区分。`:'数据更新后再次检查新增和增持记录。'},
    {id:'cuts',title:`减持与退出：${reductions.map(r=>r.holding.t).join('、') || '暂无确认动作'}`,facts:reductions.map(detail),judgment:reductions.map(interpretation).join(' ') || empty,watch:reductions.length?`检查 ${reductions.map(r=>r.holding.t).join('、')} 后续是否继续收缩或重新出现；退出不等于确认看空，仍需区分估值、再平衡与公司行动。`:'未观察到减持不代表机构没有其他风险对冲。'},
    {id:'stable',title:'未动的持仓：区分数量延续与权重漂移',facts:stable.map(detail),judgment:stable.map(interpretation).join(' ') || (complete?'本期未识别出数量不变的普通证券记录。':empty),watch:stable.length?`对 ${stable.map(r=>r.holding.t).join('、')}，优先观察股数何时发生变化；当前不把权重漂移认定为交易信号。`:'下一期继续比较相同证券身份的披露数量。'},
    {id:'options',title:'期权表达：与普通证券分开观察',facts:options.map(detail),judgment:`本期 CALL 名义市值权重 ${pct(metric.call)}，PUT ${pct(metric.put)}。${complete && before?`前期分别为 ${pct(before.call)} 和 ${pct(before.put)}。`:''}${options.length?'这些记录提示另有期权表达；因缺少行权价、期限和完整对冲，不能合并推导净看多或净看空。':'本期已收录名单中没有期权记录；不据此推断完整组合没有衍生品。'}`,watch:options.length?`分别跟踪 ${options.map(r=>r.holding.t).join('、')} 的对应股数；13F 名义市值不代表支付的权利金。`:'后续有新期权记录时再单列分析。'},
    {id:'history',title:`历史延续性：基于 ${profile.quarters.length} 个已取得季度`,facts:history.map(h=>`${h.name}（${h.ticker}）：出现 ${h.seen}/${profile.quarters.length} 期，最长连续 ${h.longest} 期；出现期间平均权重 ${pct(h.sum/h.seen)}，最高 ${pct(h.max)}，进入前十 ${h.top10} 次。`),judgment:`${history.length?`${history.map(h=>h.ticker).join('、')} 是本样本出现频率靠前的证券。`:''}${profile.quarters.length<12?'当前不足 12 个季度，以上主要说明近期配置延续，不能与多年持有等同。':'出现频率可用于识别反复配置的证券，仍需结合连续季度与权重区分长持和重新买回。'}`,watch:`当前范围 ${profile.quarters[0]} — ${quarter}；补充更早的完整申报后再更新长期风格判断。`},
  ]};
}
