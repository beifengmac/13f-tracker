# Analysis upgrade verification

Implemented locally on 2026-09-10, branch `codex/13f-analysis`. No production deployment performed.

- 9 institutions, 84 quarter snapshots, 30,056 security records; complete recent four-quarter data for all nine institutions.
- Stanley: 52 quarters from 2013 Q2 through 2026 Q2. 2021 Q1 intentionally omitted: NEW HOLDINGS amendment contains CPNG already present in original, requiring explicit reconciliation. 2021 Q2 uses disjoint original + additive amendment with both SEC sources retained.
- Monetary reconciliation verifies parser totals against raw XML rows and cover rounding. Some Stanley source documents have low implied prices consistent with legacy thousand-dollar units. The scale is an inference, explicitly labelled in UI and data; it is not independent currency/price verification.
- Tickers reuse the existing mapping. Ambiguous mappings retain CUSIP in display identifiers. Underlying CUSIP and security class are preserved; mappings are not a new independently verified security master.
- Regression suite: 7 TypeScript tests and 5 Python tests pass. Dataset validation and production build pass. Lint has the pre-existing Fast Refresh export warning; build warns about the large bundled dataset (approximately 1.44 MB gzip).
- Browser checks: homepage, fund report, historical-quarter routing, stock lookup, comparison, desktop/mobile layout, dark mode. No console errors in the final local browsing session. Historical Q4 2025 report contains no Q2 2026 metrics. 390px viewport has no page overflow.
- Preview is a persistent LaunchAgent on loopback port 8890, with logs under `.cache/logs`; source is `scripts/serve_preview.py`. Workspace registry updated. Production GitHub Pages remains unchanged.

Remaining beyond this first release: independent money-unit and ticker-master verification, 2021 Q1 amendment reconciliation, comprehensive corporate-action adjustments, supplier-backed fundamentals/valuation, LLM narrative generation, and smaller per-fund data delivery. No placeholder fundamentals or claimed AI analysis are shipped.

### 持仓事实与配置判断（2026-09-10）

深度报告沿用现有 UI，新增核心仓连续出现、六组明确 CUSIP 研究篮子的股数动作、前后权重、独立列示的期权数量及名义权重。各组依次输出配置倾向、条件判断、替代解释和后续验证；篮子是人工限定的研究范围，不是全组合行业分类或收入穿透。解释依据数量与权重动态生成，缺少完整相邻快照或存在待核实动作时降低置信度并抑制判断。

杜肯 Q2 2026 附参考文章核对，修正 NTRA 股数和 GOOG 股类，区分 CALL 名义值与权利金。美元单位推断标识继续保留，不据此确认实际资金流或宏观动机。新回归测试覆盖参考数字、期权分离、历史时点、不完整快照及反向变化，遍历全部基金季度确认聚合值可渲染。

### 各机构独立分析主体

九家机构统一使用基于自身持仓的六节分析：核心仓、新增与增持、减持与退出、数量不变仓位、期权、历史延续性。重点证券从相应动作按既有重要性规则选取，呈现股数与权重及其是否同向；不按 Stan 的固定主题归类其他机构。Stan 专题保留为折叠补充，通用说明与来源状态移至底部方法区。原有 UI 样式沿用。

本次不扩充历史数据：其他八家仍为四季，杜肯为 52 季；报告明确限制短样本的长期结论。新增测试覆盖所有机构、历史截断、异常快照及期权分离。浏览器检查伯克希尔桌面和喜马拉雅手机页面，均无横向溢出或控制台错误。

### 跨持仓、跨季度的条件推导

所有机构的主体现在按事实依据、配置倾向、条件判断、反例与替代解释、后续验证展开。新增固定旧主仓篮子的前后权重与名单保留率、新出现证券和增持旧仓的规模对照、减持仍持有与退出的区别、数量不变组的权重漂移、同 CUSIP 普通证券/期权配对，以及最近至多四季的连续股数方向。相同发行人名称的分行仅做权重并列观察，不合并股数或证券身份。

结论随数据组合变化：旧主仓更替与保留、方向反转、缺季、申报异常都会改变或阻止判断。连续方向要求最近至少两次相邻完整股数变化，最后一期退出可以纳入持续收缩。这里是持仓证据的确定性推导，未补充公司经营研究或将宏观动机认定为事实；现有历史范围未改变。

### 证券代码身份修复

修复遗留映射将 Teradyne（880770102）标为 TSM 的错误，恢复为 TER；台积电（874039100）统一显示 TSM。全量历史仅更新代码标签，股数、市值、权重和来源不变。其他已识别的发行人与代码冲突先隔离，未验证替代代码时展示 CUSIP，不猜测。新增映射与发行人校验进入更新和发布的数据验证；旧 TSM 括号链接按完整 CUSIP 兼容解析。

身份依据为已保存的 SEC 信息表；TER 代码另核对 https://investors.teradyne.com/。本轮不宣称已完成全部证券代码的独立核验。
