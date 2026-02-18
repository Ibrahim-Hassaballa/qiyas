import { memo } from 'react';

const DEFAULT_THRESHOLDS = { warning: 70, danger: 90 };

const ProgressBar = memo(({ value = 0, max = 0, label, thresholds = DEFAULT_THRESHOLDS }) => {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(Math.max((value / safeMax) * 100, 0), 100);

  let barColor = 'bg-blue-500';
  if (pct >= thresholds.danger) barColor = 'bg-red-500';
  else if (pct >= thresholds.warning) barColor = 'bg-amber-500';

  return (
    <div
      className="w-full h-1.5 rounded-full overflow-hidden"
      style={{ background: 'var(--surface-subtle)' }}
      role="progressbar"
      aria-valuenow={max > 0 ? Math.round(pct) : 0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: max > 0 ? `${pct}%` : '0%' }}
      />
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
