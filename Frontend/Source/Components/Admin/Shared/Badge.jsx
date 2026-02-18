import { memo } from 'react';

const COLOR_MAP = {
  blue: 'status-info',
  green: 'status-success',
  red: 'status-danger',
  purple: 'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
  slate: 'chip-surface',
  amber: 'status-warning',
};

const SIZE_MAP = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

const Badge = memo(({ children, color = 'blue', size = 'md' }) => (
  <span className={`font-medium rounded-md inline-block ${SIZE_MAP[size] || SIZE_MAP.md} ${COLOR_MAP[color] || COLOR_MAP.blue}`}>
    {children}
  </span>
));

Badge.displayName = 'Badge';

export default Badge;
