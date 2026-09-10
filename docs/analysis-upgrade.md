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
