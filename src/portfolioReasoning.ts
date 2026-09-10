import type { Fund } from './types.ts';
import { actionNames, moves, type Move } from './analysis.ts';
import { comparablePrevious, getQuarterKeys, isComplete, quarterOrdinal } from './utils.ts';

const pct = (n:number) => Number.isFinite(n) ? `${n.toFixed(2)}%` : '未知';
const labels = (rows:Move[]) => rows.map(r=>r.holding.t).join('、');
const sum = (rows:Move[], key:'weight'|'previousWeight') => rows.reduce((n,r)=>n+r[key],0);
export interface Reasoning {
  title:string; facts:string[]; tendency:string; judgment:string; counterevidence:string; watch:string;
}
// Conclusions are conditional on observed combinations, not manager biographies or fixed themes.
export function portfolioReasoning(fund:Fund, quarter:string) {
  const prev=comparablePrevious(fund,quarter);
  const valid=(key:string) => isComplete(fund.quarters[key]) && !fund.quarters[key].warnings?.length;
  const complete=!!prev && valid(quarter) && valid(prev);
  const all=moves(fund,quarter);
  const ordinary=all.filter(r=>!r.holding.o && r.holding.security_type!=='PRN');
  const current=ordinary.filter(r=>r.weight>0).sort((a,b)=>b.weight-a.weight);
  const oldCore=ordinary.filter(r=>r.previousWeight>0).sort((a,b)=>b.previousWeight-a.previousWeight).slice(0,5);
  const retainedCore=oldCore.filter(r=>r.weight>0);
  const newRows=ordinary.filter(r=>r.action==='new');
  const increased=ordinary.filter(r=>r.action==='increased');
  const decreased=ordinary.filter(r=>r.action==='decreased');
  const exited=ordinary.filter(r=>r.action==='cleared');
  const unchanged=ordinary.filter(r=>r.action==='unchanged');
  const uncertain=ordinary.filter(r=>r.action==='unknown');
  const adds=ordinary.filter(r=>['new','increased'].includes(r.action)).slice(0,3);
  const cuts=ordinary.filter(r=>['cleared','decreased'].includes(r.action)).slice(0,3);
  const rankedNew=[...newRows].sort((a,b)=>b.weight-a.weight);
  const strong=adds[0], cut=cuts[0];
  const coreComplete=complete && oldCore.every(r=>r.action!=='unknown');
  const allKnown=complete && !uncertain.length;
  const dominant=current[0];
  const scope=uncertain.length?`另有 ${uncertain.length} 项普通证券动作待核实，以下方向仅覆盖可确认记录。`:'';
  const noComparison='没有完整可比的相邻快照，暂不推断配置方向。';
  const coreTendency=coreComplete && oldCore.length
    ? retainedCore.length===oldCore.length ? `前期前 ${oldCore.length} 项普通证券全部延续，主仓名单保持稳定。`
      : `前期前 ${oldCore.length} 项普通证券有 ${oldCore.length-retainedCore.length} 项本期未出现，核心名单发生替换。`
    : complete ? '旧主仓中有证券动作待核实，暂不概括核心调整方向。' : noComparison;
  const newWeight=sum(newRows,'weight'), incBefore=sum(increased,'previousWeight'), incNow=sum(increased,'weight');
  const coreNow=sum(oldCore,'weight'),coreBefore=sum(oldCore,'previousWeight');
  const stableBefore=sum(unchanged,'previousWeight'),stableNow=sum(unchanged,'weight');
  const cutBefore=sum(decreased,'previousWeight'),cutNow=sum(decreased,'weight');
  const issuerGroups=new Map<string,Move[]>();
  for (const r of ordinary) {
    const issuer=r.holding.n.trim().toUpperCase().replace(/\s+/g,' ');
    if (!issuer) continue;
    const group=issuerGroups.get(issuer) ?? []; group.push(r); issuerGroups.set(issuer,group);
  }
  const shareClassFacts=[...issuerGroups.entries()].filter(([,group])=>group.length>1 && group.some(r=>adds.includes(r)||cuts.includes(r)) && group.every(r=>r.action!=='unknown')).slice(0,3).map(([issuer,group])=>`${issuer} 的同名普通证券分行（${labels(group)}）合计权重 ${pct(sum(group,'previousWeight'))} → ${pct(sum(group,'weight'))}；这里并列观察公司层面规模，保留各 CUSIP 与股类，不合并股数。`);
  const blocks:Record<string,Reasoning>={
    core:{title:coreComplete?retainedCore.length===oldCore.length?'核心仓延续：变化发生在名单还是权重？':'核心名单更替：哪些旧主仓正在让位？':'核心仓：本期能确认哪些事实？',
      facts:coreComplete?[`固定以前期前 ${oldCore.length} 项普通证券为同一篮子（${labels(oldCore)}），合计权重 ${pct(coreBefore)} → ${pct(coreNow)}，其中 ${retainedCore.length} 项仍在本期出现。`]:[],
      tendency:coreTendency,
      judgment:coreComplete?`${coreTendency}${coreNow<coreBefore?'同一组旧主仓的权重下降，说明组合重心相对向其余证券分散；但这既可能来自减持，也可能来自相对价格与分母变化。':coreNow>coreBefore?'同一组旧主仓的权重提高，组合对旧主仓的依赖增加；是否主动集中，还要与下方股数动作核对。':'同一组旧主仓权重基本持平，未见其整体地位变化。'}${newRows.length?`同期 ${newRows.length} 项新出现普通证券合计占 ${pct(newWeight)}；将这个量级与旧主仓当前 ${pct(coreNow)} 对照，才能判断新方向是否已经改变重心。`:''}`:noComparison,
      counterevidence:coreComplete?`旧主仓中 ${oldCore.filter(r=>r.action==='increased').length} 项数量增加、${oldCore.filter(r=>r.action==='decreased').length} 项减少、${oldCore.filter(r=>r.action==='unchanged').length} 项未变。${oldCore.some(r=>r.action==='increased')&&oldCore.some(r=>r.action==='decreased')?'存在相反动作，不宜概括为全盘加仓或减仓。':'名单稳定不等于权重稳定，也不证明投资理由始终相同。'}`:'缺少前期或存在动作疑点，不能把首次收录当成新建。',
      watch:`下期对照同一组 ${labels(oldCore.slice(0,3)) || '核心证券'}：如果连续减少且退出，核心延续的解释应下调；如果数量稳定而权重反复变化，应优先研究价格与分母。`},
    adds:{title:strong?`${strong.holding.t} 领衔：新增方向还是强化旧配置？`:'新增配置：暂未确认方向',
      facts:complete?[`可确认的新出现普通证券 ${newRows.length} 项，本期合计 ${pct(newWeight)}；已有仓位数量增加 ${increased.length} 项，这一固定组权重 ${pct(incBefore)} → ${pct(incNow)}。${scope}`]:[],
      tendency:complete?newRows.length||increased.length?`${newWeight>incNow?'新出现证券的当前权重高于增持旧仓，新增方向值得优先研究。':'增持旧仓的当前权重不低于新出现证券，不能只凭新建数量就认定风格转向。'}`:'未确认普通证券新增或增持。':noComparison,
      judgment:complete&&strong?`${strong.holding.t} 是按变化重要性选出的首项增加，当前 ${pct(strong.weight)}。${dominant&&strong.holding.t===dominant.holding.t?'它同时已是当前最大普通证券，变化直接作用于组合重心。':dominant?`相比最大普通证券 ${dominant.holding.t} 的 ${pct(dominant.weight)}，它属于不同量级的配置，不能用股数增幅代替重要性判断。`:''}${rankedNew[0]?`最大的新增记录为 ${rankedNew[0].holding.t}（${pct(rankedNew[0].weight)}），${rankedNew[0].weight>= (current[Math.min(4,current.length-1)]?.weight ?? Infinity)?'已进入本期普通证券前五，值得按主仓级别跟踪。':'尚未进入本期普通证券前五，更适合先观察能否连续保留和扩大。'}`:''}`:complete?'没有可确认的新增与增持，不生成新的配置主线。':noComparison,
      counterevidence:complete?`股数增加的 ${increased.length} 项中，${increased.filter(r=>r.weight<r.previousWeight).length} 项权重反而下降。新增权重与增持组市值是季末存量，不能相加称为本季买入金额；股数倍增还可能来自低基数。${scope}`:'尚不能区分新增证券与名单缺失。',
      watch:`观察 ${labels(adds) || '后续新增记录'} 是否连续两期同向；新仓下一期若迅速退出，应改判为短期配置，而非长期新方向。`},
    cuts:{title:cut?`${cut.holding.t} 等收缩：局部退出还是整体转向？`:'收缩方向：暂无确认动作',
      facts:complete?[`普通证券退出 ${exited.length} 项，前期合计权重 ${pct(sum(exited,'previousWeight'))}；减持但仍持有 ${decreased.length} 项，该组 ${pct(cutBefore)} → ${pct(cutNow)}。${scope}`]:[],
      tendency:complete?exited.length||decreased.length?`${cutNow>0?'减持组仍保留 '+pct(cutNow)+' 的组合权重，缩小配置与完全放弃应分开看。':'可确认的收缩记录以退出为主。'}`:'未确认普通证券收缩。':noComparison,
      judgment:complete&&cut?`${cut.holding.t} ${cut.action==='cleared'?`本期未出现，前期为 ${pct(cut.previousWeight)}`:`数量减少后仍占 ${pct(cut.weight)}`}。${retainedCore.length===oldCore.length&&oldCore.length?'与此同时前期主要普通证券名单全部保留，更支持在原有配置上调整，而非整体替换组合。':'需结合旧主仓退出情况判断调整深度。'}${strong?`另一侧 ${strong.holding.t} 正在增加，说明本期存在方向选择；这些同期变化不足以证明具体卖出款流向哪只证券。`:''}`:complete?'没有可确认的收缩记录，不能据此推断风险偏好提高。':noComparison,
      counterevidence:complete?`数量减少但权重提高的证券有 ${decreased.filter(r=>r.weight>r.previousWeight).length} 项。卖出可对应风险控制、估值或资金需求；申报没有说明原因，也不覆盖所有对冲。`:'数据缺失不能作为退出证据。',
      watch:`重点复查 ${labels(cuts) || '后续收缩记录'} 是否再度收缩或重新出现；如果卖出后很快买回，持续看空的解释会减弱。`},
    stable:{title:'没有交易信号的变化：权重漂移有多大？',
      facts:complete?[`可确认数量不变的普通证券 ${unchanged.length} 项，同一组权重 ${pct(stableBefore)} → ${pct(stableNow)}，净变化 ${(stableNow-stableBefore).toFixed(2)} 个百分点。`]:[],
      tendency:complete?unchanged.length?'这组数量延续，其权重变化不是由季末披露股数增减造成。':'本期未识别出数量不变的普通证券组。':noComparison,
      judgment:complete&&unchanged.length?`这组在没有季末数量变化的情况下，权重${stableNow>stableBefore?'提高':stableNow<stableBefore?'下降':'持平'}。因此分析其他组别时，也必须将相对价格与组合分母纳入解释。${unchanged.some(r=>oldCore.includes(r))?`其中 ${labels(unchanged.filter(r=>oldCore.includes(r)))} 还属于前期主仓，核心配置的延续是比单季权重涨跌更直接的事实。`:''}`:complete?'没有这一组可供对照，不推导价格与交易的相对贡献。':noComparison,
      counterevidence:'数量不变仍可能包含季内先卖后买；上述只是两个季末的净数量相同。权重变化不能还原收益或交易路径。',
      watch:`对 ${labels(unchanged.slice(0,3)) || '后续数量不变证券'}，以下一期是否出现真实股数方向变化作为更新判断的条件。`},
  };
  if (complete) blocks.adds.facts.push(...shareClassFacts);
  // Match the underlying security by full CUSIP; keep share classes and options separate.
  const optionPairs=all.filter(r=>r.holding.o && r.holding.cusip).map(option=>({option,stock:ordinary.find(r=>r.holding.cusip===option.holding.cusip)})).filter(p=>p.stock).slice(0,4);
  blocks.options={title:optionPairs.length?'同一标的的普通证券与期权：是否同向？':'期权配置：有无额外的表达方式？',
    facts:optionPairs.map(({option,stock})=>`${stock!.holding.t} 普通证券 ${pct(stock!.previousWeight)} → ${pct(stock!.weight)}，${option.holding.t} 名义权重 ${pct(option.previousWeight)} → ${pct(option.weight)}；数量动作分别为 ${actionNames[stock!.action]} / ${actionNames[option.action]}。`),
    tendency:optionPairs.length?'同一标的出现多种工具，需要分别比较数量方向。':'未找到普通证券和期权的同 CUSIP 配对，不强行构造同向配置主线。',
    judgment:optionPairs.map(({option,stock})=>`${option.holding.t}：${complete&&option.action!=='unknown'&&stock!.action!=='unknown'?['new','increased'].includes(option.action)&&['new','increased'].includes(stock!.action)?`普通证券与${option.holding.o}数量同时增加，支持该标的表达方式扩展；${option.holding.o==='PUT'?'PUT 可能用于保护，不能直接翻译为更看空。':'仍不能仅凭 CALL 判定总风险敞口提高。'}`:'两种工具未同时增加，不将期权单独变化概括为公司整体配置加强。':noComparison}`).join(' ') || '只讨论实际披露工具，未披露的期权参数与对冲不纳入净方向判断。',
    counterevidence:'CALL、PUT 的披露市值是对应标的名义值，缺少行权价、期限与 Delta；不同工具的权重不能直接合成经济风险敞口。',
    watch:optionPairs.length?`下期分别检查 ${optionPairs.map(p=>p.option.holding.t).join('、')} 是否消失、反向或延续，同时核对其普通证券。`:'后续出现可配对记录再分析工具之间的关系。'};
  const keys=getQuarterKeys(fund).filter(k=>quarterOrdinal(k)<=quarterOrdinal(quarter)).slice(-4);
  const historyMoves = new Map(keys.map(k=>[k, new Map((k===quarter?all:moves(fund,k)).map(r=>[r.holding.t,r]))]));
  const trajectories=[...new Map([...adds,...cuts].map(r=>[r.holding.t,r])).values()].slice(0,4).map(r=>{
    const samples=keys.map(k=>{
      const match=fund.quarters[k].holdings.find(h=>h.t===r.holding.t);
      return `${k} ${match?pct(match.w):valid(k)?'未出现':'未知'}`;
    });
    const actions=keys.slice(1).map(k=>historyMoves.get(k)?.get(r.holding.t)?.action ?? 'unknown');
    let increasing=0, shrinking=0;
    for (let i=keys.length-1;i>0;i--) {
      if (!valid(keys[i]) || !valid(keys[i-1]) || quarterOrdinal(keys[i])-quarterOrdinal(keys[i-1])!==1) break;
      const a=actions[i-1];
      if (a==='increased' && shrinking===0) increasing++;
      else if ((a==='decreased' || (i===keys.length-1 && a==='cleared')) && increasing===0) shrinking++;
      else break;
    }
    const conclusion=increasing>=2?`最近连续 ${increasing} 次增持`:shrinking>=2?`最近连续 ${shrinking} 次收缩${actions.at(-1)==='cleared'?'，本期退出':''}`:'尚未形成最近至少两次连续同向';
    return {ticker:r.holding.t,fact:`${r.holding.t}：${samples.join(' → ')}。相邻期股数动作：${actions.map(a=>actionNames[a]).join(' → ') || '缺少可比记录'}。`, conclusion, persistent:increasing>=2||shrinking>=2};
  });
  blocks.history={title:'把本季放回近几季：持续配置还是一次变化？',facts:trajectories.map(t=>t.fact),
    tendency:trajectories.map(t=>`${t.ticker} ${t.conclusion}`).join('；') || '尚无可确认的重点变动序列。',
    judgment:`最近 ${keys.length} 个已取得季度中，${trajectories.filter(t=>t.persistent).length} 项重点证券形成最近至少两次连续同向股数变化。${trajectories.some(t=>t.persistent)?'持续同向比单季大幅变化更支持配置在逐步调整，但仍不能据此确认投资动机。':'当前不把单季突出动作升级为已经确立的持续趋势。'}${keys.length<3?'观察窗口不足三个季度，暂不判断持续性。':''}`,
    counterevidence:'这里只检查最近至多四季、相邻且完整的记录；“持续同向”要求最近至少两次股数均增加或收缩（可含最后一期退出），不以权重同向代替。出现缺季、异常或未出现都会中断判断。',
    watch:`下一季重查 ${trajectories.map(t=>t.ticker).join('、') || '重点证券'}；若股数反向，原有持续配置判断应及时更新。`};
  return {blocks,summary:complete?`${fund.name_cn}：${coreTendency} ${blocks.adds.tendency}${cut?`另一方面 ${cut.holding.t} ${cut.action==='cleared'?'退出':'减持'}，需要把增加和收缩一起理解。`:''} ${allKnown?'上述倾向覆盖可确认的普通证券动作。':scope}`:noComparison};
}
