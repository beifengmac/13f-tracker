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
