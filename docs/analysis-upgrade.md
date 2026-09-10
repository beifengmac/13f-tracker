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
