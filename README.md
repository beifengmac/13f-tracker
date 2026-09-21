# 13F Tracker

华人顶级价值投资人 13F 持仓追踪 | Top Value Investors 13F Holdings Tracker

🌐 **Live**: https://beifengmac.github.io/13f-tracker

## 追踪名单

### 🌍 Global Legends
| 基金 | 管理人 | 说明 |
|------|--------|------|
| Berkshire Hathaway | 巴菲特 (Warren Buffett) | 价值投资之神 |
| Bridgewater Associates | 达利欧 (Ray Dalio) | 全球最大对冲基金 |
| BlackRock Inc. | 拉里·芬克 (Larry Fink) | 全球最大资管公司 |
| ARK Investment | 木头姐 (Cathie Wood) | 颠覆式创新ETF |
| Oaktree Capital Management | 霍华德·马克斯 (Howard Marks) | 联合创始人；机构13F不代表个人或完整信贷组合 |
| Duquesne Family Office | 德鲁肯米勒 (Stanley Druckenmiller) | 索罗斯前首席操盘手，宏观传奇 |

### 🐉 Chinese Value Masters
| 基金 | 管理人 | 说明 |
|------|--------|------|
| HHLR Advisors | 张磊 | 高瓴资本 |
| Himalaya Capital | 李录 | 芒格唯一委托管理人 |
| H&H International | 段永平 | 步步高/OPPO/vivo 创始人 |
| Oriental Harbor | 但斌 | 东方港湾，中国私募教父 |

## 数据更新频率

- **2/5/8/11月（SEC 13F 截止月）10-20号**：每天 UTC 12:00 自动检查更新
- **其他月份**：每月1号检查一次
- 支持手动触发：GitHub Actions → "Run workflow"

> SEC 要求每季度结束后 45 天内提交 13F，因此 2/5/8/11 月是密集提交窗口期。

## 技术栈

- React + TypeScript + Vite + Tailwind CSS
- 数据来源：SEC EDGAR 13F-HR filings
- 部署：GitHub Pages（自动 CI/CD）

## 本地开发

```bash
npm install
npm run dev
```

## 更新数据

```bash
python scripts/fetch_13f.py --output src/data.json --quarters 4
```

## 分析升级

- 首页按 `max(前后权重) × min(|披露股数变化率|, 1)` 排序重要变化；新出现/退出按对应权重。规则用于研究排序，不代表现金流、交易金额或信心。
- 每家机构提供一页报告；Stanley 历史从 2013 Q2 起。季度选择只使用截至所选季度的数据。
- 证券按 CUSIP、股类、SH/PRN、CALL/PUT 区分；不合并 GOOG/GOOGL 股数。通过 OpenFIGI 按 CUSIP/CINS 查询交易代码；未匹配或有歧义的记录保留编号及状态，不依赖手工猜测。详见 [识别方法](docs/security-identification.md)。
- `complete` 仅表示已取得完整明细且解析和原始明细总额一致；封面总额允许不超过每行 0.5 单位的舍入误差。覆盖率不能替代完整性标记。
- 权重变动指标为 `½Σ|w本期−w前期|`，仅相邻完整季度计算，含价格影响，不是真实换手率。
- 股数未统一拆股复权；疑似拆股、证券类型变化、缺季、部分名单缺失及未完成的修订均不判定买卖。没有实际建仓成本、当前报价或基金收益率估算。
- ETF 分类是名称规则；期权占比为对应标的名义市值，不能当作权利金、投入或风险敞口。

## OpenBB / SEC 数据适配

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/import_openbb.py --funds duquesne --quarters 60
.venv/bin/python scripts/import_openbb.py --quarters 4
npm test
npm run build
```

适配器调用 `openbb_sec.utils.parse_13f.parse_13f_hr`，锁定 OpenBB SEC 1.6.7 / core 1.6.13。只安装 SEC 模块，不需要 OpenBB Workspace 或 AI API 密钥。原始申报缓存保存在 `.cache/sec`（不提交）。

常规金额单位按申报日期处理，不能用 schemaVersion 判定。发现新版日期的文件仍呈现旧式千美元量级时，保留 `value_unit_inferred` 标记：按原有每股市值中位数规则推断金额单位，**这类美元金额仍待独立核验**；原始行总额、封面舍入差异与权重另行核对。`value_scale` 记录倍数，不隐瞒推断来源。不得将单位推断当作对行情的验证。

修订处理：RESTATEMENT 替换；NEW HOLDINGS 从完整原始申报/重述开始，只合并无重叠证券的追加，保留全部来源链接；存在重叠或未知类型即停止该季度更新。历史包含后续修订，不能直接作为无前视偏差的回测输入。下载/核对失败保留已有季度，不删除历史或整家机构。定时任务使用新适配器，默认四季刷新并保留 Stanley 历史；完整历史回补通过手动工作流的 backfill_history 开关执行，避免已知历史修订问题阻塞日常更新。

OpenBB 使用 AGPLv3，见 [OpenBB LICENSE](https://github.com/OpenBB-finance/OpenBB/blob/develop/LICENSE)。本仓库通过 Python 依赖调用其解析模块，没有把 OpenBB Workspace 当成开源前端打包。新增第三方行情或财务供应商前，需要核对数据覆盖、密钥及公开展示条件。

## 本地验收

生产构建预览：`http://localhost:8890/13f-tracker/`。

`/usr/local/bin/python3.12 scripts/serve_preview.py` 固定绑定 `127.0.0.1:8890`。本机 LaunchAgent `com.beifeng.13f-tracker` 保持服务常驻；重新 `npm run build` 即更新预览。端口已登记在工作区 `LOCAL_PORTS.md`。前端提供浏览器打印/保存 PDF；无需服务端上传报告。

本轮交付为可复算的确定性分析，不包含 LLM 自动长文、真实交易还原或未接入的基本面估值。它们不使用占位数据冒充已实现功能。
