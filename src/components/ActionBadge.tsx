import type { Action } from '../types';

interface Props {
  action: Action;
  change?: number;
  compact?: boolean;
}

const CFG: Record<Action, { icon: string; label: string; cls: string }> = {
  unknown: { icon: '?', label: '待核实', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  new:       { icon: '●', label: '新建', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  increased: { icon: '↑', label: '加仓', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  decreased: { icon: '↓', label: '减仓', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  cleared:   { icon: '○', label: '清仓', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  unchanged: { icon: '—', label: '持平', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

export default function ActionBadge({ action, change, compact }: Props) {
  const c = CFG[action];
  const pct =
    change && Number.isFinite(change) && (action === 'increased' || action === 'decreased')
      ? ` ${change > 0 ? '+' : ''}${change.toFixed(1)}%`
      : '';

  return (
    <span
      title={action === 'unknown' ? '缺少相邻季度、完整持仓或可比证券记录' : '按披露股数比较；不代表交易时点或投资意图'}
      className={`inline-flex items-center gap-0.5 rounded-full font-medium whitespace-nowrap ${c.cls} ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'}`}
    >
      <span aria-hidden="true">{c.icon}</span>
      {compact ? null : c.label}
      {pct}
    </span>
  );
}
