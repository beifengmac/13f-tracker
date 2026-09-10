import type { Fund, Holding } from './types.ts';
import { actionNames, moves } from './analysis.ts';
import { comparablePrevious, fmtPct, getQuarterKeys, isComplete, quarterOrdinal } from './utils.ts';

// Explicit research baskets, not an exhaustive industry classification or revenue attribution.
const baskets = [
  { id: 'biotech', title: '核心医疗仓：持续持有与继续提高权重，是两回事', members: ['632307104','457669307'],
    hypothesis: 'Natera 与 Insmed 的配置延续，可作为医疗主题仍占有重要位置的证据。普通股增加且出现 CALL 时，可以讨论表达方式更积极，但不能把 CALL 名义市值相加后称为实际投入。',
    alternative: '股数增加、权重下降可以同时发生；组合分母和股价的相对变化也会改变权重。长期持有不能直接证明对商业模式的认同未变。',
    watch: '分别跟踪普通股与 CALL 是否延续；若继续增持普通股但撤掉 CALL，应区分长期配置与阶段性表达。经营层面仍需另外核查收入质量、商业化与现金消耗。' },
  { id: 'chips', title: '芯片链：先看退出名单，再看保留和新增', members: ['11135F101','595112103','458140100','15101Q207','55024U109','007903107','874039100','861012102','518415104','19247G107'],
    hypothesis: '同一研究篮子内既有退出又有新增或增持，更支持“内部重组”的解释。只有同时观察组内权重与核心保留仓，才能区分整体降低暴露和换股。',
    alternative: '季度快照无法证明卖在高点、判断泡沫结束或预知下一轮赢家。估值纪律、个股事件、风险控制也可能导致同样的持仓结果。',
    watch: '观察下一期退出标的是否重新出现，以及 AMD、TSM、STM 是否延续配置；若保留仓也持续收缩，“内部换股”的解释需要下调。' },
  { id: 'infrastructure', title: '矿企与数据中心：是新线索，还是新的核心仓？', members: ['G11448100','767292105','44812J104','Q4982L109','29444U700'],
    hypothesis: '多个相关标的同步出现，比单只小仓位更值得研究；但主题是否成为核心，应看合计权重及其与既有核心仓的量级，而不是新增标的数量。',
    alternative: '“AI 电力瓶颈”只是一个待检验的假设。矿企与数据中心不具有相同的收入、融资和价格风险；也可能分别对应加密资产周期、项目融资或个股机会，不能统称为电力股。',
    watch: '持仓侧看是否连续两期保留或扩大；业务侧另核查电力合同、算力或托管项目的签约客户、资本开支和融资稀释。缺少这些证据，不把持仓直接翻译成宏观定论。' },
  { id: 'cycle', title: '周期资产：利率假说需要与需求和成本区分', members: ['23331A109','91823B109','146869102','247361702','910047109'],
    hypothesis: '住宅/抵押贷款、汽车零售和航空相关证券共同增加时，可以提出“对部分周期资产更积极”的判断；将其进一步解释为押注宽松，需要额外证据。',
    alternative: '航空也受运力、票价和燃油影响；住宅与贷款更直接面对融资条件。不同企业的变化不能单靠“利率敏感”标签解释，更不能据此预测美联储或断言其跑赢成长股。',
    watch: '分组观察 DHI/UWMC、CVNA、DAL/UAL 的后续动作；再用订单、按揭需求、客运收益和成本数据检验宏观假说。' },
  { id: 'platform', title: '平台股：股数倍增是否同时改变了组合地位？', members: ['023135106','02079K305','02079K107'],
    hypothesis: '应同时看加仓倍数和最新权重：小基数带来的十倍增长，不等于一跃成为组合主仓。普通股与 CALL 同向增加，可以提高这条线索的研究优先级。',
    alternative: '公司层面的配置增加不等于对整个科技板块更乐观；GOOG 与 GOOGL 是不同股类，首次出现某一股类也不一定是首次投资这家公司。',
    watch: '下一季重点看普通股是否保留、CALL 是否撤出，以及公司合计权重是否继续提高。判断便宜或昂贵还需独立财务和估值数据。' },
  { id: 'brazil', title: '巴西相关 ETF：数量不变，不能推导风险判断不变', members: ['464286400'],
    hypothesis: '普通股/ETF份额或 CALL 对应股数保持不变，只能说明两个季末观察到相同数量；可以说配置延续，不能说季内没有交易。',
    alternative: '权重下降可能主要来自价格或组合分母变化；“没有因选举风险调整”及“对新兴市场保持定力”均属于动机推断，13F 本身不能确认。',
    watch: '继续分开跟踪 ETF 与 CALL，并结合其余新兴市场资产；一只巴西工具不足以代表整个新兴市场配置。' },
];
const shares = (n: number) => n.toLocaleString('en-US');
const pct = (n: number) => `${n.toFixed(2)}%`;
export function basketRows(fund: Fund, quarter: string, members: string[]) {
  return moves(fund, quarter).filter(r => !!r.holding.cusip && members.includes(r.holding.cusip));
}
export function researchNarrative(fund: Fund, quarter: string) {
  const prev = comparablePrevious(fund, quarter);
  const q = fund.quarters[quarter];
  const complete = !!prev && isComplete(q) && isComplete(fund.quarters[prev]) && !q.warnings?.length && !fund.quarters[prev].warnings?.length;
  const top = [...q.holdings].filter(h => !h.o && h.security_type !== 'PRN').sort((a,b) => b.w-a.w).slice(0,3);
  const coreFacts = top.map(h => {
    const r = moves(fund, quarter).find(r => r.holding.t === h.t)!;
    const history = getQuarterKeys(fund).filter(k => quarterOrdinal(k) <= quarterOrdinal(quarter));
    let continuous = 0, last = quarterOrdinal(quarter) + 1;
    for (const k of [...history].reverse()) {
      if (last-quarterOrdinal(k)!==1) break;
      if (!fund.quarters[k].holdings.some(x => (h.cusip ? x.cusip === h.cusip : x.t === h.t) && !x.o && x.asset_class === h.asset_class)) break;
      continuous++; last=quarterOrdinal(k);
    }
    return `${h.t}：${shares(h.s)} 股，权重 ${pct(h.w)}；${actionNames[r.action]}${Number.isFinite(r.change) ? ` ${fmtPct(r.change)}` : ''}；截至本期连续 ${continuous} 个已观察季度出现。`;
  });
  const sections = baskets.map(b => {
    const rows = basketRows(fund,quarter,b.members);
    const equity = rows.filter(r => !r.holding.o), options = rows.filter(r => !!r.holding.o);
    const previousWeight = complete ? equity.reduce((sum,r)=>sum+r.previousWeight,0) : null;
    const currentWeight = equity.reduce((sum,r)=>sum+(Number.isFinite(r.weight)?r.weight:0),0);
    const buys = equity.filter(r=>['new','increased'].includes(r.action));
    const sells = equity.filter(r=>['cleared','decreased'].includes(r.action));
    const comparable = complete && equity.every(r=>r.action !== 'unknown');
    const direction = !comparable ? '样本不完整，暂不判断整体方向'
      : buys.length && sells.length ? '存在双向调整，优先解读为组内重组'
      : buys.length ? '观察到新增或数量增加，配置倾向较前期积极'
      : sells.length ? '观察到退出或数量减少，配置倾向较前期收缩'
      : '未观察到可确认的数量方向变化';
    const facts = equity.map(r => `${r.holding.t} ${actionNames[r.action]}${Number.isFinite(r.change) ? ` ${fmtPct(r.change)}` : ''}，权重 ${Number.isFinite(r.previousWeight)?pct(r.previousWeight):'未知'} → ${Number.isFinite(r.weight)?pct(r.weight):'未知'}`).join('；');
    const delta = previousWeight === null ? null : currentWeight-previousWeight;
    const retained = equity.filter(r=>r.weight>0 && r.previousWeight>0);
    let judgment = '本组数量未显示统一的新增或减持方向，不将价格带来的权重变化解释为主动交易。';
    if (buys.length && sells.length) judgment = `本组有 ${buys.length} 项新增或增加、${sells.length} 项减少或退出，支持内部重组的判断；${delta! >= 0 ? '合计权重没有下降，不能概括为整体撤离。' : '合计权重下降，同时存在选择性保留或补充，不能概括为全面退出。'}`;
    else if (buys.length) judgment = `本组 ${buys.length} 项新增或数量增加，${delta! >= 0 ? '合计权重也提高，数量与权重共同支持配置更积极的判断。' : '但合计权重下降，增持数量尚未转化为更高的组合占比。'}`;
    else if (sells.length) judgment = `本组 ${sells.length} 项减少或退出，${delta! < 0 ? '权重同步下降，支持降低该组配置的判断。' : '但权重没有同步下降，数量收缩与组合地位需要分开判断。'}`;
    if (b.id === 'biotech' && retained.length) judgment += ` ${retained.map(r=>r.holding.t).join('、')} 在前后两期均出现，普通证券合计 ${pct(currentWeight)}，支持配置延续；是否属于核心需与上方最大仓位比较。`;
    if (b.id === 'infrastructure' && buys.length) judgment += ` 本组当前合计 ${pct(currentWeight)}，最大单项 ${pct(Math.max(...equity.map(r=>r.weight)))}；这是主题线索的规模，不能凭标的数量就称为新核心仓。`;
    if (b.id === 'cycle' && buys.length) judgment += ' 可提高周期资产这条线索的研究优先级；“押注降息”仍只是候选解释。';
    if (b.id === 'platform' && buys.length) judgment += ' 对小基数仓位，股数倍数必须与当前权重一起看；CALL 单列，不作为实际投入相加。';
    if (b.id === 'brazil' && !buys.length && !sells.length) judgment += ' 配置在季末延续，但不能进一步认定其选举风险判断没有变化。';
    const optionFacts = options.map(r => {
      const prior = prev ? fund.quarters[prev].holdings.find(h=>h.t===r.holding.t) : undefined;
      const current = q.holdings.find(h=>h.t===r.holding.t);
      const before = prior ? shares(prior.s) : complete ? '0' : '未知';
      const after = current ? shares(current.s) : complete ? '0' : '未知';
      return `${r.holding.t} ${actionNames[r.action]}，对应股数 ${before} → ${after}；名义市值权重 ${Number.isFinite(r.previousWeight)?pct(r.previousWeight):'未知'} → ${Number.isFinite(r.weight)?pct(r.weight):'未知'}`;
    }).join('；');
    return { ...b, rows, options, optionFacts, facts, previousWeight, currentWeight, direction, judgment,
      confidence: comparable ? '中' : '低' };
  }).filter(s=>s.rows.length);
  const chips = sections.find(s=>s.id==='chips'), infra = sections.find(s=>s.id==='infrastructure');
  const otherDirections = sections.filter(s=>['cycle','platform'].includes(s.id) && s.previousWeight !== null).map(s=>`${s.id==='cycle'?'周期资产':'平台股'}普通证券权重 ${pct(s.previousWeight!)} → ${pct(s.currentWeight)}`).join('；');
  const synthesis = complete && chips && infra && chips.confidence === '中' && infra.confidence === '中'
    ? `在列出的研究篮子内，芯片相关普通证券权重 ${pct(chips.previousWeight!)} → ${pct(chips.currentWeight)}，矿企/数据中心相关普通证券权重 ${pct(infra.previousWeight!)} → ${pct(infra.currentWeight)}。${chips.currentWeight >= chips.previousWeight! && infra.currentWeight > infra.previousWeight! ? '两组权重同时提高，不支持“整体从芯片撤向电力”的单线叙事。' : '两组权重的变化仅说明季末结构，不能证明卖出所得直接流向另一组。'}${chips.direction}；矿企/数据中心${infra.direction}。${otherDirections ? otherDirections+'。' : ''}综合看，优先判断为多方向的配置调整；“AI 瓶颈转向电力”需要经营证据才能升级为更强的判断。`
    : complete ? '本期优先关注数量和权重是否同向，以及核心仓是否延续。下方逐组给出配置判断；篮子未覆盖的证券不自动归入任何主线，暂不据局部变化概括整个组合的宏观立场。'
    : '缺少完整相邻快照，本期只陈述已收录持仓，暂不输出跨季度配置判断。';
  return { complete, prev, coreFacts, sections, synthesis, topWeight: top.reduce((s,h)=>s+h.w,0) };
}
export function referenceChecks(fund: Fund, quarter: string) {
  if (fund.cik.replace(/^0+/,'') !== '1536411' || quarter !== 'Q2 2026') return [];
  const rows = moves(fund,quarter);
  const get = (cusip:string, option?: Holding['o']) => rows.find(r=>r.holding.cusip===cusip && r.holding.o===option);
  const ntra=get('632307104'),goog=get('02079K305'),amzn=get('023135106');
  return [
    { claim:'Natera 的股数', finding:ntra ? `本期 ${ntra.holding.s.toLocaleString('en-US')} 股，约 ${(ntra.holding.s/10000).toFixed(1)} 万股；参考文章写成 3.19 亿股，量级有误。` : '记录不足，未确认。' },
    { claim:'Alphabet 新增的是哪个股类', finding:goog ? `${goog.holding.t}，CUSIP ${goog.holding.cusip}；本期状态为${actionNames[goog.action]}。该记录为 A 类股，对应 GOOGL；参考文章此处正确，本站此前的 GOOG 标注已更正。` : '记录不足，未确认。' },
    { claim:'Amazon 直接持股超过十倍', finding:amzn && Number.isFinite(amzn.change) ? `本期普通股数量是前期的 ${(1+amzn.change/100).toFixed(2)} 倍，增幅 ${fmtPct(amzn.change)}；当前普通股权重 ${pct(amzn.weight)}，应与小基数背景一起看。` : '记录不足，未确认。' },
    { claim:'CALL 的美元金额', finding:'13F 列示对应标的名义市值，不能描述成支付了同额权利金；本期美元金额的单位还标有待独立核验。' },
    { claim:'AI 硬件泡沫已过、下一瓶颈在电力', finding:'这是参考文章的宏观解释，不是 13F 事实。需要同时解释仍持有或增加的芯片仓位，并补充公司经营、项目和估值证据。' },
  ];
}
